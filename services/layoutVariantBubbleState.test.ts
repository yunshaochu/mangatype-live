import assert from 'node:assert/strict';

import {
  buildMainTextChangeUpdates,
  initializeBubbleLayoutState,
} from './layoutVariantBubbleState.ts';

const initialized = initializeBubbleLayoutState({
  text: 'Hello\nworld',
  layoutVariants: [{ breakAfter: [4], fontSize: 1.1 }],
} as any);

assert.equal(initialized.baseText, 'Hello world', 'initial layout state should derive baseText from the main text');
assert.equal(initialized.activeLayoutIndex, 0, 'initial layout state should always start from the main result');
assert.deepEqual(initialized.layoutVariants, [{ breakAfter: [4], fontSize: 1.1 }], 'initial layout state should keep valid layout variants');

const changeUpdates = buildMainTextChangeUpdates({ text: '主结果' } as any, '新的\n主结果');
assert.deepEqual(
  changeUpdates,
  {
    text: '新的\n主结果',
    baseText: '新的主结果',
    layoutVariants: undefined,
    activeLayoutIndex: 0,
  },
  'changing the main text should re-derive baseText and invalidate old layout variants',
);

assert.deepEqual(
  buildMainTextChangeUpdates({ text: '不变' } as any, '不变'),
  { text: '不变' },
  'unchanged main text should not eagerly clear layout variants',
);

console.log('layoutVariantBubbleState tests passed');
