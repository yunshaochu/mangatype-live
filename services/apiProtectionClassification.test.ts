import assert from 'node:assert/strict';
import {
  FAILURE_CODE_HTTP_429,
  FAILURE_CODE_HTTP_503,
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
  FAILURE_CODE_UNKNOWN,
  classifyEndpointFailure,
  getRemainingPauseTime,
  handleEndpointError,
  isEndpointPaused,
  isProtectableError,
} from './apiProtection.ts';
import type { APIEndpoint } from '../types.ts';

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

type ClassifyCase = {
  name: string;
  input: any;
  code: string;
  shouldProtect: boolean;
  statusCode?: number;
};

const classifyCases: ClassifyCase[] = [
  {
    name: 'http_429',
    input: { status: 429, message: 'Too Many Requests' },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'http_503',
    input: { status: 503, message: 'Service Unavailable' },
    code: FAILURE_CODE_HTTP_503,
    shouldProtect: true,
    statusCode: 503,
  },
  {
    name: 'rate_limit_structured_response_data_error_code',
    input: {
      status: 200,
      response: { status: 200, data: { error: { code: 'rate_limit_exceeded' } } },
    },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'rate_limit_structured_top_level_code',
    input: { status: 200, code: 'rate_limit_exceeded' },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'rate_limit_structured_response_data_error_type',
    input: {
      status: 200,
      response: { status: 200, data: { error: { type: 'rate_limit_exceeded' } } },
    },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'rate_limit_structured_top_level_type',
    input: { status: 200, type: 'rate_limit_exceeded' },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'rate_limit_structured_in_cause_code',
    input: {
      message: 'wrapped error',
      cause: { code: 'rate_limit_exceeded' },
    },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'rate_limit_chinese_message_keyword',
    input: { message: '调用频率限制，请稍后再试' },
    code: FAILURE_CODE_HTTP_429,
    shouldProtect: true,
    statusCode: 429,
  },
  {
    name: 'network_failed_to_fetch',
    input: { message: 'Failed to fetch' },
    code: FAILURE_CODE_HTTP_503,
    shouldProtect: true,
    statusCode: 503,
  },
  {
    name: 'openai_tool_args_parse_failure',
    input: { message: 'OpenAI tool call arguments parse failed: Unexpected token' },
    code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    shouldProtect: true,
  },
  {
    name: 'empty_response',
    input: { message: 'Gemini JSON mode response returned empty response; expected {"bubbles":[...]}.' },
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
    name: 'message_only_non_parse',
    input: { message: 'socket reset by peer' },
    code: FAILURE_CODE_UNKNOWN,
    shouldProtect: false,
  },
  {
    name: 'unknown_remote_with_response',
    input: {
      status: 200,
      response: { status: 200, data: { error: { message: 'some remote wrapper failure' } } },
      message: 'OpenAI API Error: some remote wrapper failure',
    },
    code: FAILURE_CODE_UNKNOWN,
    shouldProtect: true,
  },
];

for (const testCase of classifyCases) {
  const result = classifyEndpointFailure(testCase.input);
  assert.equal(result.code, testCase.code, `code mismatch: ${testCase.name}`);
  assert.equal(result.shouldProtect, testCase.shouldProtect, `protect flag mismatch: ${testCase.name}`);
  if (typeof testCase.statusCode === 'number') {
    assert.equal(result.statusCode, testCase.statusCode, `status mismatch: ${testCase.name}`);
  }
}

const protectRemoteUnknown = isProtectableError({
  status: 200,
  response: { status: 200, data: { error: { message: 'some remote wrapper failure' } } },
  message: 'OpenAI API Error: some remote wrapper failure',
});
assert.equal(protectRemoteUnknown.shouldProtect, true);

const protectLocalUnknown = isProtectableError({ message: 'socket reset by peer' });
assert.equal(protectLocalUnknown.shouldProtect, false);

const protectChineseRateLimit = isProtectableError({ message: '调用频率限制，请稍后再试' });
assert.equal(protectChineseRateLimit.shouldProtect, true);
assert.equal(protectChineseRateLimit.statusCode, 429);

const protectionConfig = { durations: [30, 60, 120, 300, 600], disableThreshold: 2 };
const endpoint429 = handleEndpointError(createEndpoint(), { status: 429, message: '429' }, protectionConfig);
const endpoint503 = handleEndpointError(createEndpoint(), { status: 503, message: '503' }, protectionConfig);
const endpointParse = handleEndpointError(createEndpoint(), { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'invalid bubbles' }, protectionConfig);
const endpointWrappedParse = handleEndpointError(createEndpoint(), {
  message: 'wrapped parse failure',
  cause: { code: FAILURE_CODE_PARSE_BUBBLES_INVALID, message: 'failed inside provider wrapper' },
}, protectionConfig);
const endpointAbort = handleEndpointError(createEndpoint(), { name: 'AbortError', message: 'Aborted by user' }, protectionConfig);

assert.equal(endpoint429.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpoint503.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointParse.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointWrappedParse.updatedEndpoint.consecutiveErrors, 1);
assert.equal(endpointAbort.updatedEndpoint.consecutiveErrors, undefined);
assert.ok((endpoint429.updatedEndpoint.pausedUntil || 0) > 0);
assert.ok((endpoint503.updatedEndpoint.pausedUntil || 0) > 0);
assert.ok((endpointParse.updatedEndpoint.pausedUntil || 0) > 0);
assert.ok((endpointWrappedParse.updatedEndpoint.pausedUntil || 0) > 0);
assert.equal(endpoint429.shouldDisable, false);
assert.equal(endpoint503.shouldDisable, false);
assert.equal(endpointParse.shouldDisable, false);
assert.equal(endpointWrappedParse.shouldDisable, false);
assert.equal(endpointAbort.shouldDisable, false);

const NOW_MS = 1_700_000_000_000;
const pausedEndpoint: APIEndpoint = {
  ...createEndpoint(),
  pausedUntil: NOW_MS + 2_500,
};

assert.equal(isEndpointPaused(pausedEndpoint, NOW_MS), true);
assert.equal(getRemainingPauseTime(pausedEndpoint, NOW_MS), 3);
assert.equal(isEndpointPaused(pausedEndpoint, NOW_MS + 2_500), false);
assert.equal(getRemainingPauseTime(pausedEndpoint, NOW_MS + 2_500), 0);

const originalDateNow = Date.now;
Date.now = () => NOW_MS;
try {
  assert.equal(isEndpointPaused(pausedEndpoint), true);
  assert.equal(getRemainingPauseTime(pausedEndpoint), 3);
} finally {
  Date.now = originalDateNow;
}

console.log('apiProtectionClassification tests passed (429 + parse + abort)');
