import assert from 'node:assert/strict';
import { getDisplayedProviderModels } from './providerModelFilter';

const models = ['gpt-4o-mini', 'gpt-4.1-mini', 'gemini-2.5-pro'];

assert.deepEqual(
  getDisplayedProviderModels(models, ''),
  models,
  'empty input should show full model list',
);

assert.deepEqual(
  getDisplayedProviderModels(models, 'gpt-4o-mini'),
  models,
  'exact match should fall back to full list so users can still switch models',
);

assert.deepEqual(
  getDisplayedProviderModels(models, '4.1'),
  ['gpt-4.1-mini'],
  'partial keyword should keep only matching models',
);

assert.deepEqual(
  getDisplayedProviderModels(models, 'no-such-model'),
  models,
  'no matches should fall back to full list',
);

console.log('providerModelFilter tests passed');
