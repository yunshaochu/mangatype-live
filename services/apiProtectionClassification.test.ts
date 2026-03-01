import assert from 'node:assert/strict';
import {
  FAILURE_CODE_HTTP_429,
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
  FAILURE_CODE_UNKNOWN,
  classifyEndpointFailure,
  handleEndpointError,
} from './apiProtection';
import { APIEndpoint } from '../types';

const createEndpoint = (): APIEndpoint => ({
  id: 'ep-classify',
  name: 'endpoint-classify',
  enabled: true,
  provider: 'openai',
  apiKey: 'k',
  baseUrl: 'https://example.com',
  model: 'model',
  concurrency: 5,
});

const classifyCases = [
  {
    name: 'http_429',
    input: { status: 429, message: 'Too Many Requests' },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
  },
  {
    name: 'parse_invalid',
    input: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'AI response missing bubbles key' },
    code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    shouldProtect: true,
  },
  {
    name: 'unknown_failure',
    input: { message: 'socket reset by peer' },
    code: FAILURE_CODE_UNKNOWN,
    shouldProtect: false,
  },
];

for (const testCase of classifyCases) {
  const result = classifyEndpointFailure(testCase.input);
  assert.equal(result.code, testCase.code, `code mismatch: ${testCase.name}`);
  assert.equal(result.shouldProtect, testCase.shouldProtect, `protect flag mismatch: ${testCase.name}`);
}

const protectionConfig = { durations: [30, 60, 120, 300, 600], disableThreshold: 2 };
const endpoint429 = handleEndpointError(createEndpoint(), { status: 429, message: '429' }, protectionConfig);
const endpointParse = handleEndpointError(createEndpoint(), { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'invalid bubbles' }, protectionConfig);

assert.equal(endpoint429.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointParse.updatedEndpoint.consecutiveErrors, 1);
assert.ok((endpoint429.updatedEndpoint.pausedUntil || 0) > 0);
assert.ok((endpointParse.updatedEndpoint.pausedUntil || 0) > 0);
assert.equal(endpoint429.shouldDisable, false);
assert.equal(endpointParse.shouldDisable, false);

console.log('apiProtectionClassification tests passed (429 + parse equivalence)');
