import assert from 'node:assert/strict';
import {
  ENDPOINT_MODEL_CACHE_STORAGE_KEY,
  clearAllEndpointModelCaches,
  clearEndpointModelCache,
  readEndpointModelCache,
  writeEndpointModelCache,
} from './endpointModelCache';

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

const storage = createStorage();
const endpoint = {
  id: 'endpoint-openai',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'secret-key',
};

writeEndpointModelCache(storage, endpoint, ['gpt-4o-mini', 'gpt-4.1-mini']);
assert.deepEqual(
  readEndpointModelCache(storage, endpoint),
  ['gpt-4o-mini', 'gpt-4.1-mini'],
  'matching endpoint metadata should read back cached models',
);

const rawPayload = storage.getItem(ENDPOINT_MODEL_CACHE_STORAGE_KEY);
assert.ok(rawPayload, 'cache should persist under dedicated storage key');
assert.equal(rawPayload!.includes('secret-key'), false, 'apiKey should never be written into model cache storage');
assert.equal(rawPayload!.includes('https://api.openai.com/v1'), true, 'baseUrl metadata should be present for invalidation');

assert.equal(
  readEndpointModelCache(storage, { ...endpoint, baseUrl: 'https://proxy.example/v1' }),
  null,
  'changing baseUrl should invalidate stale cached models',
);
assert.equal(
  readEndpointModelCache(storage, endpoint),
  null,
  'stale entry should be removed after metadata mismatch',
);

writeEndpointModelCache(storage, endpoint, ['gpt-4o']);
clearEndpointModelCache(storage, endpoint.id);
assert.equal(readEndpointModelCache(storage, endpoint), null, 'clearEndpointModelCache should remove a single endpoint cache');

writeEndpointModelCache(storage, endpoint, ['gpt-4o']);
writeEndpointModelCache(storage, { id: 'endpoint-gemini', provider: 'gemini', baseUrl: '' }, ['gemini-2.5-pro']);
clearAllEndpointModelCaches(storage);
assert.equal(storage.getItem(ENDPOINT_MODEL_CACHE_STORAGE_KEY), null, 'clearAllEndpointModelCaches should wipe all model cache entries');

console.log('endpointModelCache tests passed');
