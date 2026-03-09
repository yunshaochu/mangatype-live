import assert from 'node:assert/strict';

import {
  normalizeDetectedBubbleLayoutState,
  normalizeImageContourState,
} from '../types.ts';

const legacyImage = {
  id: 'img-1',
  name: 'legacy.png',
  url: 'blob://legacy',
  base64: 'data:image/png;base64,legacy',
  originalUrl: 'blob://legacy',
  originalBase64: 'data:image/png;base64,legacy',
  width: 100,
  height: 100,
  bubbles: [{
    id: 'bubble-1',
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    text: 'legacy text',
    isVertical: false,
    fontFamily: 'noto',
    fontSize: 1.2,
    color: '#000000',
    backgroundColor: '#ffffff',
    rotation: 0,
  }],
  status: 'idle',
  detectionStatus: 'idle',
  inpaintingStatus: 'idle',
} as const;

const normalizedLegacyImage = normalizeImageContourState(legacyImage as any);
assert.equal(normalizedLegacyImage.bubbles[0].activeLayoutIndex, 0, 'legacy bubbles should receive a default active layout index');
assert.equal(normalizedLegacyImage.bubbles[0].layoutVariants, undefined, 'legacy bubbles should not invent layout variants');

const normalizedAgain = normalizeImageContourState(normalizedLegacyImage);
assert.equal(normalizedAgain, normalizedLegacyImage, 'bubble layout normalization should be idempotent');

const detected = normalizeDetectedBubbleLayoutState({
  text: 'translated text',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  isVertical: false,
  baseText: 123 as any,
  activeLayoutIndex: -2 as any,
  layoutVariants: [
    { text: 'group-0', fontSize: 1.1, breakAfter: [2, 4, 'x'] as any },
    null as any,
    { foo: 'bar' } as any,
  ],
});

assert.equal('baseText' in (detected as Record<string, unknown>), false, 'legacy baseText should be stripped from detected bubbles');
assert.equal(detected.activeLayoutIndex, 0, 'invalid active layout index should fall back to zero');
assert.deepEqual(
  detected.layoutVariants,
  [{ text: 'group-0', fontSize: 1.1 }],
  'layout variants should keep only pure-text candidate fields',
);

console.log('layoutVariantState tests passed');
