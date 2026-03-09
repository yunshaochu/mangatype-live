import assert from 'node:assert/strict';

import {
  buildAiDetectionResult,
  extractAndValidateAiDetectionResultFromText,
} from './geminiService.ts';

const payload = {
  bubbles: [
    {
      text: 'hello',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      isVertical: false,
    },
  ],
};

for (const sourceKind of ['gemini_function', 'openai_tool'] as const) {
  const result = buildAiDetectionResult(payload, sourceKind);
  assert.equal(result.sourceKind, sourceKind, `${sourceKind}: should preserve sourceKind`);
  assert.equal(result.bubbles.length, 1, `${sourceKind}: should return one normalized bubble`);
  assert.deepEqual(result.rawPayload, { bubbles: result.bubbles }, `${sourceKind}: rawPayload should contain only normalized bubbles`);
}

for (const sourceKind of ['gemini_json', 'gemini_text', 'openai_content'] as const) {
  const result = extractAndValidateAiDetectionResultFromText(JSON.stringify(payload), `test-${sourceKind}`, sourceKind);
  assert.equal(result.sourceKind, sourceKind, `${sourceKind}: should preserve sourceKind`);
  assert.equal(result.bubbles.length, 1, `${sourceKind}: should parse one normalized bubble`);
  assert.deepEqual(result.rawPayload, { bubbles: result.bubbles }, `${sourceKind}: rawPayload should contain only normalized bubbles`);
}

console.log('geminiServiceDetectionResult tests passed');
