import assert from 'node:assert/strict';
import {
  getTranslationPromptPresetDefinition,
  TRANSLATION_PROMPT_PRESET_DEFINITIONS,
  TRANSLATION_PROMPT_PRESET_OPTIONS,
} from './translationPromptPresets.ts';

const contextual = getTranslationPromptPresetDefinition('contextual_v1');
const legacy = getTranslationPromptPresetDefinition('legacy_loose_v0');
const fallback = getTranslationPromptPresetDefinition(undefined);

assert.equal(Object.keys(TRANSLATION_PROMPT_PRESET_DEFINITIONS).length, 2, 'should expose exactly two preset definitions');
assert.equal(TRANSLATION_PROMPT_PRESET_OPTIONS.length, 2, 'preset options should stay in sync with definitions');

assert.equal(contextual.contract.requiresContext, true, 'contextual preset should require context');
assert.deepEqual(
  contextual.contract.requiredBubbleFields,
  ['sourceText', 'context', 'text', 'x', 'y', 'width', 'height', 'isVertical'],
  'contextual preset should expose contextual contract fields',
);
assert.match(contextual.defaultSystemPrompt, /sourceText/, 'contextual prompt should mention sourceText');
assert.match(contextual.manualJsonSample, /"context"/, 'contextual sample should include context');
assert.match(contextual.defaultSystemPrompt, /layoutVariants/, 'contextual prompt should describe layout variants');
assert.match(contextual.manualJsonSample, /"layoutVariants"/, 'contextual sample should include layout variants');
assert.match(contextual.manualJsonPlaceholder, /sourceText/, 'contextual placeholder should include sourceText');

assert.equal(legacy.contract.requiresContext, false, 'legacy preset should not require context');
assert.deepEqual(
  legacy.contract.requiredBubbleFields,
  ['text', 'x', 'y', 'width', 'height', 'isVertical'],
  'legacy preset should preserve loose core contract fields',
);
assert.doesNotMatch(legacy.defaultSystemPrompt, /sourceText/, 'legacy prompt should not require sourceText');
assert.doesNotMatch(legacy.manualJsonSample, /"context"/, 'legacy sample should not include context');
assert.match(legacy.defaultSystemPrompt, /layoutVariants/, 'legacy prompt should also describe layout variants');
assert.match(legacy.manualJsonSample, /"layoutVariants"/, 'legacy sample should include layout variants');
assert.doesNotMatch(legacy.manualJsonPlaceholder, /sourceText/, 'legacy placeholder should stay loose');

assert.equal(fallback.id, 'contextual_v1', 'missing preset should fall back to contextual preset');

console.log('translationPromptPresets tests passed');
