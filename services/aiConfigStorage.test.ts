import assert from 'node:assert/strict';
import type { AIConfig } from '../types.ts';
import { DEFAULT_TRANSLATION_PROMPT_PRESET } from '../types.ts';
import {
  AI_CONFIG_STORAGE_KEY,
  exportAiConfigJson,
  isImportableAiConfig,
  loadAiConfigFromStorage,
  saveAiConfigToStorage,
} from './aiConfigStorage.ts';

const createStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
};

const defaultConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  endpoints: [],
  systemPrompt: 'prompt',
  translationPromptPreset: DEFAULT_TRANSLATION_PROMPT_PRESET,
  defaultFontSize: 1,
  language: 'en',
  defaultMaskShape: 'rectangle',
  defaultMaskCornerRadius: 20,
  defaultMaskFeather: 0,
  defaultFontFamily: 'noto',
  defaultTextColor: '#000000',
  defaultStrokeColor: '#ffffff',
  defaultBackgroundColor: '#ffffff',
  defaultLetterSpacing: 0.1,
  defaultLineHeight: 1.1,
  defaultIsVertical: false,
  customMessages: [{ role: 'user', content: 'translate' }],
  textDetectionApiUrl: 'http://localhost:5000',
  inpaintingUrl: 'http://localhost:8080',
} as AIConfig;

const storage = createStorage();
const configWithTransientState = {
  ...defaultConfig,
  model: 'gpt-4o-mini',
  endpoints: [{
    id: 'ep-1',
    name: 'Endpoint 1',
    enabled: true,
    provider: 'openai',
    apiKey: 'secret',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    concurrency: 5,
    effectiveConcurrency: 10,
    protectionMode: 'normal',
    pausedUntil: 123,
    disableReasonCode: 'HTTP_429',
    disableReasonMessage: 'rate limited',
    protectionEpoch: 2,
  }],
  modelCache: ['should-not-export'],
  endpointTestSettings: { 'ep-1': { testFunctionCalling: true } },
} as AIConfig & {
  modelCache: string[];
  endpointTestSettings: Record<string, { testFunctionCalling: boolean }>;
};

saveAiConfigToStorage(storage, configWithTransientState);
const storedJson = storage.getItem(AI_CONFIG_STORAGE_KEY);
assert.ok(storedJson, 'saveAiConfigToStorage should persist config');
const storedPayload = JSON.parse(storedJson!);
assert.equal('modelCache' in storedPayload, false, 'browser model cache should not be persisted into AIConfig storage');
assert.equal('endpointTestSettings' in storedPayload, false, 'test settings should not be persisted into AIConfig storage');
assert.equal('effectiveConcurrency' in storedPayload.endpoints[0], false, 'runtime effectiveConcurrency should not be persisted into AIConfig storage');
assert.equal(storedPayload.endpoints[0].pausedUntil, 123, 'pausedUntil should remain persisted to preserve protection semantics');
assert.equal(storedPayload.endpoints[0].disableReasonCode, 'HTTP_429', 'disableReasonCode should remain persisted to preserve protection semantics');
assert.equal(storedPayload.endpoints[0].disableReasonMessage, 'rate limited', 'disableReasonMessage should remain persisted to preserve protection semantics');
assert.equal(storedPayload.endpoints[0].protectionEpoch, 2, 'protectionEpoch should remain persisted to preserve protection semantics');
assert.equal(storedPayload.translationPromptPreset, DEFAULT_TRANSLATION_PROMPT_PRESET, 'translation prompt preset should be persisted');

const exportedPayload = JSON.parse(exportAiConfigJson(configWithTransientState));
assert.equal('modelCache' in exportedPayload, false, 'exported JSON should exclude model cache');
assert.equal('endpointTestSettings' in exportedPayload, false, 'exported JSON should exclude transient test settings');
assert.equal('effectiveConcurrency' in exportedPayload.endpoints[0], false, 'exported JSON should exclude runtime effectiveConcurrency');
assert.equal(exportedPayload.translationPromptPreset, DEFAULT_TRANSLATION_PROMPT_PRESET, 'exported JSON should include translation prompt preset');

assert.equal(isImportableAiConfig({ provider: 'openai' }), true, 'legacy flat config should remain importable');
assert.equal(isImportableAiConfig({ language: 'zh' }), true, 'language-only snapshot should remain importable');
assert.equal(isImportableAiConfig({ foo: 'bar' }), false, 'unrelated objects should be rejected');

storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
  provider: 'openai',
  apiKey: 'legacy-key',
  baseUrl: 'https://legacy.example/v1',
  model: 'legacy-model',
  modelSupportsFunctionCalling: false,
  modelSupportsJsonMode: false,
  language: 'en',
  textDetectionApiUrl: 'http://localhost:5000',
  inpaintingUrl: 'http://localhost:8080',
}));

const loaded = loadAiConfigFromStorage(storage, {
  defaultConfig,
  runtimeConfig: {
    TEXT_DETECTION_API_URL: 'https://runtime.example/text',
    IOPAINT_API_URL: 'https://runtime.example/inpaint',
  },
  createEndpointId: () => 'migrated-endpoint',
});

assert.equal(loaded.endpoints.length, 1, 'legacy flat config should migrate to a single endpoint');
assert.equal(loaded.endpoints[0].id, 'migrated-endpoint', 'migrated endpoint should use injected id factory');
assert.equal(loaded.endpoints[0].provider, 'openai', 'migrated endpoint should preserve provider');
assert.equal(loaded.endpoints[0].modelSupportsFunctionCalling, false, 'migrated endpoint should preserve FC capability override');
assert.equal(loaded.endpoints[0].modelSupportsJsonMode, false, 'migrated endpoint should preserve JSON capability override');
assert.equal(loaded.textDetectionApiUrl, 'https://runtime.example/text', 'runtime text detection URL should override legacy localhost default');
assert.equal(loaded.inpaintingUrl, 'https://runtime.example/inpaint', 'runtime inpainting URL should override legacy localhost default');
assert.equal(loaded.translationPromptPreset, DEFAULT_TRANSLATION_PROMPT_PRESET, 'missing preset should fall back to contextual default');

storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
  translationPromptPreset: 'broken-preset',
  systemPrompt: 'custom prompt',
  customMessages: [{ role: 'assistant', content: 'keep me' }],
}));

const loadedWithDirtyPreset = loadAiConfigFromStorage(storage, {
  defaultConfig,
  runtimeConfig: {},
});

assert.equal(loadedWithDirtyPreset.translationPromptPreset, DEFAULT_TRANSLATION_PROMPT_PRESET, 'invalid preset should fall back to contextual default');
assert.equal(loadedWithDirtyPreset.systemPrompt, 'custom prompt', 'systemPrompt should still round-trip when preset falls back');
assert.deepEqual(loadedWithDirtyPreset.customMessages, [{ role: 'assistant', content: 'keep me' }], 'customMessages should still round-trip when preset falls back');

console.log('aiConfigStorage tests passed');
