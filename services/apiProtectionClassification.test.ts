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
    name: 'openai_tool_args_parse_failure',
    input: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'OpenAI tool call arguments parse failed: Unexpected token' },
    code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    shouldProtect: true,
  },
  {
    name: 'empty_response',
    input: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'Gemini JSON mode response returned empty response; expected {"bubbles":[...]}.' },
    code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    shouldProtect: true,
  },
  {
    name: 'missing_bubbles',
    input: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: "AI response missing 'bubbles' key. The model failed to follow the schema." },
    code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    shouldProtect: true,
  },
  {
    name: 'wrapped_parse_code_in_cause',
    input: {
      message: 'wrapped translate failure',
      cause: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'provider parse failed' },
    },
    code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    shouldProtect: true,
  },
  {
    name: 'abort_error',
    input: { name: 'AbortError', message: 'Aborted by user' },
    code: FAILURE_CODE_UNKNOWN,
    shouldProtect: false,
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
const endpointWrappedParse = handleEndpointError(createEndpoint(), {
  message: 'wrapped parse failure',
  cause: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'failed inside provider wrapper' },
}, protectionConfig);
const endpointAbort = handleEndpointError(createEndpoint(), { name: 'AbortError', message: 'Aborted by user' }, protectionConfig);

assert.equal(endpoint429.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointParse.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointWrappedParse.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointAbort.updatedEndpoint.consecutiveErrors, undefined);
assert.ok((endpoint429.updatedEndpoint.pausedUntil || 0) > 0);
assert.ok((endpointParse.updatedEndpoint.pausedUntil || 0) > 0);
assert.ok((endpointWrappedParse.updatedEndpoint.pausedUntil || 0) > 0);
assert.equal(endpoint429.shouldDisable, false);
assert.equal(endpointParse.shouldDisable, false);
assert.equal(endpointWrappedParse.shouldDisable, false);
assert.equal(endpointAbort.shouldDisable, false);

console.log('apiProtectionClassification tests passed (429 + parse + abort)');
