import assert from 'node:assert/strict';
import { APIEndpoint } from '../types';
import { createEndpointProtectionEventQueue } from './apiProtection';

const endpoint: APIEndpoint = {
  id: 'ep-queue',
  name: 'queue-endpoint',
  enabled: true,
  provider: 'openai',
  apiKey: 'k',
  baseUrl: 'https://example.com',
  model: 'm',
  concurrency: 3,
};

const endpointStore = new Map<string, APIEndpoint>([[endpoint.id, endpoint]]);
const logs: string[] = [];

const queue = createEndpointProtectionEventQueue({
  getEndpoint: (endpointId) => endpointStore.get(endpointId),
  commitEndpoint: (endpointId, nextEndpoint) => endpointStore.set(endpointId, nextEndpoint),
  log: (level, message) => logs.push(`${level}:${message}`),
});

await queue.enqueue({
  endpointId: endpoint.id,
  eventSeq: 2,
  eventType: 'REQUEST_FAILED',
  apply: (current) => ({ ...current, consecutiveErrors: 2 }),
});

await queue.enqueue({
  endpointId: endpoint.id,
  eventSeq: 1,
  eventType: 'REQUEST_FAILED',
  apply: (current) => ({ ...current, consecutiveErrors: 99 }),
});

await queue.enqueue({
  endpointId: endpoint.id,
  eventSeq: 3,
  eventType: 'BATCH_SUCCEEDED',
  apply: (current) => ({ ...current, consecutiveErrors: 0 }),
});

const finalState = endpointStore.get(endpoint.id)!;
assert.equal(finalState.consecutiveErrors, 0);
assert.equal(finalState.lastEventSeq, 3);
assert.ok(logs.some(line => line.includes('drop stale')));

console.log('apiProtectionEventQueue tests passed (stale drop + seq gate)');
