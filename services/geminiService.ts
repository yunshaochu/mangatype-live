

import { GoogleGenAI, FunctionDeclaration, Type, FunctionCallingConfigMode } from "@google/genai";
import { AIConfig, DetectedBubble, MaskRegion } from "../types";

export const DEFAULT_SYSTEM_PROMPT = `You are an expert Manga Typesetter and Translator. 
1. Look at this manga page.
2. Identify every speech bubble.
3. Read the text inside.
4. Translate the text to Chinese (Simplified). Use a natural, comic-book style.
5. Determine the bounding box (x, y, width, height in %) to effectively MASK (cover) the original text.
6. Return the data as a list of bubbles.

Important Constraints:
- 'x' and 'y' are the center coordinates (0-100).
- 'width' and 'height' should be large enough to hide the original text but fit inside the bubble.
- If the bubble is vertical (standard for most manga), set isVertical to true.
- Use REAL newline characters (Enter key) for line breaks. 
- CRITICAL: Do NOT output literal "\\n" strings. Do NOT use the letter "n" as a separator.
- If the translation is long, use real line breaks to ensure it fits the vertical orientation.`;

// --- Tool Definitions Base ---

const baseGeminiToolSchema: FunctionDeclaration = {
  name: 'create_bubbles_for_comic',
  description: 'Detects speech bubbles in a manga page, translates the text to Chinese, and creates layout boxes for typesetting.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      bubbles: {
        type: Type.ARRAY,
        description: 'List of speech bubbles detected on the page',
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: 'The translated Chinese text.' },
            x: { type: Type.NUMBER, description: 'Center X % (0-100).' },
            y: { type: Type.NUMBER, description: 'Center Y % (0-100).' },
            width: { type: Type.NUMBER, description: 'Width % (0-100).' },
            height: { type: Type.NUMBER, description: 'Height % (0-100).' },
            isVertical: { type: Type.BOOLEAN, description: 'True for vertical text.' },
            // Rotation will be injected here if enabled
          },
          required: ['text', 'x', 'y', 'width', 'height', 'isVertical'],
        },
      },
    },
    required: ['bubbles'],
  },
};

const baseOpenAIToolSchema = {
  name: 'create_bubbles_for_comic',
  description: 'Detects speech bubbles in a manga page, translates the text to Chinese, and creates layout boxes for typesetting.',
  parameters: {
    type: 'object',
    properties: {
      bubbles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The translated Chinese text.' },
            x: { type: 'number', description: 'Center X % (0-100).' },
            y: { type: 'number', description: 'Center Y % (0-100).' },
            width: { type: 'number', description: 'Width % (0-100).' },
            height: { type: 'number', description: 'Height % (0-100).' },
            isVertical: { type: 'boolean', description: 'True for vertical text.' }
            // Rotation will be injected here if enabled
          },
          required: ['text', 'x', 'y', 'width', 'height', 'isVertical'],
        },
      },
    },
    required: ['bubbles'],
  },
};

// --- Helpers ---

const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const cleanDetectedText = (text: string): string => {
  if (!text) return "";
  return text.replace(/\\n/g, '\n');
};

/**
 * Intelligent JSON extractor that handles:
 * 1. Pure JSON strings
 * 2. Markdown blocks (```json ... ```)
 * 3. Stray text before/after the JSON object
 */
const extractJsonFromText = (text: string): any => {
  if (!text) throw new Error("Empty response received from AI");

  // 1. Try cleaning markdown code blocks first
  // This regex matches ```json ... ``` or ``` ... ``` and extracts the content
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = text.match(markdownRegex);
  let content = match ? match[1].trim() : text.trim();

  // 2. Try parsing the (potentially cleaned) content directly
  try {
    return JSON.parse(content);
  } catch (e) {
    // 3. If that fails, look for the first '{' and last '}' to handle introductory/trailing text
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const possibleJson = content.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(possibleJson);
      } catch (e2) {
         // Final fallback attempt: sometimes models output broken JSON or JS-like objects.
         // But for now, we just throw if strict JSON parse fails.
      }
    }
  }

  throw new Error("Could not parse JSON structure from AI response. Raw content: " + text.substring(0, 50) + "...");
};

/**
 * STRICT VALIDATOR: Ensures the AI response actually contains the data we need.
 * If it doesn't, we throw an error so the UI shows a red 'X' instead of a green check.
 */
const validateBubblesArray = (data: any): any[] => {
    if (!data || typeof data !== 'object') {
        throw new Error("AI response is not a valid JSON object");
    }
    if (!('bubbles' in data)) {
        throw new Error("AI response missing 'bubbles' key. The model failed to follow the schema.");
    }
    if (!Array.isArray(data.bubbles)) {
        throw new Error("AI response 'bubbles' is not an array.");
    }
    return data.bubbles;
};

/**
 * Normalizes OpenAI-compatible base URLs.
 * Ensures the URL ends with /v1 if usually required, while respecting users who provide it.
 */
const getOpenAiBaseUrl = (baseUrl: string): string => {
  const cleaned = baseUrl.replace(/\/+$/, '');
  if (cleaned.endsWith('/v1')) return cleaned;
  return `${cleaned}/v1`;
};

/**
 * Constructs the message history based on config.customMessages.
 *
 * For Gemini:
 * - Maps 'assistant' to 'model'.
 * - Maps 'user' to 'user'.
 * - 'system' messages are extracted separately and should be appended to the system prompt text,
 *   because Gemini 'contents' array strictly allows only 'user' and 'model' turns.
 *
 * For OpenAI:
 * - Maps everything as is ('user', 'assistant', 'system').
 */
const getCustomMessages = (config: AIConfig, provider: 'gemini' | 'openai'): { history: any[], systemInjection: string } => {
  const rawMsgs = config.customMessages || [];
  let systemInjection = "";
  let history: any[] = [];

  if (provider === 'gemini') {
    // Filter out system messages and collect them
    rawMsgs.forEach(msg => {
        if (msg.role === 'system') {
            systemInjection += `\n${msg.content}`;
        } else {
            history.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    });
  } else {
    // OpenAI supports system messages in the messages array
    history = rawMsgs.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
  }

  return { history, systemInjection };
};

// --- API Methods ---

export const fetchAvailableModels = async (config: AIConfig): Promise<string[]> => {
  try {
    if (config.provider === 'gemini') {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
      const data = await res.json();

      const prohibitedModels = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];
      return (data.models || [])
        .map((m: any) => m.name.replace('models/', ''))
        .filter((n: string) => n.includes('gemini') && !prohibitedModels.includes(n));
    } else {
      const baseUrl = getOpenAiBaseUrl(config.baseUrl);
      const res = await fetch(`${baseUrl}/models`, { headers: { 'Authorization': `Bearer ${config.apiKey}` } });
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id);
    }
  } catch (e) {
    if (config.provider === 'gemini') {
      return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
    }
    return [];
  }
};

export const polishDialogue = async (text: string, style: 'dramatic' | 'casual' | 'english', config: AIConfig): Promise<string> => {
  const prompt = style === 'dramatic'
    ? `Rewrite the following comic book dialogue to be more dramatic: "${text}"`
    : style === 'casual'
    ? `Rewrite the following comic book dialogue to be casual: "${text}"`
    : `Translate to natural graphic novel English: "${text}"`;

  if (config.provider === 'gemini') {
    const ai = getGeminiClient();
    const { history, systemInjection } = getCustomMessages(config, 'gemini');

    const finalContents = [...history];
    const userPart = { role: 'user', parts: [{ text: (systemInjection ? `[System Note: ${systemInjection}]\n\n` : "") + prompt }] };
    finalContents.push(userPart);

    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: finalContents as any,
    });
    return cleanDetectedText(response.text?.trim() || text);
  } else {
    const baseUrl = getOpenAiBaseUrl(config.baseUrl);
    const { history } = getCustomMessages(config, 'openai');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
            ...history,
            { role: 'user', content: prompt }
        ]
      })
    });
    const data = await response.json();
    return cleanDetectedText(data.choices?.[0]?.message?.content?.trim() || text);
  }
};

// --- Detection API Helper ---

/**
 * Fetches raw text blocks from the local detection API and converts coordinates to percentages.
 */
export const fetchRawDetectedRegions = async (base64Image: string, apiUrl: string): Promise<{x:number, y:number, width:number, height:number}[]> => {
    try {
        const payload = {
            image: `data:image/jpeg;base64,${base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "")}`,
            return_mask: "false"
        };

        const response = await fetch(`${apiUrl}/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) return [];

        const data = await response.json();
        if (!data.success || !data.text_blocks || !data.image_size) return [];

        const { width: imgW, height: imgH } = data.image_size;

        return data.text_blocks.map((block: any) => {
            const [x1, y1, x2, y2] = block.xyxy;
            const widthPx = x2 - x1;
            const heightPx = y2 - y1;
            const cxPx = x1 + widthPx / 2;
            const cyPx = y1 + heightPx / 2;

            // To Percentages
            const x = (cxPx / imgW) * 100;
            const y = (cyPx / imgH) * 100;
            const w = (widthPx / imgW) * 100;
            const h = (heightPx / imgH) * 100;

            return { x, y, width: w, height: h };
        });

    } catch (e) {
        console.warn("External detection API failed:", e);
        return [];
    }
};

// --- Main Function ---

export const detectAndTypesetComic = async (
    base64Image: string,
    config: AIConfig,
    signal?: AbortSignal,
    maskRegions?: MaskRegion[]
): Promise<DetectedBubble[]> => {
  const data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  let systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  // Check cancellation before heavy lifting
  if (signal?.aborted) throw new Error("Aborted by user");

  // Removed automatic "translation-time" detection call here as requested.
  // The detection is now only triggered manually via buttons in the UI (Mask Mode).
  // If user used those buttons, maskRegions will be populated, and we use them as hints below.

  // 1.5 Inject Manual Mask Hints if enabled
  if (config.useMasksAsHints && maskRegions && maskRegions.length > 0) {
      const hints = maskRegions.map(m => {
          return `- [x:${m.x.toFixed(1)}%, y:${m.y.toFixed(1)}%, w:${m.width.toFixed(1)}%, h:${m.height.toFixed(1)}%] (User Marked Region)`;
      }).join('\n');

      systemPrompt += `\n\n[HINT] The user has manually marked specific regions containing text. Please prioritize detecting bubbles in these approximate coordinates (Center X, Center Y, Width, Height):\n${hints}`;
      console.log("Injected Manual Mask Hints into Prompt");
  }

  // 2. Inject Rotation Instruction if enabled
  if (config.allowAiRotation) {
      systemPrompt += `\n- DETECT ROTATION: Examine the visual orientation of the text. If the text line is tilted, estimate the 'rotation' angle in degrees (e.g., -15 for counter-clockwise, 10 for clockwise). Default is 0.`;
  }

  if (signal?.aborted) throw new Error("Aborted by user");

  // 3. Prepare Dynamic Tools/Schemas
  const geminiToolSchema = JSON.parse(JSON.stringify(baseGeminiToolSchema));
  const openAIToolSchema = JSON.parse(JSON.stringify(baseOpenAIToolSchema));

  if (config.allowAiRotation) {
    // Inject 'rotation' property into the tool schemas
    geminiToolSchema.parameters.properties.bubbles.items.properties.rotation = {
        type: Type.NUMBER,
        description: 'Rotation angle in degrees (e.g. -15, 15)'
    };
    openAIToolSchema.parameters.properties.bubbles.items.properties.rotation = {
        type: 'number',
        description: 'Rotation angle in degrees (e.g. -15, 15)'
    };
  }

  if (config.provider === 'gemini') {
    const ai = getGeminiClient();
    const { history, systemInjection } = getCustomMessages(config, 'gemini');

    // If there were any 'system' messages in customMessages, we append them to the main systemPrompt text.
    // This effectively treats them as part of the instructions.
    if (systemInjection) {
        systemPrompt += `\n\n[Additional Instructions]:${systemInjection}`;
    }

    // Tier 1: Function Calling
    try {
      if (signal?.aborted) throw new Error("Aborted by user");
      // Note: @google/genai SDK cancellation support varies.
      // We perform pre-flight check, but logic relies mainly on App.tsx loop break for batch aborts.
      const response = await ai.models.generateContent({
        model: config.model || 'gemini-3-pro-preview',
        contents: [
            ...history,
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: data } },
                { text: systemPrompt + "\nCall the 'create_bubbles_for_comic' function with the results." }
              ]
            }
        ],
        config: {
          tools: [{ functionDeclarations: [geminiToolSchema] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } }
        }
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const args = response.functionCalls[0].args as any;
        const bubbles = validateBubblesArray(args); // Will throw if 'bubbles' missing
        return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
      }
    } catch (e: any) {
      if (e.message?.includes('Aborted')) throw e;
      console.warn("Tier 1 (Function Calling) failed:", e.message);
      // Explicitly proceed to Tier 2
    }

    // Tier 2: Official JSON Mode
    try {
      if (signal?.aborted) throw new Error("Aborted by user");
      const fallbackResponse = await ai.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: [
            ...history,
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: data } },
                { text: systemPrompt + "\nCRITICAL: You must return a JSON object with a 'bubbles' key containing the list of speech bubbles." }
              ]
            }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });
      const json = extractJsonFromText(fallbackResponse.text || "{}");
      const bubbles = validateBubblesArray(json); // Will throw if 'bubbles' missing
      return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
    } catch (e: any) {
      if (e.message?.includes('Aborted')) throw e;
      console.warn("Tier 2 (JSON Mode) failed:", e.message);
      // Explicitly proceed to Tier 3
    }

    // Tier 3: Raw Text Extraction (Dumb Luck Mode)
    try {
      if (signal?.aborted) throw new Error("Aborted by user");
      const rawResponse = await ai.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: [
            ...history,
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: data } },
                { text: systemPrompt + "\nRespond ONLY with a valid JSON object. Example: {\"bubbles\": [...]}. Do not include any other text." }
              ]
            }
        ]
      });
      const json = extractJsonFromText(rawResponse.text || "{}");
      const bubbles = validateBubblesArray(json); // Will throw if 'bubbles' missing
      return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
    } catch (e: any) {
      if (e.message?.includes('Aborted')) throw e;
      console.error("Tier 3 (Raw Text) failed too:", e.message);
      // This final throw ensures App.tsx receives an error status
      throw new Error("AI failed to return structured data. " + e.message);
    }

  } else {
    // OpenAI Provider
    const baseUrl = getOpenAiBaseUrl(config.baseUrl);
    const { history } = getCustomMessages(config, 'openai');

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        signal: signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...history,
            {
              role: "user",
              content: [
                { type: "text", text: systemPrompt + "\nRespond with a JSON object containing the bubbles." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${data}` } }
              ]
            }
          ],
          tools: [{ type: 'function', function: openAIToolSchema }],
          tool_choice: 'auto', // More flexible than specific tool choice
          response_format: { type: "json_object" }
        })
      });

      const resData = await response.json();

      // OpenAI Error from API
      if (resData.error) {
          throw new Error("OpenAI API Error: " + resData.error.message);
      }

      const toolCalls = resData.choices?.[0]?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const args = JSON.parse(toolCalls[0].function.arguments);
        const bubbles = validateBubblesArray(args);
        return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
      } else {
        const content = resData.choices?.[0]?.message?.content;
        const json = extractJsonFromText(content || "{}");
        const bubbles = validateBubblesArray(json);
        return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error("Aborted by user");
      throw new Error("Failed to process OpenAI vision request: " + e.message);
    }
  }
};
