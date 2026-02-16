
import { GoogleGenAI, FunctionDeclaration, Type, FunctionCallingConfigMode } from "@google/genai";
import { AIConfig, DetectedBubble, MaskRegion } from "../types";

export const DEFAULT_FONT_SELECTION_PROMPT = `### 字体选择指南：

大前提：如果漫画原图中有提供字体，请优先使用原图中的字体。
大前提：如果漫画原图中有提供字体，请优先使用原图中的字体。
大前提：如果漫画原图中有提供字体，请优先使用原图中的字体。

如果没有，可以参考以下指南进行字体选择：
- **'noto' (标准黑体)**：默认字体，适用于普通对话、旁白。
- **'noto-bold' (粗黑体)**：用于喊叫、强调、激烈的情绪、动作场景。
- **'serif' (宋体)**：用于正式场合、内心独白、回忆、书信体。
- **'happy' (快乐体)**：用于可爱、搞笑、Q版风格、轻松愉快的场景。
- **'xiaowei' (温柔体)**：用于温柔、浪漫、甜蜜的时刻。
- **'mashan' (毛笔体)**：用于武侠招式、书法效果、史诗感场景。
- **'zhimang' (狂草体)**：用于潦草字迹、绝望、恐怖、混乱的情绪。
- **'longcang' (手写体)**：用于日记、信件、随意的笔记。
- **'liujian' (草书体)**：用于艺术效果、梦境、幻想场景。`;

export const DEFAULT_COLOR_SELECTION_PROMPT = `### 字色选择指南：

大前提：如果漫画原图中有提供字体颜色，请优先使用原图中的颜色。
大前提：如果漫画原图中有提供字体颜色，请优先使用原图中的颜色。
大前提：如果漫画原图中有提供字体颜色，请优先使用原图中的颜色。


如果没有，可以参考以下指南进行颜色选择：
- **黑字白边 (#000000 + #ffffff)**：默认经典组合，适用于大多数对话框。
- **白字黑边 (#ffffff + #000000)**：适用于深色背景、夜晚场景、严肃氛围。
- **红字白边 (#dc2626 + #ffffff)**：适用于强调、警告、愤怒情绪。
- **无边框 (transparent)**：适用于清晰的对话框内文字、旁白框。
- **注意**：选择颜色时要考虑气泡背景色，确保文字清晰可读。优先选择与背景对比度高的颜色组合。`;

export const DEFAULT_SYSTEM_PROMPT = `你是一位专业的漫画嵌字师和翻译师。
你的任务是识别漫画中的对话气泡，翻译文本并提供布局坐标。

### 工作步骤：
1. **检测**：识别所有包含有意义对话的气泡。
   - **忽略**音效（SFX），除非用户明确要求翻译。
2. **翻译**：将文本翻译为**简体中文**。
   - 风格：自然、口语化的漫画风格。
   - **换行**：尽量在视觉上匹配原文的换行方式。**不要过度换行**，仅在语义需要或气泡形状必要时换行。
3. **字体选择**：根据对话的情绪和语境选择最合适的字体。
4. **遮罩定位**：计算覆盖原文的边界框（中心x、中心y、宽度、高度，单位为百分比）。
   - **要求**：遮罩必须**紧密贴合**，完全覆盖文字像素但尽可能小。

### 输出格式（仅JSON）：
返回严格有效的JSON对象。

示例：
{
  "bubbles": [
    {
      "text": "第一行\\n第二行",
      "x": 50.5,
      "y": 30.0,
      "width": 10.0,
      "height": 15.0,
      "isVertical": true,
      "fontFamily": "noto"
    }
  ]
}

### 重要约束：
- **isVertical**：如果气泡是竖排文字（漫画通常如此），`isVertical` 设为 true。
- **竖排排版**：即使 isVertical 为 true，也不要每2-3个字符就强制换行，应自然换行。
- **坐标系**：0-100 范围，相对于图片尺寸。
- **安全输出**：不要在JSON中输出字面的 "\\n" 字符串，使用实际的转义换行符。

### 预检测文本区域：
如果下方提供了坐标，表示这些是预先检测到的文本区域。
请将它们作为**参考锚点**——你可以微调坐标以获得更好的贴合效果，如果预检测遗漏或误识别了区域，也可以增加或删除气泡。
`;

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
            fontFamily: { 
              type: Type.STRING, 
              description: "Font style: 'noto'(dialogue), 'noto-bold'(shouting), 'serif'(formal), 'happy'(comedy), 'xiaowei'(gentle), 'mashan'(brush), 'zhimang'(wild), 'longcang'(handwriting), 'liujian'(cursive).",
              enum: ['noto', 'noto-bold', 'serif', 'happy', 'xiaowei', 'mashan', 'zhimang', 'longcang', 'liujian']
            },
            color: { 
              type: Type.STRING, 
              description: "Text color in hex (e.g., '#000000' for black, '#ffffff' for white). Default is black."
            },
            strokeColor: { 
              type: Type.STRING, 
              description: "Text stroke/border color in hex (e.g., '#ffffff' for white stroke). Use 'transparent' for no stroke."
            },
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
            isVertical: { type: 'boolean', description: 'True for vertical text.' },
            fontFamily: { 
              type: 'string', 
              enum: ['noto', 'noto-bold', 'serif', 'happy', 'xiaowei', 'mashan', 'zhimang', 'longcang', 'liujian'],
              description: "Font style: 'noto'(dialogue), 'noto-bold'(shouting), 'serif'(formal), 'happy'(comedy), 'xiaowei'(gentle), 'mashan'(brush), 'zhimang'(wild), 'longcang'(handwriting), 'liujian'(cursive)." 
            },
            color: { 
              type: 'string', 
              description: "Text color in hex (e.g., '#000000' for black, '#ffffff' for white). Default is black."
            },
            strokeColor: { 
              type: 'string', 
              description: "Text stroke/border color in hex (e.g., '#ffffff' for white stroke). Use 'transparent' for no stroke."
            }
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
 * Robust JSON repair function.
 * Iterates through the string statefully to handle unescaped control characters inside quotes.
 * This fixes the common issue where LLMs output literal newlines in JSON strings.
 */
export const repairJson = (jsonStr: string): string => {
  let inString = false;
  let escaped = false;
  let result = '';
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else {
        if (char === '\\') {
          escaped = true;
          result += char;
        } else if (char === '"') {
          inString = false;
          result += char;
        } else if (char === '\n') {
          result += '\\n'; // CRITICAL FIX: Escape literal newline
        } else if (char === '\r') {
          // Skip literal carriage return inside string to be safe
        } else if (char === '\t') {
          result += '\\t'; // Escape literal tab
        } else {
          result += char;
        }
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }
  return result;
};

/**
 * Intelligent JSON extractor that handles:
 * 1. Pure JSON strings
 * 2. Markdown blocks (```json ... ```)
 * 3. Stray text before/after the JSON object
 * 4. Broken JSON with unescaped newlines (via repairJson)
 */
const extractJsonFromText = (text: string): any => {
  if (!text) throw new Error("Empty response received from AI");
  
  // 1. Try cleaning markdown code blocks first
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = text.match(markdownRegex);
  let content = match ? match[1].trim() : text.trim();

  // 2. Try parsing directly
  try {
    return JSON.parse(content);
  } catch (e) {
    // 3. Try repairing (Fix unescaped newlines)
    try {
        const repaired = repairJson(content);
        return JSON.parse(repaired);
    } catch (e2) {
        // 4. Fallback: Extract innermost {} block and try repairing that
        const startIdx = content.indexOf('{');
        const endIdx = content.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const possibleJson = content.substring(startIdx, endIdx + 1);
            try {
                return JSON.parse(repairJson(possibleJson));
            } catch (e3) {
                // Give up
            }
        }
    }
  }
  
  throw new Error("Could not parse JSON structure from AI response. Raw content: " + text.substring(0, 50) + "...");
};

/**
 * STRICT VALIDATOR: Ensures the AI response actually contains the data we need.
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

const getOpenAiBaseUrl = (baseUrl: string): string => {
  const cleaned = baseUrl.replace(/\/+$/, '');
  if (cleaned.endsWith('/v1')) return cleaned;
  return `${cleaned}/v1`;
};

const getCustomMessages = (config: AIConfig, provider: 'gemini' | 'openai'): { history: any[], systemInjection: string } => {
  const rawMsgs = config.customMessages || [];
  let systemInjection = "";
  let history: any[] = [];

  if (provider === 'gemini') {
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

export const fetchRawDetectedRegions = async (base64Image: string, apiUrl: string): Promise<{
    rects: {x:number, y:number, width:number, height:number}[],
    maskBase64?: string
}> => {
    try {
        const payload = {
            image: `data:image/jpeg;base64,${base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "")}`,
            return_mask: "true"
        };
        
        const response = await fetch(`${apiUrl}/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Detection API responded with ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "API returned failure");
        }
        
        if (!data.text_blocks || !data.image_size) return { rects: [] };

        const { width: imgW, height: imgH } = data.image_size;
        
        const rects = data.text_blocks.map((block: any) => {
            const [x1, y1, x2, y2] = block.xyxy;
            const widthPx = x2 - x1;
            const heightPx = y2 - y1;
            const cxPx = x1 + widthPx / 2;
            const cyPx = y1 + heightPx / 2;
            
            const x = (cxPx / imgW) * 100;
            const y = (cyPx / imgH) * 100;
            const w = (widthPx / imgW) * 100;
            const h = (heightPx / imgH) * 100;
            
            return { x, y, width: w, height: h };
        });

        return { rects, maskBase64: data.mask_refined_base64 };

    } catch (e) {
        console.warn("External detection API failed:", e);
        throw e; // Re-throw to let the UI know it failed
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

  if (signal?.aborted) throw new Error("Aborted by user");

  if (config.useMasksAsHints && maskRegions && maskRegions.length > 0) {
      const hints = maskRegions.map(m => {
          return `- [x:${m.x.toFixed(1)}%, y:${m.y.toFixed(1)}%, w:${m.width.toFixed(1)}%, h:${m.height.toFixed(1)}%] (User Marked Region)`;
      }).join('\n');
      systemPrompt += `\n\n[HINT] The user has manually marked specific regions containing text. Please prioritize detecting bubbles in these approximate coordinates (Center X, Center Y, Width, Height):\n${hints}`;
  }

  if (config.allowAiRotation) {
      systemPrompt += `\n- DETECT ROTATION: Examine the visual orientation of the text. If the text line is tilted, estimate the 'rotation' angle in degrees (e.g., -15 for counter-clockwise, 10 for clockwise). Default is 0.`;
  }

  // Clone schemas so we can modify them non-destructively
  const geminiToolSchema = JSON.parse(JSON.stringify(baseGeminiToolSchema));
  const openAIToolSchema = JSON.parse(JSON.stringify(baseOpenAIToolSchema));

  if (config.allowAiRotation) {
    geminiToolSchema.parameters.properties.bubbles.items.properties.rotation = { 
        type: Type.NUMBER, description: 'Rotation angle in degrees (e.g. -15, 15)' 
    };
    openAIToolSchema.parameters.properties.bubbles.items.properties.rotation = { 
        type: 'number', description: 'Rotation angle in degrees (e.g. -15, 15)' 
    };
  }

  // Handle Font Selection Logic
  if (config.allowAiFontSelection === false) {
      // 1. Remove fontFamily from schemas to prevent AI from outputting it
      delete geminiToolSchema.parameters.properties.bubbles.items.properties.fontFamily;
      delete openAIToolSchema.parameters.properties.bubbles.items.properties.fontFamily;
      
      // 2. Inject prompt instruction to suppress font thinking
      systemPrompt += "\n[IMPORTANT] Do NOT output 'fontFamily'. Use default font for all bubbles.";
  } else {
      // Inject font selection prompt (user-customizable, Chinese by default)
      const fontPrompt = config.fontSelectionPrompt || DEFAULT_FONT_SELECTION_PROMPT;
      systemPrompt += `\n\n${fontPrompt}`;
  }

  // Handle Color Selection Logic
  if (config.allowAiColorSelection === false) {
      // Remove color fields from schemas
      delete geminiToolSchema.parameters.properties.bubbles.items.properties.color;
      delete geminiToolSchema.parameters.properties.bubbles.items.properties.strokeColor;
      delete openAIToolSchema.parameters.properties.bubbles.items.properties.color;
      delete openAIToolSchema.parameters.properties.bubbles.items.properties.strokeColor;
      
      systemPrompt += "\n[IMPORTANT] Do NOT output 'color' or 'strokeColor'. Use default colors for all bubbles.";
  } else {
      // Inject color selection prompt
      const colorPrompt = config.colorSelectionPrompt || DEFAULT_COLOR_SELECTION_PROMPT;
      systemPrompt += `\n\n${colorPrompt}`;
  }

  if (signal?.aborted) throw new Error("Aborted by user");

  if (config.provider === 'gemini') {
    const ai = getGeminiClient();
    const { history, systemInjection } = getCustomMessages(config, 'gemini');

    if (systemInjection) systemPrompt += `\n\n[Additional Instructions]:${systemInjection}`;

    // Tier 1: Function Calling (Skip if user explicitly disabled)
    if (config.modelSupportsFunctionCalling !== false) {
      try {
      if (signal?.aborted) throw new Error("Aborted by user");
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
        const bubbles = validateBubblesArray(args); 
        return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
      }
    } catch (e: any) {
      if (e.message?.includes('Aborted')) throw e;
      console.warn("Tier 1 (Function Calling) failed:", e.message);
    }
    }

    // Tier 2: Official JSON Mode (Skip if user explicitly disabled)
    if (config.modelSupportsJsonMode !== false) {
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
        config: { responseMimeType: "application/json" }
      });
      const json = extractJsonFromText(fallbackResponse.text || "{}");
      const bubbles = validateBubblesArray(json);
      return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
    } catch (e: any) {
      if (e.message?.includes('Aborted')) throw e;
      console.warn("Tier 2 (JSON Mode) failed:", e.message);
    }
    }

    // Tier 3: Raw Text Extraction (Dumb Luck Mode) - Always available as final fallback
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
      const bubbles = validateBubblesArray(json);
      return bubbles.map((b: any) => ({ ...b, text: cleanDetectedText(b.text || b.translation) }));
    } catch (e: any) {
      if (e.message?.includes('Aborted')) throw e;
      console.error("Tier 3 (Raw Text) failed too:", e.message);
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
          tool_choice: 'auto',
          response_format: { type: "json_object" }
        })
      });

      const resData = await response.json();
      if (resData.error) throw new Error("OpenAI API Error: " + resData.error.message);

      const toolCalls = resData.choices?.[0]?.message?.tool_calls;
      
      if (toolCalls && toolCalls.length > 0) {
        // Often 'arguments' is also a JSON string, so we might need repair here too if the model is weird
        let argsStr = toolCalls[0].function.arguments;
        let args;
        try {
            args = JSON.parse(argsStr);
        } catch(e) {
            args = JSON.parse(repairJson(argsStr));
        }
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