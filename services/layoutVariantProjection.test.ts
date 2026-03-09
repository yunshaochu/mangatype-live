import assert from 'node:assert/strict';

import {
  buildActiveBubbleFontSizeUpdate,
  getActiveBubbleLayoutState,
  getAdjacentBubbleLayoutIndex,
} from './layoutVariantProjection.ts';

const bubble = {
  text: '主结果',
  fontSize: 1.3,
  activeLayoutIndex: 1,
  layoutVariants: [
    { text: '一二\n三四\n五六', fontSize: 1.1 },
  ],
} as any;

assert.deepEqual(
  getActiveBubbleLayoutState(bubble),
  {
    activeLayoutIndex: 1,
    totalLayoutCount: 2,
    hasVariants: true,
    text: '一二\n三四\n五六',
    fontSize: 1.1,
  },
  'projection should resolve the active candidate text and font size from a single helper',
);

assert.equal(getAdjacentBubbleLayoutIndex(bubble, 'prev'), 0, 'previous variant should move back to the main result');
assert.equal(getAdjacentBubbleLayoutIndex({ activeLayoutIndex: 0, layoutVariants: [{ text: '候选' }] } as any, 'next'), 1, 'next variant should move to the first extra candidate');
assert.deepEqual(
  buildActiveBubbleFontSizeUpdate(bubble, 1.4),
  { layoutVariants: [{ text: '一二\n三四\n五六', fontSize: 1.4 }] },
  'font size edits on an active candidate should stay on that candidate',
);
assert.deepEqual(
  buildActiveBubbleFontSizeUpdate({ activeLayoutIndex: 0, layoutVariants: [], fontSize: 1.3 } as any, 1.5),
  { fontSize: 1.5 },
  'font size edits on the main result should keep updating the base bubble fontSize',
);

console.log('layoutVariantProjection tests passed');
