import assert from 'node:assert/strict';
import { APIEndpoint } from '../types';
import { formatPauseDuration, getRemainingPauseTime, isEndpointPaused } from './apiProtection';

const NOW = 1_700_000_000_000;

const createEndpoint = (id: string, overrides: Partial<APIEndpoint> = {}): APIEndpoint => ({
  id,
  name: id,
  enabled: true,
  provider: 'openai',
  apiKey: 'k',
  baseUrl: 'https://example.com',
  model: 'test-model',
  concurrency: 2,
  ...overrides,
});

const originalDateNow = Date.now;
Date.now = () => NOW;

try {
  const normalEndpoints = [
    createEndpoint('normal-1'),
    createEndpoint('normal-2'),
  ];
  const normalAvailable = normalEndpoints.filter(ep => ep.enabled && !isEndpointPaused(ep));
  assert.equal(normalAvailable.length, 2, 'normal path should keep all endpoints available');

  const partialPausedEndpoints = [
    createEndpoint('paused-1', { pausedUntil: NOW + 30_000, lastError: 'HTTP_429' }),
    createEndpoint('active-1'),
  ];
  const partialAvailable = partialPausedEndpoints.filter(ep => ep.enabled && !isEndpointPaused(ep));
  assert.equal(partialAvailable.length, 1, 'partial paused path should keep one endpoint available');
  assert.equal(partialAvailable[0].id, 'active-1');
  assert.equal(getRemainingPauseTime(partialPausedEndpoints[0]), 30);
  assert.equal(formatPauseDuration(getRemainingPauseTime(partialPausedEndpoints[0])), '30s');

  const allPausedEndpoints = [
    createEndpoint('paused-a', { pausedUntil: NOW + 5_000 }),
    createEndpoint('paused-b', { pausedUntil: NOW + 61_000 }),
  ];
  const allPausedAvailable = allPausedEndpoints.filter(ep => ep.enabled && !isEndpointPaused(ep));
  assert.equal(allPausedAvailable.length, 0, 'all paused path should produce no available endpoint');
  assert.equal(formatPauseDuration(getRemainingPauseTime(allPausedEndpoints[0])), '5s');
  assert.equal(formatPauseDuration(getRemainingPauseTime(allPausedEndpoints[1])), '1m 1s');
} finally {
  Date.now = originalDateNow;
}

console.log('apiProtectionRuntimeCompat tests passed (normal + partial paused + all paused)');
