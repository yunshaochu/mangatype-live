import {
  APIEndpoint,
  DEFAULT_ENDPOINT_BATCH_FAILURES,
  DEFAULT_ENDPOINT_PROTECTION_MODE,
  normalizeEndpointProtectionState,
} from '../types';
import {
  EndpointFailureCode,
  FAILURE_CODE_UNKNOWN,
  pickDisableReasonCode,
} from './apiProtection';

export type EndpointProtectionReducerEvent =
  | {
      type: 'BATCH_FAILED';
      now: number;
      pauseDurationsMs: number[];
      disableThreshold: number;
      failureCodes: EndpointFailureCode[];
      failedRequestCount: number;
      totalRequestCount: number;
    }
  | {
      type: 'BATCH_SUCCEEDED';
      now: number;
      totalRequestCount: number;
    }
  | {
      type: 'PAUSE_EXPIRED';
      now: number;
    }
  | {
      type: 'MANUAL_ENABLE';
      now: number;
    }
  | {
      type: 'MANUAL_DISABLE';
      now: number;
      reasonCode?: EndpointFailureCode;
      reasonMessage?: string;
    };

const getPauseDurationMs = (consecutiveBatchFailures: number, pauseDurationsMs: number[]): number => {
  const fallback = [30_000, 60_000, 120_000, 300_000, 600_000];
  const durations = pauseDurationsMs.length > 0 ? pauseDurationsMs : fallback;
  const index = Math.max(0, Math.min(consecutiveBatchFailures - 1, durations.length - 1));
  return durations[index];
};

const getDisableMessage = (reasonCode: EndpointFailureCode, reasonMessage?: string): string => {
  if (reasonMessage && reasonMessage.trim()) return reasonMessage;
  return `Endpoint auto-disabled due to ${reasonCode}`;
};

export const reduceEndpointProtectionState = (
  endpoint: APIEndpoint,
  event: EndpointProtectionReducerEvent
): APIEndpoint => {
  const current = normalizeEndpointProtectionState(endpoint);
  const userConcurrency = Math.max(1, current.concurrency || 1);

  switch (event.type) {
    case 'BATCH_FAILED': {
      // Batch semantics: one failed batch always increments by exactly one.
      const nextBatchFailures = (current.consecutiveBatchFailures ?? DEFAULT_ENDPOINT_BATCH_FAILURES) + 1;
      const disableThreshold = Math.max(1, event.disableThreshold);
      const shouldDisable = nextBatchFailures >= disableThreshold;
      const reasonCode = pickDisableReasonCode(
        event.failureCodes.length > 0 ? event.failureCodes : [FAILURE_CODE_UNKNOWN]
      );

      return normalizeEndpointProtectionState({
        ...current,
        consecutiveBatchFailures: nextBatchFailures,
        protectionMode: 'degraded',
        effectiveConcurrency: 1,
        pausedUntil: event.now + getPauseDurationMs(nextBatchFailures, event.pauseDurationsMs),
        lastError: `${reasonCode}: batch_failed(${event.failedRequestCount}/${event.totalRequestCount})`,
        enabled: shouldDisable ? false : current.enabled,
        disableReasonCode: shouldDisable ? reasonCode : current.disableReasonCode,
        disableReasonMessage: shouldDisable ? getDisableMessage(reasonCode) : current.disableReasonMessage,
        disabledAt: shouldDisable ? event.now : current.disabledAt,
      });
    }

    case 'BATCH_SUCCEEDED': {
      return normalizeEndpointProtectionState({
        ...current,
        consecutiveBatchFailures: 0,
        pausedUntil: undefined,
        lastError: undefined,
        protectionMode: DEFAULT_ENDPOINT_PROTECTION_MODE,
        effectiveConcurrency: userConcurrency,
      });
    }

    case 'PAUSE_EXPIRED': {
      return normalizeEndpointProtectionState({
        ...current,
        pausedUntil: undefined,
      });
    }

    case 'MANUAL_ENABLE': {
      return normalizeEndpointProtectionState({
        ...current,
        enabled: true,
        pausedUntil: undefined,
        consecutiveErrors: 0,
        consecutiveBatchFailures: 0,
        protectionMode: DEFAULT_ENDPOINT_PROTECTION_MODE,
        effectiveConcurrency: userConcurrency,
        disableReasonCode: undefined,
        disableReasonMessage: undefined,
        disabledAt: undefined,
        lastError: undefined,
      });
    }

    case 'MANUAL_DISABLE': {
      const reasonCode = event.reasonCode ?? FAILURE_CODE_UNKNOWN;
      return normalizeEndpointProtectionState({
        ...current,
        enabled: false,
        disableReasonCode: reasonCode,
        disableReasonMessage: getDisableMessage(reasonCode, event.reasonMessage),
        disabledAt: event.now,
      });
    }

    default:
      return current;
  }
};
