import assert from 'node:assert/strict';
import {
  FAILURE_CODE_HTTP_429,
  classifyEndpointFailure,
  handleEndpointError,
  isEndpointPaused,
} from './apiProtection.ts';
import type { APIEndpoint } from '../types.ts';

const NOW_MS = 1_700_000_000_000;

const createEndpoint = (): APIEndpoint => ({
  id: 'ep-200-error-payload',
  name: 'endpoint-200-error-payload',
  enabled: true,
  provider: 'openai',
  apiKey: 'k',
  baseUrl: 'https://example.com',
  model: 'model',
  concurrency: 5,
});

const rateLimit200ErrorPayload = {
  status: 200,
  response: {
    status: 200,
    data: {
      error: {
        code: 'rate_limit_exceeded',
        type: 'rate_limit_exceeded',
      },
    },
  },
};

const classification = classifyEndpointFailure(rateLimit200ErrorPayload);
assert.equal(classification.code, FAILURE_CODE_HTTP_429);
assert.equal(classification.shouldProtect, true);
assert.equal(classification.statusCode, 429);

const originalDateNow = Date.now;
Date.now = () => NOW_MS;
try {
  const { updatedEndpoint } = handleEndpointError(createEndpoint(), rateLimit200ErrorPayload, {
    durations: [30, 60, 120, 300, 600],
    disableThreshold: 5,
  });

  assert.equal(updatedEndpoint.consecutiveErrors, 1);
  assert.equal(updatedEndpoint.pausedUntil, NOW_MS + 30_000);
  assert.equal(isEndpointPaused(updatedEndpoint, NOW_MS), true);
} finally {
  Date.now = originalDateNow;
}

console.log('apiProtection200ErrorPayloadPause tests passed (200+error payload -> pause)');
