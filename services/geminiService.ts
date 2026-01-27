import { GoogleGenAI, FunctionDeclaration, Type, FunctionCallingConfigMode } from "@google/genai";
import { AIConfig, DetectedBubble } from "../types";

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
  if (!text) return {};
  let content = text.trim();
  
  try {
    return JSON.parse(content);
  } catch (e) {
    // Try finding the first '{' and last '}'
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const possibleJson = content.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(possibleJson);
      } catch (e2) {
        // One last attempt: cleanup markdown if the substring still fails
        const cleaned = possibleJson.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          return JSON.parse(cleaned);
        } catch (e3) {
          console.error("JSON extraction failed", e3);
        }
      }
    }
    throw new Error("Could not parse JSON from response: " + content.substring(0, 100));
  }
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
      const baseUrl = config.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/models`, { headers: { 'Authorization': `Bearer ${config.apiKey}` } });
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id);
    }
  } catch (e) {
    return ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
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
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: prompt,
    });
    return cleanDetectedText(response.text?.trim() || text);
  } else {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return cleanDetectedText(data.choices?.[0]?.message?.content?.trim() || text);
  }
};

// --- Detection API Helper ---

const detectTextRegions = async (base64Image: string, apiUrl: string): Promise<string> => {
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

        if (!response.ok) return "";

        const data = await response.json();
        if (!data.success || !data.text_blocks || !data.image_size) return "";

        const { width: imgW, height: imgH } = data.image_size;
        
        // Convert blocks to percentages for the LLM
        // API returns xyxy: [x1, y1, x2, y2]
        const blocks = data.text_blocks.map((block: any) => {
            const [x1, y1, x2, y2] = block.xyxy;
            const widthPx = x2 - x1;
            const heightPx = y2 - y1;
            const cxPx = x1 + widthPx / 2;
            const cyPx = y1 + heightPx / 2;
            
            // To Percentages
            const x = Math.round((cxPx / imgW) * 100);
            const y = Math.round((cyPx / imgH) * 100);
            const w = Math.round((widthPx / imgW) * 100);
            const h = Math.round((heightPx / imgH) * 100);
            
            // Basic Rotation hint if API supports angle
            const angle = block.angle ? ` (Angle: ${block.angle})` : "";
            
            return `- [x:${x}%, y:${y}%, w:${w}%, h:${h}%]${angle} (Detected Text Hint)`;
        });

        if (blocks.length === 0) return "";

        return `\n\n[HINT] An external OCR tool detected potential text regions at the following coordinates (Center X, Center Y, Width, Height). You can use this as a reference but feel free to refine:\n${blocks.join('\n')}`;

    } catch (e) {
        console.warn("External detection API failed:", e);
        return "";
    }
};

// --- Main Function ---

export const detectAndTypesetComic = async (base64Image: string, config: AIConfig): Promise<DetectedBubble[]> => {
  const data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  let systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  // 1. Call External Detection API if enabled
  if (config.useTextDetectionApi && config.textDetectionApiUrl) {
      const hint = await detectTextRegions(base64Image, config.textDetectionApiUrl);
      if (hint) {
          systemPrompt += hint;
          console.log("Injected Detection Hint into Prompt");
      }
  }

  // 2. Inject Rotation Instruction if enabled
  if (config.allowAiRotation) {
      systemPrompt += `\n- DETECT ROTATION: Examine the visual orientation of the text. If the text line is tilted, estimate the 'rotation' angle in degrees (e.g., -15 for counter-clockwise, 10 for clockwise). Default is 0.`;
  }

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
    
    // Tier 1: Function Calling
    try {
      const response = await ai.models.generateContent({
        model: config.model || 'gemini-3-pro-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: data } },
            { text: systemPrompt + "\nCall the 'create_bubbles_for_comic' function with the results." }
          ]
        },
        config: {
          tools: [{ functionDeclarations: [geminiToolSchema] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } }
        }
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const bubbles = (response.functionCalls[0].args as any).bubbles || [];
        return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text) }));
      }
    } catch (e: any) {
      console.warn("Tier 1 (Function Calling) failed:", e.message);
    }

    // Tier 2: Official JSON Mode
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: data } },
            { text: systemPrompt + "\nCRITICAL: You must return a JSON object with a 'bubbles' key containing the list of speech bubbles." }
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });
      const json = extractJsonFromText(fallbackResponse.text || "{}");
      return (json.bubbles || []).map((b: any) => ({ ...b, text: cleanDetectedText(b.text) }));
    } catch (e: any) {
      console.warn("Tier 2 (JSON Mode) failed:", e.message);
    }

    // Tier 3: Raw Text Extraction (Dumb Luck Mode)
    // No special flags, just a prompt and manual parsing.
    try {
      const rawResponse = await ai.models.generateContent({
        model: config.model || 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: data } },
            { text: systemPrompt + "\nRespond ONLY with a valid JSON object. Example: {\"bubbles\": [...]}. Do not include any other text." }
          ]
        }
      });
      const json = extractJsonFromText(rawResponse.text || "{}");
      return (json.bubbles || []).map((b: any) => ({ ...b, text: cleanDetectedText(b.text) }));
    } catch (e: any) {
      console.error("Tier 3 (Raw Text) failed too:", e.message);
      throw new Error("AI failed to return structured data even after multiple attempts. Please try a more capable model.");
    }

  } else {
    // OpenAI Provider
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [
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
      const toolCalls = resData.choices?.[0]?.message?.tool_calls;
      
      if (toolCalls && toolCalls.length > 0) {
        const args = JSON.parse(toolCalls[0].function.arguments);
        return (args.bubbles || []).map((b: any) => ({ ...b, text: cleanDetectedText(b.text) }));
      } else {
        const content = resData.choices?.[0]?.message?.content;
        const json = extractJsonFromText(content || "{}");
        return (json.bubbles || []).map((b: any) => ({ ...b, text: cleanDetectedText(b.text) }));
      }
    } catch (e) {
      throw new Error("Failed to process OpenAI vision request.");
    }
  }
};
