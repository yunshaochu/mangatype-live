import assert from 'node:assert/strict';
import { extractAndValidateBubblesFromText } from './geminiService';
import { FAILURE_CODE_PARSE_BUBBLES_INVALID } from './apiProtection';

assert.throws(
  () => extractAndValidateBubblesFromText('', 'test-empty-response'),
  (error: any) => error?.code === FAILURE_CODE_PARSE_BUBBLES_INVALID,
  'empty response should throw parse failure code'
);

assert.throws(
  () => extractAndValidateBubblesFromText('{"foo":1}', 'test-missing-bubbles'),
  (error: any) => error?.code === FAILURE_CODE_PARSE_BUBBLES_INVALID,
  'missing bubbles key should throw parse failure code'
);

assert.throws(
  () => extractAndValidateBubblesFromText('{"bubbles":{"x":1}}', 'test-non-array-bubbles'),
  (error: any) => error?.code === FAILURE_CODE_PARSE_BUBBLES_INVALID,
  'non-array bubbles should throw parse failure code'
);

const emptyBubbles = extractAndValidateBubblesFromText('{"bubbles":[]}', 'test-empty-bubbles-array');
assert.equal(Array.isArray(emptyBubbles), true, 'empty bubbles payload should still be an array');
assert.equal(emptyBubbles.length, 0, 'empty bubbles array should be accepted');

console.log('geminiServiceTranslationContract tests passed');
