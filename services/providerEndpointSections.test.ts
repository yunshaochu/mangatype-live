import assert from 'node:assert/strict';
import { buildProviderEndpointSections } from './providerEndpointSections';

const createEndpoint = (id: string, group?: string) => ({
  id,
  name: id,
  enabled: true,
  provider: 'openai' as const,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  group,
});

const ungroupedOnly = buildProviderEndpointSections([
  createEndpoint('ep-1'),
  createEndpoint('ep-2'),
]);
assert.equal(ungroupedOnly.length, 1, 'ungrouped-only list should still render a single section');
assert.equal(ungroupedOnly[0].isUngrouped, true, 'ungrouped-only section should be marked as ungrouped');
assert.deepEqual(ungroupedOnly[0].endpoints.map(endpoint => endpoint.id), ['ep-1', 'ep-2']);

const namedOnly = buildProviderEndpointSections([
  createEndpoint('ep-a', 'A'),
  createEndpoint('ep-b', 'B'),
]);
assert.deepEqual(
  namedOnly.map(section => ({ key: section.key, ids: section.endpoints.map(endpoint => endpoint.id) })),
  [
    { key: 'group:A', ids: ['ep-a'] },
    { key: 'group:B', ids: ['ep-b'] },
  ],
  'named groups should preserve appearance order and endpoint membership',
);

const mixed = buildProviderEndpointSections([
  createEndpoint('ep-a', 'A'),
  createEndpoint('ep-u1'),
  createEndpoint('ep-b', 'B'),
  createEndpoint('ep-u2'),
]);
assert.deepEqual(
  mixed.map(section => ({ key: section.key, isUngrouped: section.isUngrouped, ids: section.endpoints.map(endpoint => endpoint.id) })),
  [
    { key: 'group:A', isUngrouped: false, ids: ['ep-a'] },
    { key: 'group:B', isUngrouped: false, ids: ['ep-b'] },
    { key: 'group:__ungrouped__', isUngrouped: true, ids: ['ep-u1', 'ep-u2'] },
  ],
  'mixed mode should keep named groups intact and append a shared ungrouped section',
);

console.log('providerEndpointSections tests passed');
