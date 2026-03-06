import assert from 'node:assert/strict';
import {
  parseOpenAIToolCallArguments,
} from './geminiService';
import { FAILURE_CODE_PARSE_BUBBLES_INVALID } from './apiProtection';

const validResult = parseOpenAIToolCallArguments({
  function: {
    arguments: '{"bubbles":[{"text":"a"}]}',
  },
});
assert.equal(Array.isArray(validResult.bubbles), true, 'valid arguments should parse into object');

const repairedResult = parseOpenAIToolCallArguments({
  function: {
    arguments: '{"bubbles":[{"text":"line1\nline2"}]}',
  },
});
assert.equal(repairedResult.bubbles[0].text.includes('\n'), true, 'repairJson fallback should preserve newline text');

assert.throws(
  () => parseOpenAIToolCallArguments({ function: {} }),
  (error: any) => error?.code === FAILURE_CODE_PARSE_BUBBLES_INVALID,
  'missing arguments should throw parse failure code'
);

assert.throws(
  () => parseOpenAIToolCallArguments({ function: { arguments: 123 } }),
  (error: any) => error?.code === FAILURE_CODE_PARSE_BUBBLES_INVALID,
  'non-string arguments should throw parse failure code'
);

assert.throws(
  () => parseOpenAIToolCallArguments({ function: { arguments: '{"bubbles": [invalid-json' } }),
  (error: any) => error?.code === FAILURE_CODE_PARSE_BUBBLES_INVALID && !!error?.cause,
  'unrepairable arguments should throw parse failure code and keep cause'
);

console.log('geminiServiceOpenAIToolArgs tests passed');
