import assert from 'node:assert/strict';
import { extractAndValidateBubblesFromText } from './geminiService.ts';
import { FAILURE_CODE_PARSE_BUBBLES_INVALID } from './apiProtection.ts';

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

const variantBubbles = extractAndValidateBubblesFromText(
  '{"bubbles":[{"text":"主结果","layoutVariants":[{"breakAfter":[4],"fontSize":1.2},{"breakAfter":[2,5],"fontSize":1.1}],"x":10,"y":20,"width":30,"height":40,"isVertical":false}]}',
  'test-layout-variants-array',
  { extraLayoutVariantCount: 1 },
);
assert.equal(variantBubbles[0].text, '主结果', 'group-0 text should remain on the top-level text field');
assert.equal(variantBubbles[0].layoutVariants?.length, 1, 'layout variants should respect extraLayoutVariantCount');
assert.deepEqual(variantBubbles[0].layoutVariants?.[0].breakAfter, [4], 'layout variants should preserve valid breakAfter values');

const zeroVariantBubbles = extractAndValidateBubblesFromText(
  '{"bubbles":[{"text":"主结果","layoutVariants":[{"breakAfter":[4],"fontSize":1.2}],"x":10,"y":20,"width":30,"height":40,"isVertical":false}]}',
  'test-layout-variants-disabled',
  { extraLayoutVariantCount: 0 },
);
assert.equal(zeroVariantBubbles[0].layoutVariants?.length, 1, 'unexpected returned layout variants should be preserved even when request count is zero');

const normalizedVariantBubbles = extractAndValidateBubblesFromText(
  '{"bubbles":[{"text":"主结果","layoutVariants":[{"breakAfter":[1,"x",3],"fontSize":1.2},{"foo":1}],"x":10,"y":20,"width":30,"height":40,"isVertical":false}]}',
  'test-layout-variants-normalized',
  { extraLayoutVariantCount: 2 },
);
assert.deepEqual(
  normalizedVariantBubbles[0].layoutVariants,
  [{ breakAfter: [1, 3], fontSize: 1.2 }],
  'invalid layout variant entries should be normalized away',
);

console.log('geminiServiceTranslationContract tests passed');
