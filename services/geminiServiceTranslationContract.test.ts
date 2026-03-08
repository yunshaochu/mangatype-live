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

const legacyBubbles = extractAndValidateBubblesFromText(
  '{"bubbles":[{"text":"hello","x":10,"y":20,"width":30,"height":40,"isVertical":false}]}',
  'test-legacy-bubbles-array',
);
assert.equal(legacyBubbles.length, 1, 'legacy core contract should still be accepted');
assert.equal(legacyBubbles[0].text, 'hello', 'legacy core contract should preserve text');

const contextualBubbles = extractAndValidateBubblesFromText(
  '{"bubbles":[{"sourceText":"こんにちは","context":{"speaker":"旁白","situation":"说明","preText":"","postText":"","translationHint":"自然一点"},"text":"hello","x":10,"y":20,"width":30,"height":40,"isVertical":false}]}',
  'test-contextual-bubbles-array',
);
assert.equal(contextualBubbles.length, 1, 'contextual contract should still be accepted');
assert.equal(contextualBubbles[0].context.speaker, '旁白', 'contextual contract should preserve context payload');

console.log('geminiServiceTranslationContract tests passed');
