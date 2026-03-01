import { APIEndpoint } from '../types';

// Default configuration
export const DEFAULT_API_PROTECTION_CONFIG = {
  enabled: true,
  durations: [30, 60, 120, 300, 600], // seconds: 30s, 1m, 2m, 5m, 10m
  disableThreshold: 5, // 5th error triggers auto-disable
};

export const FAILURE_CODE_HTTP_429 = 'HTTP_429';
export const FAILURE_CODE_HTTP_500 = 'HTTP_500';
export const FAILURE_CODE_HTTP_503 = 'HTTP_503';
export const FAILURE_CODE_HTTP_502_OR_504 = 'HTTP_502_OR_504';
export const FAILURE_CODE_PARSE_BUBBLES_INVALID = 'PARSE_BUBBLES_INVALID';
export const FAILURE_CODE_UNKNOWN = 'UNKNOWN_FAILURE';

export const ENDPOINT_FAILURE_CODES = [
  FAILURE_CODE_HTTP_429,
  FAILURE_CODE_HTTP_500,
  FAILURE_CODE_HTTP_503,
  FAILURE_CODE_HTTP_502_OR_504,
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
  FAILURE_CODE_UNKNOWN,
] as const;

export type EndpointFailureCode = typeof ENDPOINT_FAILURE_CODES[number];

export const ENDPOINT_PROTECTION_EVENT_TYPES = [
  'BATCH_STARTED',
  'REQUEST_FAILED',
  'BATCH_FAILED',
  'BATCH_SUCCEEDED',
  'PAUSE_EXPIRED',
  'MANUAL_ENABLE',
  'MANUAL_DISABLE',
] as const;

export type EndpointProtectionEventType = typeof ENDPOINT_PROTECTION_EVENT_TYPES[number];

export interface EndpointProtectionEventBase {
  type: EndpointProtectionEventType;
  endpointId: string;
  eventSeq: number;
  timestamp: number;
}

export interface EndpointFailureClassification {
  code: EndpointFailureCode;
  shouldProtect: boolean;
  statusCode?: number;
  message: string;
  rawMessages: string[];
}

export interface EndpointProtectionFailureEvent extends EndpointProtectionEventBase {
  type: 'REQUEST_FAILED' | 'BATCH_FAILED';
  failure: EndpointFailureClassification;
}

export interface EndpointProtectionSuccessEvent extends EndpointProtectionEventBase {
  type: 'BATCH_STARTED' | 'BATCH_SUCCEEDED' | 'PAUSE_EXPIRED' | 'MANUAL_ENABLE' | 'MANUAL_DISABLE';
}

export type EndpointProtectionEvent =
  | EndpointProtectionFailureEvent
  | EndpointProtectionSuccessEvent;

// Keep reason priority deterministic and stable across batch/error ordering.
export const DISABLE_REASON_PRIORITY: EndpointFailureCode[] = [
  FAILURE_CODE_HTTP_429,
  FAILURE_CODE_HTTP_503,
  FAILURE_CODE_HTTP_500,
  FAILURE_CODE_HTTP_502_OR_504,
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
  FAILURE_CODE_UNKNOWN,
];

const RATE_LIMIT_KEYWORDS = [
  'rate limit',
  'too many requests',
  'quota exceeded',
  'service unavailable',
  'resource_exhausted',
  'insufficient_quota',
  'exceeded your current quota',
  'requests per min',
  'requests per minute',
];

const PARSE_FAILURE_KEYWORDS = [
  FAILURE_CODE_PARSE_BUBBLES_INVALID.toLowerCase(),
  'could not parse json structure',
  "missing 'bubbles' key",
  "'bubbles' is not an array",
  'failed to parse response',
  'failed to return structured data',
  'response is not a valid json object',
];

const HTTP_STATUS_FAILURE_CODE_MAP: Record<number, EndpointFailureCode> = {
  429: FAILURE_CODE_HTTP_429,
  500: FAILURE_CODE_HTTP_500,
  503: FAILURE_CODE_HTTP_503,
  502: FAILURE_CODE_HTTP_502_OR_504,
  504: FAILURE_CODE_HTTP_502_OR_504,
};

const PROTECTABLE_FAILURE_CODES = new Set<EndpointFailureCode>([
  FAILURE_CODE_HTTP_429,
  FAILURE_CODE_HTTP_500,
  FAILURE_CODE_HTTP_503,
  FAILURE_CODE_HTTP_502_OR_504,
  FAILURE_CODE_PARSE_BUBBLES_INVALID,
]);

const collectErrorMessages = (error: any): string[] => {
  const messages: string[] = [];
  const visited = new Set<any>();
  const stack: any[] = [error];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const message = current?.message || current?.toString?.();
    if (typeof message === 'string' && message.trim()) {
      messages.push(message.trim());
    }

    const nested = [
      current?.error,
      current?.cause,
      current?.response?.data?.error,
      current?.response?.data,
      current?.details,
      current?.errors,
    ];

    nested.forEach(item => {
      if (!item) return;
      if (Array.isArray(item)) {
        item.forEach(i => stack.push(i));
      } else {
        stack.push(item);
      }
    });
  }

  return messages;
};

const getRawStatusCode = (error: any): number | undefined => {
  const raw =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.cause?.status ||
    error?.cause?.statusCode ||
    error?.cause?.response?.status;
  const code = Number(raw);
  return Number.isInteger(code) && code > 0 ? code : undefined;
};

const findStatusCodeFromMessage = (message: string): number | undefined => {
  for (const code of Object.keys(HTTP_STATUS_FAILURE_CODE_MAP).map(Number)) {
    if (
      message.includes(`${code}`) ||
      message.includes(`status ${code}`) ||
      message.includes(`${code} `)
    ) {
      return code;
    }
  }
  return undefined;
};

const getFailureCodeFromStatus = (statusCode?: number): EndpointFailureCode | undefined => {
  if (!statusCode) return undefined;
  return HTTP_STATUS_FAILURE_CODE_MAP[statusCode];
};

export const pickDisableReasonCode = (codes: EndpointFailureCode[]): EndpointFailureCode => {
  if (codes.length === 0) return FAILURE_CODE_UNKNOWN;
  const weight = new Map(DISABLE_REASON_PRIORITY.map((code, index) => [code, index]));
  return [...codes].sort((a, b) => (weight.get(a) ?? Number.MAX_SAFE_INTEGER) - (weight.get(b) ?? Number.MAX_SAFE_INTEGER))[0];
};

export const getDisableReasonMessage = (classification: EndpointFailureClassification): string => {
  switch (classification.code) {
    case FAILURE_CODE_HTTP_429:
      return 'Endpoint auto-disabled after repeated HTTP 429 rate-limit failures.';
    case FAILURE_CODE_HTTP_503:
      return 'Endpoint auto-disabled after repeated HTTP 503 service-unavailable failures.';
    case FAILURE_CODE_HTTP_500:
      return 'Endpoint auto-disabled after repeated HTTP 500 server failures.';
    case FAILURE_CODE_HTTP_502_OR_504:
      return 'Endpoint auto-disabled after repeated HTTP 502/504 gateway failures.';
    case FAILURE_CODE_PARSE_BUBBLES_INVALID:
      return 'Endpoint auto-disabled after repeated invalid bubble parsing failures.';
    default:
      return 'Endpoint auto-disabled after repeated unknown failures.';
  }
};

export const classifyEndpointFailure = (error: any): EndpointFailureClassification => {
  const rawMessages = collectErrorMessages(error);
  const combinedMessage = rawMessages.join(' | ').toLowerCase();
  const statusFromError = getRawStatusCode(error);
  const statusCode = statusFromError ?? findStatusCodeFromMessage(combinedMessage);
  const statusCodeBased = getFailureCodeFromStatus(statusCode);

  if (statusCodeBased) {
    return {
      code: statusCodeBased,
      shouldProtect: true,
      statusCode,
      message: rawMessages[0] || `HTTP ${statusCode}`,
      rawMessages,
    };
  }

  const explicitCode = error?.code;
  if (explicitCode === FAILURE_CODE_PARSE_BUBBLES_INVALID) {
    return {
      code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
      shouldProtect: true,
      message: rawMessages[0] || 'Invalid bubble parsing failure',
      rawMessages,
    };
  }

  if (PARSE_FAILURE_KEYWORDS.some(keyword => combinedMessage.includes(keyword))) {
    return {
      code: FAILURE_CODE_PARSE_BUBBLES_INVALID,
      shouldProtect: true,
      message: rawMessages[0] || 'Invalid bubble parsing failure',
      rawMessages,
    };
  }

  if (RATE_LIMIT_KEYWORDS.some(keyword => combinedMessage.includes(keyword))) {
    return {
      code: FAILURE_CODE_HTTP_429,
      shouldProtect: true,
      statusCode: 429,
      message: rawMessages[0] || 'Rate limit failure',
      rawMessages,
    };
  }

  return {
    code: FAILURE_CODE_UNKNOWN,
    shouldProtect: false,
    message: rawMessages[0] || 'Unknown failure',
    rawMessages,
  };
};

/**
 * Check if an error should trigger API protection
 */
export const isProtectableError = (error: any): { shouldProtect: boolean; statusCode?: number } => {
  const classification = classifyEndpointFailure(error);
  return {
    shouldProtect: PROTECTABLE_FAILURE_CODES.has(classification.code) && classification.shouldProtect,
    statusCode: classification.statusCode,
  };
};

/**
 * Calculate pause duration based on consecutive errors (exponential backoff)
 * Returns pause duration in milliseconds
 */
export const calculatePauseDuration = (consecutiveErrors: number, customDurations?: number[]): number => {
  // Default: 30s, 1m, 2m, 5m, 10m
  const durations = customDurations || [
    30 * 1000,      // 30 seconds (1st error)
    60 * 1000,      // 1 minute (2nd error)
    2 * 60 * 1000,  // 2 minutes (3rd error)
    5 * 60 * 1000,  // 5 minutes (4th error)
    10 * 60 * 1000, // 10 minutes (5th error) - triggers auto-disable
  ];

  const index = Math.min(consecutiveErrors - 1, durations.length - 1);
  return durations[Math.max(0, index)];
};

/**
 * Update endpoint after an error occurs
 */
export const handleEndpointError = (
  endpoint: APIEndpoint,
  error: any,
  config?: { durations?: number[]; disableThreshold?: number }
): { updatedEndpoint: APIEndpoint; shouldDisable: boolean; classification: EndpointFailureClassification } => {
  const classification = classifyEndpointFailure(error);

  if (!classification.shouldProtect) {
    return {
      updatedEndpoint: {
        ...endpoint,
        lastError: `${classification.code}: ${classification.message}`,
      },
      shouldDisable: false,
      classification,
    };
  }

  const consecutiveErrors = (endpoint.consecutiveErrors || 0) + 1;
  const durations = config?.durations || DEFAULT_API_PROTECTION_CONFIG.durations;
  const durationsMs = durations.map(d => d * 1000);
  const pauseDuration = calculatePauseDuration(consecutiveErrors, durationsMs);
  const pausedUntil = Date.now() + pauseDuration;
  const disableThreshold = config?.disableThreshold || DEFAULT_API_PROTECTION_CONFIG.disableThreshold;
  const shouldDisable = consecutiveErrors >= disableThreshold;

  const updatedEndpoint: APIEndpoint = {
    ...endpoint,
    consecutiveErrors,
    pausedUntil,
    lastError: `${classification.code}: ${classification.message}`,
    enabled: shouldDisable ? false : endpoint.enabled,
    disableReasonCode: shouldDisable ? classification.code : endpoint.disableReasonCode,
    disableReasonMessage: shouldDisable ? getDisableReasonMessage(classification) : endpoint.disableReasonMessage,
    disabledAt: shouldDisable ? Date.now() : endpoint.disabledAt,
  };

  return { updatedEndpoint, shouldDisable, classification };
};

/**
 * Reset error count after successful request
 */
export const handleEndpointSuccess = (endpoint: APIEndpoint): APIEndpoint => {
  return {
    ...endpoint,
    consecutiveErrors: 0,
    pausedUntil: undefined,
    lastError: undefined,
  };
};

/**
 * Check if endpoint is currently paused
 */
export const isEndpointPaused = (endpoint: APIEndpoint): boolean => {
  if (!endpoint.pausedUntil) return false;
  return Date.now() < endpoint.pausedUntil;
};

/**
 * Get remaining pause time in seconds
 */
export const getRemainingPauseTime = (endpoint: APIEndpoint): number => {
  if (!endpoint.pausedUntil) return 0;
  const remaining = endpoint.pausedUntil - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
};

/**
 * Format pause duration for display
 */
export const formatPauseDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
};
