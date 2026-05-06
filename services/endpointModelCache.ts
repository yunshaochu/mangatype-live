import { APIEndpoint } from '../types';

export const ENDPOINT_MODEL_CACHE_STORAGE_KEY = 'mangatype_live_model_cache_v1';

type EndpointModelCacheEntry = {
  endpointId: string;
  provider: APIEndpoint['provider'];
  baseUrl: string;
  models: string[];
  updatedAt: number;
};

type EndpointModelCacheMap = Record<string, EndpointModelCacheEntry>;

const readCacheMap = (storage: Storage): EndpointModelCacheMap => {
  const raw = storage.getItem(ENDPOINT_MODEL_CACHE_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as EndpointModelCacheMap;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const writeCacheMap = (storage: Storage, entries: EndpointModelCacheMap): void => {
  storage.setItem(ENDPOINT_MODEL_CACHE_STORAGE_KEY, JSON.stringify(entries));
};

export const readEndpointModelCache = (storage: Storage, endpoint: Pick<APIEndpoint, 'id' | 'provider' | 'baseUrl'>): string[] | null => {
  const entries = readCacheMap(storage);
  const entry = entries[endpoint.id];
  if (!entry) return null;

  if (
    entry.provider !== endpoint.provider
    || entry.baseUrl !== (endpoint.baseUrl || '')
    || !Array.isArray(entry.models)
    || entry.models.some(model => typeof model !== 'string')
  ) {
    delete entries[endpoint.id];
    writeCacheMap(storage, entries);
    return null;
  }

  return [...entry.models];
};

export const writeEndpointModelCache = (storage: Storage, endpoint: Pick<APIEndpoint, 'id' | 'provider' | 'baseUrl'>, models: string[]): void => {
  const entries = readCacheMap(storage);
  entries[endpoint.id] = {
    endpointId: endpoint.id,
    provider: endpoint.provider,
    baseUrl: endpoint.baseUrl || '',
    models: [...models],
    updatedAt: Date.now(),
  };
  writeCacheMap(storage, entries);
};

export const clearEndpointModelCache = (storage: Storage, endpointId: string): void => {
  const entries = readCacheMap(storage);
  if (!entries[endpointId]) return;
  delete entries[endpointId];
  writeCacheMap(storage, entries);
};

export const clearAllEndpointModelCaches = (storage: Storage): void => {
  storage.removeItem(ENDPOINT_MODEL_CACHE_STORAGE_KEY);
};
