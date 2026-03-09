import assert from 'node:assert/strict';

import {
  buildImageAiResponseDebug,
  buildImageAiResponseDebugFromDetectionResult,
} from './imageAiResponseDebug.ts';

const bubbles = [
  {
    text: 'hello',
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    isVertical: false,
  },
] as const;

const manualDebug = buildImageAiResponseDebug({
  bubbles: bubbles as any,
  sourceKind: 'manual_import',
  capturedAt: 123,
});

assert.equal(manualDebug.sourceKind, 'manual_import', 'manual debug should preserve manual sourceKind');
assert.equal(manualDebug.provider, undefined, 'manual debug should not invent a provider');
assert.equal(manualDebug.bubbleCount, 1, 'manual debug should track bubble count');
assert.equal(JSON.parse(manualDebug.prettyJson).bubbles[0].text, 'hello', 'manual debug should pretty print normalized bubbles');

const detectionDebug = buildImageAiResponseDebugFromDetectionResult({
  bubbles: bubbles as any,
  rawPayload: { bubbles: bubbles as any },
  sourceKind: 'openai_tool',
}, {
  provider: 'openai',
  model: '  gpt-4o-mini  ',
  capturedAt: 456,
});

assert.equal(detectionDebug.sourceKind, 'openai_tool', 'detection debug should keep the service sourceKind');
assert.equal(detectionDebug.provider, 'openai', 'detection debug should keep provider metadata');
assert.equal(detectionDebug.model, 'gpt-4o-mini', 'detection debug should trim model metadata');
assert.equal(detectionDebug.capturedAt, 456, 'detection debug should keep explicit timestamps');
assert.equal(JSON.parse(detectionDebug.prettyJson).bubbles[0].text, 'hello', 'detection debug should serialize the service payload');

console.log('imageAiResponseDebug tests passed');
