import assert from 'node:assert/strict';
import {
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
  FAILURE_CODE_UNKNOWN,
  classifyEndpointFailure,
} from './apiProtection.ts';

type BaselineCase = {
  name: string;
  branch: 'gemini' | 'openai_tool_calls' | 'unknown';
  messageSource: string;
  input: any;
  expectedCode: string;
  expectedProtect: boolean;
  expectedStatus?: number;
};

const baselineCases: BaselineCase[] = [
  {
    name: 'gemini_missing_bubbles',
    branch: 'gemini',
    messageSource: 'validateBubblesArray -> missing bubbles key',
    input: {
      code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
      message: "AI response missing 'bubbles' key. The model failed to follow the schema.",
    },
    expectedCode: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    expectedProtect: true,
  },
  {
    name: 'openai_tool_args_parse_failure',
    branch: 'openai_tool_calls',
    messageSource: 'parseOpenAIToolCallArguments -> JSON.parse/repairJson both failed',
    input: {
      code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
      message: 'OpenAI tool call arguments parse failed: Unexpected token',
    },
    expectedCode: FAILURE_CODE_PARSE_BUBBLES_INVALID,
    expectedProtect: true,
  },
  {
    name: 'unknown_transport_failure',
    branch: 'unknown',
    messageSource: 'transport/runtime error without status or parse code',
    input: {
      message: 'socket reset by peer',
    },
    expectedCode: FAILURE_CODE_UNKNOWN,
    expectedProtect: false,
  },
];

for (const testCase of baselineCases) {
  const result = classifyEndpointFailure(testCase.input);
  assert.equal(result.code, testCase.expectedCode, `code mismatch: ${testCase.name}`);
  assert.equal(result.shouldProtect, testCase.expectedProtect, `protect mismatch: ${testCase.name}`);
  if (typeof testCase.expectedStatus === 'number') {
    assert.equal(result.statusCode, testCase.expectedStatus, `status mismatch: ${testCase.name}`);
  }
}

console.log('parseFailureBaseline tests passed (gemini/openai_tool_calls/unknown)');
