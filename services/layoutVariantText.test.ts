import assert from 'node:assert/strict';

import {
  applyBreakAfterToBaseText,
  deriveBaseText,
  normalizeBreakAfter,
} from './layoutVariantText.ts';

assert.equal(
  deriveBaseText('今天\r\n 晚上一起 \n走吧 '),
  '今天晚上一起走吧',
  'deriveBaseText should normalize line endings and trim each line before joining',
);

assert.equal(
  deriveBaseText('Hello\nworld'),
  'Hello world',
  'deriveBaseText should keep a necessary space between split ASCII words',
);

assert.equal(
  deriveBaseText('第1\nseason'),
  '第1 season',
  'deriveBaseText should preserve necessary spacing when a numeric token continues with ASCII text',
);

assert.deepEqual(
  normalizeBreakAfter('abcdef', [4, 2, 2, 99, 0, -1, 3.8]),
  [2, 3, 4],
  'normalizeBreakAfter should sort, de-duplicate and clamp break points to a deterministic range',
);

assert.equal(
  applyBreakAfterToBaseText('一二三四五六', [2, 4]),
  '一二\n三四\n五六',
  'applyBreakAfterToBaseText should treat breakAfter as 1-based indexes',
);

assert.equal(
  applyBreakAfterToBaseText('abc', [9]),
  'abc',
  'applyBreakAfterToBaseText should safely ignore out-of-range break points',
);

assert.equal(applyBreakAfterToBaseText('', [1]), '', 'empty base text should stay safe');
assert.equal(applyBreakAfterToBaseText('单行', undefined), '单行', 'single-line base text should not throw without break points');

console.log('layoutVariantText tests passed');
