import { AIConfig, APIEndpoint, mergeEndpointConfig } from '../types';
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';

export interface EndpointSingleTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface EndpointCapabilityTestResult {
  basic: EndpointSingleTestResult;
  functionCalling: EndpointSingleTestResult;
  jsonMode: EndpointSingleTestResult;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const formatErr = (e: any): string => {
  if (!e) return 'Unknown error';
  return e.message || e.toString() || 'Unknown error';
};

const toOpenAIBaseUrl = (baseUrl: string): string => {
  const cleaned = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  return cleaned.endsWith('/v1') ? cleaned : `${cleaned}/v1`;
};

const runGeminiBasic = async (config: AIConfig): Promise<EndpointSingleTestResult> => {
  const start = now();
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: 'Reply with: ok' }] }],
    });
    const text = (response.text || '').trim().toLowerCase();
    const ok = text.includes('ok');
    return { ok, message: ok ? 'Basic request succeeded' : 'No expected response text', latencyMs: Math.round(now() - start) };
  } catch (e: any) {
    return { ok: false, message: formatErr(e), latencyMs: Math.round(now() - start) };
  }
};

const runGeminiFunctionCalling = async (config: AIConfig): Promise<EndpointSingleTestResult> => {
  const start = now();
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: 'Call the ping_tool function with {"ok": true}.' }] }],
      config: {
        tools: [{
          functionDeclarations: [{
            name: 'ping_tool',
            description: 'Connectivity test tool',
            parameters: {
              type: Type.OBJECT,
              properties: { ok: { type: Type.BOOLEAN } },
              required: ['ok'],
            },
          }],
        }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
      },
    });

    const called = !!response.functionCalls && response.functionCalls.length > 0;
    return { ok: called, message: called ? 'Function call returned' : 'No function call returned', latencyMs: Math.round(now() - start) };
  } catch (e: any) {
    return { ok: false, message: formatErr(e), latencyMs: Math.round(now() - start) };
  }
};

const runGeminiJsonMode = async (config: AIConfig): Promise<EndpointSingleTestResult> => {
  const start = now();
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: 'Return a JSON object: {"ok": true}' }] }],
      config: { responseMimeType: 'application/json' },
    });
    const parsed = JSON.parse(response.text || '{}');
    const ok = parsed?.ok === true;
    return { ok, message: ok ? 'Valid JSON response' : 'JSON parsed but expected key missing', latencyMs: Math.round(now() - start) };
  } catch (e: any) {
    return { ok: false, message: formatErr(e), latencyMs: Math.round(now() - start) };
  }
};

const runOpenAIBasic = async (config: AIConfig): Promise<EndpointSingleTestResult> => {
  const start = now();
  try {
    const response = await fetch(`${toOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Reply with: ok' }],
        stream: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, message: data?.error?.message || `HTTP ${response.status}`, latencyMs: Math.round(now() - start) };
    }
    const text = (data?.choices?.[0]?.message?.content || '').toLowerCase();
    const ok = text.includes('ok');
    return { ok, message: ok ? 'Basic request succeeded' : 'No expected response text', latencyMs: Math.round(now() - start) };
  } catch (e: any) {
    return { ok: false, message: formatErr(e), latencyMs: Math.round(now() - start) };
  }
};

const runOpenAIFunctionCalling = async (config: AIConfig): Promise<EndpointSingleTestResult> => {
  const start = now();
  try {
    const response = await fetch(`${toOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Call ping_tool with {"ok": true}.' }],
        stream: false,
        tools: [{
          type: 'function',
          function: {
            name: 'ping_tool',
            description: 'Connectivity test tool',
            parameters: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
            },
          },
        }],
        tool_choice: 'auto',
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, message: data?.error?.message || `HTTP ${response.status}`, latencyMs: Math.round(now() - start) };
    }
    const toolCalls = data?.choices?.[0]?.message?.tool_calls || [];
    const ok = toolCalls.length > 0;
    return { ok, message: ok ? 'Function call returned' : 'No function call returned', latencyMs: Math.round(now() - start) };
  } catch (e: any) {
    return { ok: false, message: formatErr(e), latencyMs: Math.round(now() - start) };
  }
};

const runOpenAIJsonMode = async (config: AIConfig): Promise<EndpointSingleTestResult> => {
  const start = now();
  try {
    const response = await fetch(`${toOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Return JSON only: {"ok": true}' }],
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, message: data?.error?.message || `HTTP ${response.status}`, latencyMs: Math.round(now() - start) };
    }

    const content = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const ok = parsed?.ok === true;
    return { ok, message: ok ? 'Valid JSON response' : 'JSON parsed but expected key missing', latencyMs: Math.round(now() - start) };
  } catch (e: any) {
    return { ok: false, message: formatErr(e), latencyMs: Math.round(now() - start) };
  }
};

export const runEndpointCapabilityTests = async (
  globalConfig: AIConfig,
  endpoint: APIEndpoint
): Promise<EndpointCapabilityTestResult> => {
  const merged = mergeEndpointConfig(globalConfig, endpoint);

  if (endpoint.provider === 'gemini') {
    const [basic, functionCalling, jsonMode] = await Promise.all([
      runGeminiBasic(merged),
      runGeminiFunctionCalling(merged),
      runGeminiJsonMode(merged),
    ]);
    return { basic, functionCalling, jsonMode };
  }

  const [basic, functionCalling, jsonMode] = await Promise.all([
    runOpenAIBasic(merged),
    runOpenAIFunctionCalling(merged),
    runOpenAIJsonMode(merged),
  ]);
  return { basic, functionCalling, jsonMode };
};
