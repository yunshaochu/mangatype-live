import assert from 'node:assert/strict';

import {
  cleanupTranslateProcessingImages,
  hasRemainingFailoverBudget,
  markFailoverAttempt,
  pickFailoverEndpoint,
  shouldAllowRunWrite,
  shouldExportOriginalImage,
  shouldTranslateImage,
} from './translationSemantics.ts';

type Endpoint = { id: string };

const firstAttempt = markFailoverAttempt(undefined, 'ep-a', '429');
assert.equal(firstAttempt.attemptCount, 1, 'first failover attempt should start at 1');
assert.deepEqual(firstAttempt.attemptedEndpointIds, ['ep-a'], 'first attempt should record the tried endpoint');
assert.equal(firstAttempt.lastErrorMessage, '429', 'first attempt should preserve the error message');

const secondAttempt = markFailoverAttempt(firstAttempt, 'ep-b', '503');
assert.equal(secondAttempt.attemptCount, 2, 'second failover attempt should increment attempt count');
assert.deepEqual(secondAttempt.attemptedEndpointIds, ['ep-a', 'ep-b'], 'failover state should remember each attempted endpoint once');
assert.equal(hasRemainingFailoverBudget(secondAttempt, 3), true, 'attempt budget should still allow another retry before the max attempt count');
assert.equal(hasRemainingFailoverBudget(secondAttempt, 2), false, 'attempt budget should stop retries once the max attempt count is reached');

const pickedUntried = pickFailoverEndpoint<Endpoint>(
  [{ id: 'ep-a' }, { id: 'ep-b' }],
  ['ep-a'],
  endpoint => (endpoint.id === 'ep-a' ? 0 : 1),
);
assert.equal(pickedUntried?.id, 'ep-b', 'failover should prefer an untried endpoint even if the tried endpoint is less busy');

const pickedLowestLoad = pickFailoverEndpoint<Endpoint>(
  [{ id: 'ep-a' }, { id: 'ep-b' }],
  ['ep-a', 'ep-b'],
  endpoint => (endpoint.id === 'ep-a' ? 2 : 1),
);
assert.equal(pickedLowestLoad?.id, 'ep-b', 'when every endpoint was already tried, failover should fall back to the least-loaded endpoint');

assert.equal(shouldAllowRunWrite(true, false), true, 'active non-aborted writes should pass');
assert.equal(shouldAllowRunWrite(false, false), false, 'stale runs should stay blocked');
assert.equal(shouldAllowRunWrite(true, true, false), false, 'aborted writes should stay blocked by default');
assert.equal(shouldAllowRunWrite(true, true, true), true, 'cleanup writes may opt into aborted-signal updates');

const cleanedImages = cleanupTranslateProcessingImages([
  { id: 'processing', status: 'processing', errorMessage: 'stale' },
  { id: 'done', status: 'done', errorMessage: 'keep' },
]);
assert.deepEqual(cleanedImages[0], { id: 'processing', status: 'idle', errorMessage: undefined }, 'cleanup should move processing images back to idle');
assert.deepEqual(cleanedImages[1], { id: 'done', status: 'done', errorMessage: 'keep' }, 'cleanup should not touch non-processing images');

assert.equal(shouldTranslateImage(true), false, 'skipped images should be blocked from translate entry points');
assert.equal(shouldTranslateImage(false), true, 'non-skipped images should still be translatable');
assert.equal(shouldExportOriginalImage(true), true, 'skipped images should always export their original source');
assert.equal(shouldExportOriginalImage(false), false, 'non-skipped images should continue through normal export rendering');

console.log('translationSemantics tests passed');
