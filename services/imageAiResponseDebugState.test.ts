import assert from 'node:assert/strict';

import type { ImageAiResponseDebug } from '../types.ts';
import {
  clearImageAiResponseDebugEntries,
  pruneImageAiResponseDebugEntries,
  setImageAiResponseDebugEntry,
} from './imageAiResponseDebugState.ts';

const baseDebug = (overrides: Partial<ImageAiResponseDebug> = {}): ImageAiResponseDebug => ({
  prettyJson: '[{"text":"demo"}]',
  sourceKind: 'manual_import',
  provider: 'openai',
  model: 'gpt-4o-mini',
  capturedAt: 123,
  bubbleCount: 1,
  ...overrides,
});

const added = setImageAiResponseDebugEntry({}, 'img-1', baseDebug());
assert.equal(Object.keys(added).length, 1, 'set should create a new entry');
assert.equal(added['img-1'].sourceKind, 'manual_import', 'set should retain the provided payload');

const overwritten = setImageAiResponseDebugEntry(added, 'img-1', baseDebug({ sourceKind: 'gemini_json', bubbleCount: 3 }));
assert.equal(overwritten['img-1'].sourceKind, 'gemini_json', 'set should overwrite existing entries by image id');
assert.equal(overwritten['img-1'].bubbleCount, 3, 'overwrite should replace the full snapshot');

const withSecond = setImageAiResponseDebugEntry(overwritten, 'img-2', baseDebug({ provider: 'gemini', sourceKind: 'gemini_function' }));
const clearedOne = clearImageAiResponseDebugEntries(withSecond, ['img-1']);
assert.deepEqual(Object.keys(clearedOne), ['img-2'], 'clear should only remove the requested ids');

const unchangedClear = clearImageAiResponseDebugEntries(clearedOne, ['missing']);
assert.equal(unchangedClear, clearedOne, 'clearing unknown ids should preserve referential identity');

const pruned = pruneImageAiResponseDebugEntries(withSecond, ['img-2']);
assert.deepEqual(Object.keys(pruned), ['img-2'], 'prune should drop entries for removed images');

const clearedAll = clearImageAiResponseDebugEntries(pruned);
assert.deepEqual(clearedAll, {}, 'clear without ids should empty the map');

console.log('imageAiResponseDebugState tests passed');
