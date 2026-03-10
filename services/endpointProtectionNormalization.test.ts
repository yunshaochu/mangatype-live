import assert from 'node:assert/strict';
import { normalizeEndpointProtectionState } from '../types.ts';

const baseEndpoint = {
  id: 'ep-normalize',
  name: 'endpoint-normalize',
  enabled: true,
  provider: 'openai',
  apiKey: 'k',
  baseUrl: 'https://example.com',
  model: 'model',
} as const;

const normalMismatch = normalizeEndpointProtectionState({
  ...baseEndpoint,
  concurrency: 5,
  effectiveConcurrency: 10,
  protectionMode: 'normal',
});
assert.equal(normalMismatch.concurrency, 5);
assert.equal(normalMismatch.protectionMode, 'normal');
assert.equal(normalMismatch.effectiveConcurrency, 5);

const legacyNormalMismatch = normalizeEndpointProtectionState({
  ...baseEndpoint,
  concurrency: 5,
  effectiveConcurrency: 10,
});
assert.equal(legacyNormalMismatch.protectionMode, 'normal');
assert.equal(legacyNormalMismatch.effectiveConcurrency, 5);

const degradedPreservesOverride = normalizeEndpointProtectionState({
  ...baseEndpoint,
  concurrency: 5,
  effectiveConcurrency: 2,
  protectionMode: 'degraded',
});
assert.equal(degradedPreservesOverride.protectionMode, 'degraded');
assert.equal(degradedPreservesOverride.concurrency, 5);
assert.equal(degradedPreservesOverride.effectiveConcurrency, 2);

const preservesPauseAndDisable = normalizeEndpointProtectionState({
  ...baseEndpoint,
  concurrency: 3,
  effectiveConcurrency: 9,
  protectionMode: 'normal',
  pausedUntil: 123,
  disableReasonCode: 'HTTP_429',
  disableReasonMessage: 'rate limited',
  disabledAt: 456,
});
assert.equal(preservesPauseAndDisable.pausedUntil, 123);
assert.equal(preservesPauseAndDisable.disableReasonCode, 'HTTP_429');
assert.equal(preservesPauseAndDisable.disableReasonMessage, 'rate limited');
assert.equal(preservesPauseAndDisable.disabledAt, 456);
assert.equal(preservesPauseAndDisable.effectiveConcurrency, 3);

console.log('endpointProtectionNormalization tests passed');
