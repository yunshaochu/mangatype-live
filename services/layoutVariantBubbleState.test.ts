import assert from 'node:assert/strict';

import {
  buildMainTextChangeUpdates,
  initializeBubbleLayoutState,
} from './layoutVariantBubbleState.ts';

const initialized = initializeBubbleLayoutState({
  text: 'Hello\nworld',
  layoutVariants: [{ text: 'Hello\nworld', fontSize: 1.1 }],
} as any);

assert.equal('baseText' in (initialized as Record<string, unknown>), false, 'initial layout state should not derive legacy baseText');
assert.equal(initialized.activeLayoutIndex, 0, 'initial layout state should always start from the main result');
assert.deepEqual(initialized.layoutVariants, [{ text: 'Hello\nworld', fontSize: 1.1 }], 'initial layout state should keep valid layout variants');

const changeUpdates = buildMainTextChangeUpdates({ text: '主结果' } as any, '新的\n主结果');
assert.deepEqual(
  changeUpdates,
  {
    text: '新的\n主结果',
    layoutVariants: undefined,
    activeLayoutIndex: 0,
  },
  'changing the main text should invalidate old layout variants and reset the active candidate',
);

assert.deepEqual(
  buildMainTextChangeUpdates({ text: '不变' } as any, '不变'),
  { text: '不变' },
  'unchanged main text should not eagerly clear layout variants',
);

console.log('layoutVariantBubbleState tests passed');
