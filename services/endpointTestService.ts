import { AIConfig, APIEndpoint, mergeEndpointConfig } from '../types';
import { GoogleGenAI, FunctionCallingConfigMode, Type } from '@google/genai';

export interface EndpointSingleTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  status: 'pass' | 'fail' | 'skipped' | 'not_tested';
}

export interface EndpointCapabilityTestResult {
  basic: EndpointSingleTestResult;
  functionCalling: EndpointSingleTestResult;
  jsonMode: EndpointSingleTestResult;
}

export interface EndpointCapabilityTestSettings {
  testFunctionCalling: boolean;
  testJsonMode: boolean;
}

export const DEFAULT_ENDPOINT_CAPABILITY_TEST_SETTINGS: EndpointCapabilityTestSettings = {
  testFunctionCalling: false,
  testJsonMode: false,
};

const buildTestResult = (
  ok: boolean,
  message: string,
  latencyMs: number,
  status: EndpointSingleTestResult['status'] = ok ? 'pass' : 'fail',
): EndpointSingleTestResult => ({ ok, message, latencyMs, status });

const createNotTestedResult = (message = 'Not tested'): EndpointSingleTestResult => (
  buildTestResult(false, message, 0, 'not_tested')
);

const createSkippedResult = (message = 'Skipped'): EndpointSingleTestResult => (
  buildTestResult(false, message, 0, 'skipped')
);

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
    return buildTestResult(ok, ok ? 'Basic request succeeded' : 'No expected response text', Math.round(now() - start));
  } catch (e: any) {
    return buildTestResult(false, formatErr(e), Math.round(now() - start));
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
    return buildTestResult(called, called ? 'Function call returned' : 'No function call returned', Math.round(now() - start));
  } catch (e: any) {
    return buildTestResult(false, formatErr(e), Math.round(now() - start));
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
    return buildTestResult(ok, ok ? 'Valid JSON response' : 'JSON parsed but expected key missing', Math.round(now() - start));
  } catch (e: any) {
    return buildTestResult(false, formatErr(e), Math.round(now() - start));
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
      return buildTestResult(false, data?.error?.message || `HTTP ${response.status}`, Math.round(now() - start));
    }
    const text = (data?.choices?.[0]?.message?.content || '').toLowerCase();
    const ok = text.includes('ok');
    return buildTestResult(ok, ok ? 'Basic request succeeded' : 'No expected response text', Math.round(now() - start));
  } catch (e: any) {
    return buildTestResult(false, formatErr(e), Math.round(now() - start));
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
      return buildTestResult(false, data?.error?.message || `HTTP ${response.status}`, Math.round(now() - start));
    }
    const toolCalls = data?.choices?.[0]?.message?.tool_calls || [];
    const ok = toolCalls.length > 0;
    return buildTestResult(ok, ok ? 'Function call returned' : 'No function call returned', Math.round(now() - start));
  } catch (e: any) {
    return buildTestResult(false, formatErr(e), Math.round(now() - start));
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
      return buildTestResult(false, data?.error?.message || `HTTP ${response.status}`, Math.round(now() - start));
    }

    const content = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const ok = parsed?.ok === true;
    return buildTestResult(ok, ok ? 'Valid JSON response' : 'JSON parsed but expected key missing', Math.round(now() - start));
  } catch (e: any) {
    return buildTestResult(false, formatErr(e), Math.round(now() - start));
  }
};

export const runConfiguredEndpointCapabilityTests = async (
  settings: EndpointCapabilityTestSettings,
  runners: {
    runBasic: () => Promise<EndpointSingleTestResult>;
    runFunctionCalling: () => Promise<EndpointSingleTestResult>;
    runJsonMode: () => Promise<EndpointSingleTestResult>;
  },
): Promise<EndpointCapabilityTestResult> => {
  const basic = await runners.runBasic();

  if (!basic.ok) {
    return {
      basic,
      functionCalling: settings.testFunctionCalling ? createSkippedResult('Skipped due to basic failure') : createNotTestedResult(),
      jsonMode: settings.testJsonMode ? createSkippedResult('Skipped due to basic failure') : createNotTestedResult(),
    };
  }

  const functionCalling = settings.testFunctionCalling
    ? await runners.runFunctionCalling()
    : createNotTestedResult();
  const jsonMode = settings.testJsonMode
    ? await runners.runJsonMode()
    : createNotTestedResult();

  return { basic, functionCalling, jsonMode };
};

export const runEndpointCapabilityTests = async (
  globalConfig: AIConfig,
  endpoint: APIEndpoint,
  settings: EndpointCapabilityTestSettings = DEFAULT_ENDPOINT_CAPABILITY_TEST_SETTINGS,
): Promise<EndpointCapabilityTestResult> => {
  const merged = mergeEndpointConfig(globalConfig, endpoint);

  if (endpoint.provider === 'gemini') {
    return runConfiguredEndpointCapabilityTests(settings, {
      runBasic: () => runGeminiBasic(merged),
      runFunctionCalling: () => runGeminiFunctionCalling(merged),
      runJsonMode: () => runGeminiJsonMode(merged),
    });
  }

  return runConfiguredEndpointCapabilityTests(settings, {
    runBasic: () => runOpenAIBasic(merged),
    runFunctionCalling: () => runOpenAIFunctionCalling(merged),
    runJsonMode: () => runOpenAIJsonMode(merged),
  });
};
