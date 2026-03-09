import assert from 'node:assert/strict';

import {
  buildActiveBubbleFontSizeUpdate,
  buildSteppedActiveBubbleFontSizeUpdate,
  getActiveBubbleLayoutState,
  getAdjacentBubbleLayoutIndex,
  getBubbleLayoutNavigationState,
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

assert.equal(getAdjacentBubbleLayoutIndex(bubble, 'prev'), 1, 'previous navigation should stay on the smallest available candidate when no even smaller option exists');
assert.equal(getAdjacentBubbleLayoutIndex(bubble, 'next'), 0, 'next navigation from a smaller candidate should move back toward the main result');
assert.equal(getAdjacentBubbleLayoutIndex({ activeLayoutIndex: 0, layoutVariants: [{ text: '候选' }] } as any, 'next'), 1, 'next variant should move to the first extra candidate');
const sortedNavigationBubble = {
  text: '主结果',
  fontSize: 1.0,
  activeLayoutIndex: 0,
  layoutVariants: [
    { text: '大号候选', fontSize: 1.2 },
    { text: '小号候选', fontSize: 0.9 },
    { text: '中大候选', fontSize: 1.1 },
    { text: '更小候选', fontSize: 0.8 },
  ],
} as any;
assert.equal(getAdjacentBubbleLayoutIndex(sortedNavigationBubble, 'prev'), 2, 'previous navigation from the main result should prefer the nearest smaller-font candidate');
assert.equal(getAdjacentBubbleLayoutIndex(sortedNavigationBubble, 'next'), 3, 'next navigation from the main result should prefer the nearest larger-font candidate');
assert.equal(
  getAdjacentBubbleLayoutIndex({ ...sortedNavigationBubble, activeLayoutIndex: 2 }, 'prev'),
  4,
  'moving further left should continue toward smaller-font candidates',
);
assert.equal(
  getAdjacentBubbleLayoutIndex({ ...sortedNavigationBubble, activeLayoutIndex: 3 }, 'next'),
  1,
  'moving further right should continue toward larger-font candidates',
);
assert.deepEqual(
  getBubbleLayoutNavigationState(sortedNavigationBubble),
  {
    activeSelectionPosition: 2,
    canGoPrev: true,
    canGoNext: true,
    currentCandidateOrder: null,
    totalCandidateCount: 4,
  },
  'navigation state should place the main result between smaller and larger candidates',
);
assert.deepEqual(
  buildActiveBubbleFontSizeUpdate(bubble, 1.4),
  { layoutVariants: [{ text: '一二\n三四\n五六', fontSize: 1.4 }] },
  'font size edits on an active candidate should stay on that candidate',
);
assert.deepEqual(
  buildSteppedActiveBubbleFontSizeUpdate(bubble, 1),
  { layoutVariants: [{ text: '一二\n三四\n五六', fontSize: 1.2 }] },
  'stepped font size edits should start from the active candidate font size',
);
assert.deepEqual(
  buildActiveBubbleFontSizeUpdate({ activeLayoutIndex: 0, layoutVariants: [], fontSize: 1.3 } as any, 1.5),
  { fontSize: 1.5 },
  'font size edits on the main result should keep updating the base bubble fontSize',
);
assert.deepEqual(
  buildSteppedActiveBubbleFontSizeUpdate({ activeLayoutIndex: 1, layoutVariants: [{ text: '候选' }], fontSize: 1.3 } as any, 1),
  { layoutVariants: [{ text: '候选', fontSize: 1.4 }] },
  'stepped candidate edits should fall back to the bubble font size when the active candidate has no override yet',
);

console.log('layoutVariantProjection tests passed');
