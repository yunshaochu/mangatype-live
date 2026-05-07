
import { GoogleGenAI, FunctionDeclaration, Type, FunctionCallingConfigMode } from "@google/genai";
import { AIConfig, BubbleTranslationContext, DEFAULT_TRANSLATION_PROMPT_PRESET, DetectedBubble, MaskRegion } from "../types";
import { FAILURE_CODE_PARSE_BUBBLES_INVALID, isProtectableError } from "./apiProtection";
import { getTranslationPromptPresetDefinition } from "./translationPromptPresets";

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

export const DEFAULT_FONT_SIZE_SCALE_PROMPT = `### 字号选择指南：

大前提：如果漫画原图中有提供字体大小，请优先使用原图中的字体大小。
大前提：如果漫画原图中有提供字体大小，请优先使用原图中的字体大小。
大前提：如果漫画原图中有提供字体大小，请优先使用原图中的字体大小。

根据气泡的大小、文字的情绪强度和重要性，为每个气泡选择合适的字号档位。
请根据原文的视觉大小和语气来判断，选择最合适的档位。`;

export const buildFontSizeScalePrompt = (prefix: string, entries: { label: string; value: number }[]): string => {
  const lines = entries.map(e => `- **'${e.label}'**`).join('\n');
  return `${prefix}\n\n可用的档位（从小到大）：\n${lines}`;
};

export const DEFAULT_FONT_SIZE_DIRECT_PROMPT = `### 字号选择指南（直接模式）：

为每个气泡输出一个 fontSize 数值（单位 rem，范围 0.5-5.0）。
**单位参考**：1 rem = 图片宽度的 2%。

**方法一（有红框坐标时优先使用）**：
提示中的红框坐标 [x, y, w, h] 均为图片尺寸的百分比，据此推算字号。


还有一点，很**重要**————你的换行，要也要以这些信息为依据进行换行，避免出现虽然字号对了，但是没有换行导致了台词溢出气泡的情况。

---

规则：
对于竖排文字来说，每一列字的宽加起来（总宽度），不应该大于红框坐标的w
对于竖排文字来说，每一列字的高加起来（总高度），不应该大于红框坐标的h

---


作为参考，常见的字号大约是1.3，你可以以此为基准，结合图片的原文字号大小、气泡空白部分的大小进行判断，看看哪些字要大一点，哪些字要小一点。

别把字号给太大了，不然会超出气泡的。
`;

export const DEFAULT_SYSTEM_PROMPT = getTranslationPromptPresetDefinition(DEFAULT_TRANSLATION_PROMPT_PRESET).defaultSystemPrompt;

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
            sourceText: { type: Type.STRING, description: 'The original Japanese text only. Preserve original line breaks. Do not translate.' },
            context: {
              type: Type.OBJECT,
              description: 'Translation context. Fill this before writing the final translated text.',
              properties: {
                speaker: { type: Type.STRING, description: "Who is speaking. Use a role name, or '旁白', '独白', '不明'." },
                situation: { type: Type.STRING, description: 'Brief scene, tone, or situation for this line.' },
                preText: { type: Type.STRING, description: 'The most relevant line before this one. Use an empty string if unavailable.' },
                postText: { type: Type.STRING, description: 'The most relevant line after this one. Use an empty string if unavailable.' },
                translationHint: { type: Type.STRING, description: 'Short hint for how to translate this line more accurately.' },
              },
              required: ['speaker', 'situation', 'preText', 'postText', 'translationHint'],
            },
            text: { type: Type.STRING, description: 'The final translated Chinese text. Fill this after sourceText and context are determined.' },
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
          required: ['sourceText', 'context', 'text', 'x', 'y', 'width', 'height', 'isVertical'],
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
            sourceText: { type: 'string', description: 'The original Japanese text only. Preserve original line breaks. Do not translate.' },
            context: {
              type: 'object',
              description: 'Translation context. Fill this before writing the final translated text.',
              properties: {
                speaker: { type: 'string', description: "Who is speaking. Use a role name, or '旁白', '独白', '不明'." },
                situation: { type: 'string', description: 'Brief scene, tone, or situation for this line.' },
                preText: { type: 'string', description: 'The most relevant line before this one. Use an empty string if unavailable.' },
                postText: { type: 'string', description: 'The most relevant line after this one. Use an empty string if unavailable.' },
                translationHint: { type: 'string', description: 'Short hint for how to translate this line more accurately.' },
              },
              required: ['speaker', 'situation', 'preText', 'postText', 'translationHint'],
            },
            text: { type: 'string', description: 'The final translated Chinese text. Fill this after sourceText and context are determined.' },
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
          required: ['sourceText', 'context', 'text', 'x', 'y', 'width', 'height', 'isVertical'],
        },
      },
    },
    required: ['bubbles'],
  },
};

const LEGACY_TEXT_DESCRIPTION = 'The translated Chinese text.';
const CONTEXTUAL_TEXT_DESCRIPTION = 'The final translated Chinese text. Fill this after sourceText and context are determined.';

const applyTranslationContractToBubbleSchema = (bubbleSchema: any, contract: ReturnType<typeof getTranslationPromptPresetDefinition>['contract']) => {
  bubbleSchema.required = [...contract.requiredBubbleFields];

  if (!contract.supportsSourceText) {
    delete bubbleSchema.properties.sourceText;
  }

  if (!contract.supportsContext) {
    delete bubbleSchema.properties.context;
  } else if (bubbleSchema.properties.context) {
    bubbleSchema.properties.context.required = [...contract.contextFields];
  }

  if (bubbleSchema.properties.text) {
    bubbleSchema.properties.text.description = contract.requiresContext
      ? CONTEXTUAL_TEXT_DESCRIPTION
      : LEGACY_TEXT_DESCRIPTION;
  }
};

const createTranslationToolSchemas = (config: AIConfig) => {
  const presetDefinition = getTranslationPromptPresetDefinition(config.translationPromptPreset);
  const geminiToolSchema = JSON.parse(JSON.stringify(baseGeminiToolSchema));
  const openAIToolSchema = JSON.parse(JSON.stringify(baseOpenAIToolSchema));

  applyTranslationContractToBubbleSchema(geminiToolSchema.parameters.properties.bubbles.items, presetDefinition.contract);
  applyTranslationContractToBubbleSchema(openAIToolSchema.parameters.properties.bubbles.items, presetDefinition.contract);

  return { presetDefinition, geminiToolSchema, openAIToolSchema };
};

// --- Helpers ---

const getGeminiClient = (apiKey?: string) => {
  return new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY || '' });
};

const cleanDetectedText = (text: string): string => {
  if (!text) return "";
  return text.replace(/\\n/g, '\n');
};

const normalizeOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = cleanDetectedText(value).trim();
  return cleaned.length > 0 ? cleaned : undefined;
};

const normalizeBubbleContext = (bubble: any): BubbleTranslationContext | undefined => {
  const rawContext = bubble?.context;
  const contextObject = rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)
    ? rawContext
    : undefined;

  const normalizedContext: BubbleTranslationContext = {
    speaker: normalizeOptionalText(contextObject?.speaker ?? contextObject?.char ?? bubble?.speaker ?? bubble?.char),
    situation: normalizeOptionalText(
      contextObject?.situation
      ?? contextObject?.scene
      ?? (typeof rawContext === 'string' ? rawContext : undefined)
    ),
    preText: normalizeOptionalText(contextObject?.preText ?? contextObject?.pre_text ?? bubble?.preText ?? bubble?.pre_text),
    postText: normalizeOptionalText(contextObject?.postText ?? contextObject?.post_text ?? bubble?.postText ?? bubble?.post_text),
    translationHint: normalizeOptionalText(
      contextObject?.translationHint
      ?? contextObject?.hint
      ?? contextObject?.note
      ?? contextObject?.think
      ?? bubble?.translationHint
      ?? bubble?.think
    ),
  };

  if (Object.values(normalizedContext).every(value => value == null || value.length === 0)) {
    return undefined;
  }

  return normalizedContext;
};

const createParseBubblesError = (message: string, cause?: unknown): Error => {
  const err: any = new Error(message);
  err.code = FAILURE_CODE_PARSE_BUBBLES_INVALID;
  if (cause) err.cause = cause;
  return err;
};

const createAbortByUserError = (): Error => {
  const err: any = new Error("Aborted by user");
  err.name = "AbortError";
  return err;
};

const isAbortByUserError = (error: any): boolean => {
  return error?.name === 'AbortError' || (typeof error?.message === 'string' && error.message.includes('Aborted'));
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
  if (!text) throw createParseBubblesError("Empty response received from AI");
  
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
  
  throw createParseBubblesError("Could not parse JSON structure from AI response. Raw content: " + text.substring(0, 50) + "...");
};

/**
 * STRICT VALIDATOR: Ensures the AI response actually contains the data we need.
 */
const validateBubblesArray = (data: any): any[] => {
    if (!data || typeof data !== 'object') {
        throw createParseBubblesError("AI response is not a valid JSON object");
    }
    if (!('bubbles' in data)) {
        throw createParseBubblesError("AI response missing 'bubbles' key. The model failed to follow the schema.");
    }
    if (!Array.isArray(data.bubbles)) {
        throw createParseBubblesError("AI response 'bubbles' is not an array.");
    }
    return data.bubbles;
};

const ensureNonEmptyResponseText = (text: string | undefined | null, source: string): string => {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw createParseBubblesError(`${source} returned empty response; expected {"bubbles":[...]}.`);
  }
  return text;
};

export const extractAndValidateBubblesFromText = (text: string | undefined | null, source: string): any[] => {
  const nonEmptyText = ensureNonEmptyResponseText(text, source);
  const payload = extractJsonFromText(nonEmptyText);
  return validateBubblesArray(payload);
};

const mapDetectedBubbles = (bubbles: any[]): any[] => {
  return bubbles.map((bubble: any) => ({
    ...bubble,
    sourceText: normalizeOptionalText(bubble.sourceText || bubble.source_text || bubble.ori_text),
    context: normalizeBubbleContext(bubble),
    text: cleanDetectedText(bubble.text || bubble.translation),
  }));
};

export const parseOpenAIToolCallArguments = (toolCall: any): any => {
  const argsStr = toolCall?.function?.arguments;
  if (typeof argsStr !== 'string' || argsStr.trim().length === 0) {
    throw createParseBubblesError("OpenAI tool call arguments are missing or not a string.");
  }

  try {
    return JSON.parse(argsStr);
  } catch (parseError: any) {
    try {
      return JSON.parse(repairJson(argsStr));
    } catch (repairParseError: any) {
      const parseFailure = createParseBubblesError(
        `OpenAI tool call arguments parse failed: ${parseError?.message || 'Invalid JSON arguments.'}`,
        repairParseError
      ) as any;
      parseFailure.originalParseError = parseError;
      parseFailure.rawArguments = argsStr;
      throw parseFailure;
    }
  }
};

/**
 * Handle OpenAI-compatible responses that may be streaming despite stream:false.
 * Detects SSE/ndjson responses and reassembles them into a single JSON object.
 */
const parseOpenAIResponse = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type') || '';

  // Normal JSON response
  if (contentType.includes('application/json')) {
    return response.json();
  }

  // Streaming response (text/event-stream or ndjson) — reassemble chunks
  const text = await response.text();

  // SSE format: lines starting with "data: "
  if (text.includes('data: ')) {
    let result: any = null;
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') break;
      try {
        const chunk = JSON.parse(payload);
        if (!result) {
          // Initialize from first chunk
          result = { ...chunk };
          if (result.choices) {
            result.choices = result.choices.map((c: any) => ({
              ...c,
              message: {
                role: c.delta?.role || 'assistant',
                content: c.delta?.content || '',
                tool_calls: c.delta?.tool_calls ? JSON.parse(JSON.stringify(c.delta.tool_calls)) : undefined,
              }
            }));
          }
        } else if (result.choices && chunk.choices) {
          // Merge subsequent chunks
          for (let i = 0; i < chunk.choices.length; i++) {
            const delta = chunk.choices[i]?.delta;
            if (!delta) continue;
            const msg = result.choices[i]?.message;
            if (!msg) continue;
            if (delta.content) msg.content += delta.content;
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (!msg.tool_calls) msg.tool_calls = [];
                const existing = msg.tool_calls[tc.index];
                if (existing) {
                  if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                } else {
                  msg.tool_calls[tc.index] = { ...tc, function: { ...tc.function } };
                }
              }
            }
          }
        }
      } catch (_) { /* skip unparseable lines */ }
    }
    if (result) return result;
  }

  // Last resort: try parsing the whole text as JSON
  return JSON.parse(text);
};

const getOpenAiBaseUrl = (baseUrl: string): string => {
  const cleaned = baseUrl.replace(/\/+$/, '');
  if (cleaned.endsWith('/v1')) return cleaned;
  return `${cleaned}/v1`;
};

const createWrappedError = (message: string, original?: any, extras?: Record<string, any>): Error => {
  const wrapped: any = new Error(message);
  if (original) {
    wrapped.cause = original;
    const errorCode = original?.code || original?.cause?.code;
    if (errorCode) {
      wrapped.code = errorCode;
    }
    const status =
      original?.status ||
      original?.statusCode ||
      original?.response?.status ||
      original?.cause?.status ||
      original?.cause?.statusCode ||
      original?.cause?.response?.status;
    if (status) {
      wrapped.status = status;
      wrapped.statusCode = status;
    }
    if (original?.response || original?.cause?.response) {
      wrapped.response = original?.response || original?.cause?.response;
    }
  }
  if (extras) {
    Object.assign(wrapped, extras);
  }
  return wrapped;
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
      const apiKey = config.apiKey || process.env.API_KEY;
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

// --- Detection API Helper ---

export const fetchRawDetectedRegions = async (base64Image: string, apiUrl: string): Promise<{
    rects: {x:number, y:number, width:number, height:number, maskContourBase64?: string, className?: string, contourX?: number, contourY?: number, contourW?: number, contourH?: number}[],
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
            
            return {
                x,
                y,
                width: w,
                height: h,
                maskContourBase64: block.mask_refined_region_base64 ?? undefined,
            };
        });

        return { rects, maskBase64: data.mask_refined_base64 };

    } catch (e) {
        console.warn("External detection API failed:", e);
        throw e; // Re-throw to let the UI know it failed
    }
};

// --- Detection API V2 Helper (RT-DETR-v2) ---

const boxIoU = (a: number[], b: number[]): number => {
    const ax1 = Math.min(a[0], a[2]), ay1 = Math.min(a[1], a[3]);
    const ax2 = Math.max(a[0], a[2]), ay2 = Math.max(a[1], a[3]);
    const bx1 = Math.min(b[0], b[2]), by1 = Math.min(b[1], b[3]);
    const bx2 = Math.max(b[0], b[2]), by2 = Math.max(b[1], b[3]);
    const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
    const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
    const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    if (inter === 0) return 0;
    const areaA = (ax2 - ax1) * (ay2 - ay1);
    const areaB = (bx2 - bx1) * (by2 - by1);
    return inter / (areaA + areaB - inter);
};

const loadMaskImage = (base64: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/png;base64,${base64}`;
    });

const cropMaskRegion = (
    maskImg: HTMLImageElement,
    x1: number, y1: number, x2: number, y2: number
): string | undefined => {
    const w = Math.round(x2 - x1);
    const h = Math.round(y2 - y1);
    if (w <= 0 || h <= 0) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(maskImg, Math.round(x1), Math.round(y1), w, h, 0, 0, w, h);
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
};

export const fetchRawDetectedRegionsV2 = async (base64Image: string, apiUrl: string, returnTextContours: boolean = false): Promise<{
    rects: {x:number, y:number, width:number, height:number, className?: string, maskContourBase64?: string, contourX?: number, contourY?: number, contourW?: number, contourH?: number}[],
    maskBase64?: string
}> => {
    try {
        const payload: Record<string, any> = {
            image: `data:image/jpeg;base64,${base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "")}`,
            conf_threshold: 0.5,
        };
        if (returnTextContours) {
            payload.return_text_contours = true;
        }

        const response = await fetch(`${apiUrl}/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Detection API V2 responded with ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "API V2 returned failure");
        }

        if (!data.detections || !data.image_size) return { rects: [] };

        const { width: imgW, height: imgH } = data.image_size;

        const textContoursData = data.text_contours;

        const foldMaskBase64 = textContoursData?.mask_refined_base64 as string | undefined;
        let maskImg: HTMLImageElement | null = null;
        const contourBlocks: Array<{ xyxy: number[] }> = textContoursData?.text_blocks ?? [];

        if (foldMaskBase64 && contourBlocks.length > 0) {
            try {
                maskImg = await loadMaskImage(foldMaskBase64);
            } catch {
                console.warn('Failed to load V2 contour mask image');
            }
        }

        const rects = data.detections.map((det: any) => {
            const [x1, y1, x2, y2] = det.bbox;
            const widthPx = x2 - x1;
            const heightPx = y2 - y1;
            const cxPx = x1 + widthPx / 2;
            const cyPx = y1 + heightPx / 2;

            const x = (cxPx / imgW) * 100;
            const y = (cyPx / imgH) * 100;
            const w = (widthPx / imgW) * 100;
            const h = (heightPx / imgH) * 100;

            let maskContourBase64: string | undefined;
            let contourX: number | undefined;
            let contourY: number | undefined;
            let contourW: number | undefined;
            let contourH: number | undefined;
            if (maskImg && contourBlocks.length > 0) {
                let bestIoU = 0;
                let bestBlk: typeof contourBlocks[0] | null = null;
                for (const blk of contourBlocks) {
                    const iou = boxIoU(det.bbox, blk.xyxy);
                    if (iou > bestIoU) {
                        bestIoU = iou;
                        bestBlk = blk;
                    }
                }
                if (bestBlk && bestIoU > 0.3) {
                    const [bx1, by1, bx2, by2] = bestBlk.xyxy;
                    maskContourBase64 = cropMaskRegion(maskImg, bx1, by1, bx2, by2);
                    const blkW = bx2 - bx1;
                    const blkH = by2 - by1;
                    contourX = ((bx1 + blkW / 2) / imgW) * 100;
                    contourY = ((by1 + blkH / 2) / imgH) * 100;
                    contourW = (blkW / imgW) * 100;
                    contourH = (blkH / imgH) * 100;
                }
            }

            return {
                x,
                y,
                width: w,
                height: h,
                className: det.class_name,
                maskContourBase64,
                contourX,
                contourY,
                contourW,
                contourH,
            };
        });

        return {
            rects,
            maskBase64: foldMaskBase64,
        };

    } catch (e) {
        console.warn("External detection API V2 failed:", e);
        throw e;
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
  const { presetDefinition, geminiToolSchema, openAIToolSchema } = createTranslationToolSchemas(config);
  let systemPrompt = config.systemPrompt || presetDefinition.defaultSystemPrompt;

  if (signal?.aborted) throw createAbortByUserError();

  if (config.useMasksAsHints && maskRegions && maskRegions.length > 0) {
      const hints = maskRegions.map(m => {
          return `- [x:${m.x.toFixed(1)}%, y:${m.y.toFixed(1)}%, w:${m.width.toFixed(1)}%, h:${m.height.toFixed(1)}%] (User Marked Region)`;
      }).join('\n');
      systemPrompt += `\n\n[HINT] The user has manually marked specific regions containing text. Please prioritize detecting bubbles in these approximate coordinates (Center X, Center Y, Width, Height):\n${hints}`;
  }

  if (config.allowAiRotation) {
      systemPrompt += `\n- DETECT ROTATION: Examine the visual orientation of the text. If the text line is tilted, estimate the 'rotation' angle in degrees (e.g., -15 for counter-clockwise, 10 for clockwise). Default is 0.`;
  }

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

  // Handle Font Size Logic
  if (config.allowAiFontSize !== false) {
      if (config.fontSizeMode === 'direct') {
          // Direct mode: AI outputs exact rem value
          geminiToolSchema.parameters.properties.bubbles.items.properties.fontSize = {
              type: Type.NUMBER, description: 'Font size in rem (0.5-5.0).'
          };
          openAIToolSchema.parameters.properties.bubbles.items.properties.fontSize = {
              type: 'number', description: 'Font size in rem (0.5-5.0).'
          };
          const sizePrompt = config.fontSizePrompt || DEFAULT_FONT_SIZE_DIRECT_PROMPT;
          systemPrompt += `\n\n${sizePrompt}`;
      } else {
          // Scale mode (default): AI outputs dynamic scale labels
          const defaultEntries = [
              { label: 'tiny', value: 0.5 }, { label: 'small', value: 0.7 },
              { label: 'normal', value: 1.0 }, { label: 'large', value: 1.3 },
              { label: 'huge', value: 1.8 }, { label: 'extreme', value: 2.5 },
          ];
          const entries = config.fontScaleEntries || defaultEntries;
          const labels = entries.map(e => e.label);
          const desc = "Font size scale: " + labels.map(l => `'${l}'`).join(', ') + ".";
          geminiToolSchema.parameters.properties.bubbles.items.properties.fontScale = {
              type: Type.STRING,
              description: desc,
              enum: labels
          };
          openAIToolSchema.parameters.properties.bubbles.items.properties.fontScale = {
              type: 'string',
              enum: labels,
              description: desc
          };
          const scalePrefix = config.fontSizeScalePrompt || DEFAULT_FONT_SIZE_SCALE_PROMPT;
          systemPrompt += `\n\n${buildFontSizeScalePrompt(scalePrefix, entries)}`;
      }
  } else {
      systemPrompt += "\n[IMPORTANT] Do NOT output 'fontScale' or 'fontSize'. Use default font size for all bubbles.";
  }

  if (signal?.aborted) throw new Error("Aborted by user");

  if (config.provider === 'gemini') {
    const ai = getGeminiClient(config.apiKey);
    const { history, systemInjection } = getCustomMessages(config, 'gemini');

    if (systemInjection) systemPrompt += `\n\n[Additional Instructions]:${systemInjection}`;

    // Tier 1: Function Calling (Skip if user explicitly disabled)
    if (config.modelSupportsFunctionCalling !== false) {
      try {
      if (signal?.aborted) throw createAbortByUserError();
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
        return mapDetectedBubbles(bubbles);
      }
    } catch (e: any) {
      if (isAbortByUserError(e)) throw e;
      if (isProtectableError(e).shouldProtect) {
        throw createWrappedError(`Gemini request failed: ${e.message || 'Rate limit error'}`, e);
      }
      console.warn("Tier 1 (Function Calling) failed:", e.message);
    }
    }

    // Tier 2: Official JSON Mode (Skip if user explicitly disabled)
    if (config.modelSupportsJsonMode !== false) {
      try {
      if (signal?.aborted) throw createAbortByUserError();
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
      const bubbles = extractAndValidateBubblesFromText(fallbackResponse.text, "Gemini JSON mode response");
      return mapDetectedBubbles(bubbles);
    } catch (e: any) {
      if (isAbortByUserError(e)) throw e;
      if (isProtectableError(e).shouldProtect) {
        throw createWrappedError(`Gemini request failed: ${e.message || 'Rate limit error'}`, e);
      }
      console.warn("Tier 2 (JSON Mode) failed:", e.message);
    }
    }

    // Tier 3: Raw Text Extraction (Dumb Luck Mode) - Always available as final fallback
    try {
      if (signal?.aborted) throw createAbortByUserError();
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
      const bubbles = extractAndValidateBubblesFromText(rawResponse.text, "Gemini raw response");
      return mapDetectedBubbles(bubbles);
    } catch (e: any) {
      if (isAbortByUserError(e)) throw e;
      console.error("Tier 3 (Raw Text) failed too:", e.message);
      throw createWrappedError("AI failed to return structured data. " + (e.message || 'Unknown error'), e);
    }

  } else {
    // OpenAI Provider
    const baseUrl = getOpenAiBaseUrl(config.baseUrl);
    const { history } = getCustomMessages(config, 'openai');
    
    try {
      const openAIRequestBody: Record<string, any> = {
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
        stream: false,
      };

      if (config.modelSupportsFunctionCalling !== false) {
        openAIRequestBody.tools = [{ type: 'function', function: openAIToolSchema }];
        openAIRequestBody.tool_choice = 'auto';
      }

      if (config.modelSupportsJsonMode !== false) {
        openAIRequestBody.response_format = { type: "json_object" };
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        signal: signal,
        body: JSON.stringify(openAIRequestBody)
      });

      let resData: any;
      try {
        resData = await parseOpenAIResponse(response);
      } catch (parseError: any) {
        throw createWrappedError(
          `OpenAI API HTTP ${response.status}: Failed to parse response`,
          parseError,
          { status: response.status, statusCode: response.status }
        );
      }

      if (!response.ok || resData?.error) {
        const apiMessage = resData?.error?.message || `HTTP ${response.status}`;
        throw createWrappedError(
          "OpenAI API Error: " + apiMessage,
          resData?.error,
          { status: response.status, statusCode: response.status, response: { status: response.status, data: resData } }
        );
      }

      const toolCalls = resData.choices?.[0]?.message?.tool_calls;
      
      if (toolCalls && toolCalls.length > 0) {
        const args = parseOpenAIToolCallArguments(toolCalls[0]);
        const bubbles = validateBubblesArray(args);
        return mapDetectedBubbles(bubbles);
      } else {
        const content = resData.choices?.[0]?.message?.content;
        const bubbles = extractAndValidateBubblesFromText(content, "OpenAI content response");
        return mapDetectedBubbles(bubbles);
      }
    } catch (e: any) {
      if (isAbortByUserError(e)) throw createAbortByUserError();
      throw createWrappedError("Failed to process OpenAI vision request: " + (e.message || 'Unknown error'), e);
    }
  }
};
