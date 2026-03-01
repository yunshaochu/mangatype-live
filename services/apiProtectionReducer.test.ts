import assert from 'node:assert/strict';
import { APIEndpoint } from '../types';
import {
  FAILURE_CODE_HTTP_429,
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
} from './apiProtection';
import { reduceEndpointProtectionState } from './apiProtectionReducer';

const NOW = 1_700_000_000_000;

const createEndpoint = (): APIEndpoint => ({
  id: 'ep-1',
  name: 'endpoint-1',
  enabled: true,
  provider: 'openai',
  apiKey: 'k',
  baseUrl: 'https://example.com',
  model: 'test-model',
  concurrency: 10,
});

type TestCase = {
  name: string;
  run: () => void;
};

const testCases: TestCase[] = [
  {
    name: 'first failed batch degrades to concurrency=1 and increments failures by 1',
    run: () => {
      const next = reduceEndpointProtectionState(createEndpoint(), {
        type: 'BATCH_FAILED',
        now: NOW,
        disableThreshold: 5,
        pauseDurationsMs: [30_000, 60_000],
        failureCodes: [FAILURE_CODE_HTTP_429],
        failedRequestCount: 10,
        totalRequestCount: 10,
      });

      assert.equal(next.consecutiveBatchFailures, 1);
      assert.equal(next.protectionMode, 'degraded');
      assert.equal(next.effectiveConcurrency, 1);
      assert.equal(next.enabled, true);
      assert.equal(next.pausedUntil, NOW + 30_000);
    },
  },
  {
    name: 'each failed batch adds exactly +1 (no request-level overcounting)',
    run: () => {
      const first = reduceEndpointProtectionState(createEndpoint(), {
        type: 'BATCH_FAILED',
        now: NOW,
        disableThreshold: 5,
        pauseDurationsMs: [30_000, 60_000],
        failureCodes: [FAILURE_CODE_HTTP_429],
        failedRequestCount: 10,
        totalRequestCount: 10,
      });
      const second = reduceEndpointProtectionState(first, {
        type: 'BATCH_FAILED',
        now: NOW + 30_000,
        disableThreshold: 5,
        pauseDurationsMs: [30_000, 60_000],
        failureCodes: [FAILURE_CODE_HTTP_429],
        failedRequestCount: 1,
        totalRequestCount: 1,
      });

      assert.equal(second.consecutiveBatchFailures, 2);
    },
  },
  {
    name: 'degraded success restores user concurrency and clears failures',
    run: () => {
      const failed = reduceEndpointProtectionState(createEndpoint(), {
        type: 'BATCH_FAILED',
        now: NOW,
        disableThreshold: 5,
        pauseDurationsMs: [30_000, 60_000],
        failureCodes: [FAILURE_CODE_HTTP_429],
        failedRequestCount: 10,
        totalRequestCount: 10,
      });
      const recovered = reduceEndpointProtectionState(failed, {
        type: 'BATCH_SUCCEEDED',
        now: NOW + 31_000,
        totalRequestCount: 1,
      });

      assert.equal(recovered.consecutiveBatchFailures, 0);
      assert.equal(recovered.protectionMode, 'normal');
      assert.equal(recovered.effectiveConcurrency, 10);
      assert.equal(recovered.pausedUntil, undefined);
      assert.equal(recovered.lastError, undefined);
    },
  },
  {
    name: 'disable reason uses deterministic priority in mixed failures',
    run: () => {
      const disabled = reduceEndpointProtectionState(createEndpoint(), {
        type: 'BATCH_FAILED',
        now: NOW,
        disableThreshold: 1,
        pauseDurationsMs: [30_000],
        failureCodes: [FAILURE_CODE_PARSE_BUBBLES_INVALID, FAILURE_CODE_HTTP_429],
        failedRequestCount: 10,
        totalRequestCount: 10,
      });

      assert.equal(disabled.enabled, false);
      assert.equal(disabled.disableReasonCode, FAILURE_CODE_HTTP_429);
      assert.equal(disabled.disabledAt, NOW);
    },
  },
];

for (const testCase of testCases) {
  testCase.run();
}

console.log(`apiProtectionReducer tests passed (${testCases.length})`);
