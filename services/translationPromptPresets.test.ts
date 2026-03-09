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
assert.doesNotMatch(contextual.defaultSystemPrompt, /extraLayoutVariantCount/, 'contextual prompt should not mention extraLayoutVariantCount anymore');
assert.match(contextual.manualJsonSample, /"layoutVariants"/, 'contextual sample should include layout variants');
assert.match(contextual.manualJsonSample, /"text": "中文翻译第一行中文\\n翻译第二行"/, 'contextual sample should show full-text layout candidates');
assert.doesNotMatch(contextual.defaultSystemPrompt, /breakAfter|baseText/, 'contextual prompt should no longer mention legacy layout variant fields');
assert.doesNotMatch(contextual.manualJsonPlaceholder, /breakAfter|baseText/, 'contextual placeholder should no longer mention legacy layout variant fields');
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
assert.doesNotMatch(legacy.defaultSystemPrompt, /extraLayoutVariantCount/, 'legacy prompt should not mention extraLayoutVariantCount anymore');
assert.match(legacy.manualJsonSample, /"layoutVariants"/, 'legacy sample should include layout variants');
assert.match(legacy.manualJsonSample, /"text": "中文翻译第一行中文\\n翻译第二行"/, 'legacy sample should show full-text layout candidates');
assert.doesNotMatch(legacy.defaultSystemPrompt, /breakAfter|baseText/, 'legacy prompt should no longer mention legacy layout variant fields');
assert.doesNotMatch(legacy.manualJsonPlaceholder, /breakAfter|baseText/, 'legacy placeholder should no longer mention legacy layout variant fields');
assert.doesNotMatch(legacy.manualJsonPlaceholder, /sourceText/, 'legacy placeholder should stay loose');

assert.equal(fallback.id, 'contextual_v1', 'missing preset should fall back to contextual preset');

console.log('translationPromptPresets tests passed');
