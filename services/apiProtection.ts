import { APIEndpoint } from '../types';

// Default configuration
export const DEFAULT_API_PROTECTION_CONFIG = {
  enabled: true,
  durations: [30, 60, 120, 300, 600], // seconds: 30s, 1m, 2m, 5m, 10m
  disableThreshold: 5, // 5th error triggers auto-disable
};

// Error codes that trigger API protection
const RATE_LIMIT_ERRORS = [429, 503, 502, 504];

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
      messages.push(message);
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

/**
 * Check if an error should trigger API protection
 */
export const isProtectableError = (error: any): { shouldProtect: boolean; statusCode?: number } => {
  // Check for HTTP status codes in error object and wrapped causes
  const statusCode =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.cause?.status ||
    error?.cause?.statusCode ||
    error?.cause?.response?.status;
  const messages = collectErrorMessages(error);
  const combinedMessage = messages.join(' | ').toLowerCase();

  // Check status code directly
  if (statusCode && RATE_LIMIT_ERRORS.includes(statusCode)) {
    return { shouldProtect: true, statusCode };
  }

  // Check error message for status codes
  for (const code of RATE_LIMIT_ERRORS) {
    if (combinedMessage.includes(`${code}`) || combinedMessage.includes(`status ${code}`) || combinedMessage.includes(`${code} `)) {
      return { shouldProtect: true, statusCode: code };
    }
  }

  // Check for common rate limit keywords
  if (
    combinedMessage.includes('rate limit') ||
    combinedMessage.includes('too many requests') ||
    combinedMessage.includes('quota exceeded') ||
    combinedMessage.includes('service unavailable') ||
    combinedMessage.includes('resource_exhausted') ||
    combinedMessage.includes('insufficient_quota') ||
    combinedMessage.includes('exceeded your current quota') ||
    combinedMessage.includes('requests per min') ||
    combinedMessage.includes('requests per minute')
  ) {
    return { shouldProtect: true, statusCode: statusCode || 429 };
  }

  return { shouldProtect: false };
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
): { updatedEndpoint: APIEndpoint; shouldDisable: boolean } => {
  const { shouldProtect, statusCode } = isProtectableError(error);

  if (!shouldProtect) {
    // Not a protectable error, just record it
    return {
      updatedEndpoint: {
        ...endpoint,
        lastError: error?.message || 'Unknown error',
      },
      shouldDisable: false,
    };
  }

  // Increment consecutive errors
  const consecutiveErrors = (endpoint.consecutiveErrors || 0) + 1;

  // Use custom durations if provided, otherwise use defaults
  const durations = config?.durations || DEFAULT_API_PROTECTION_CONFIG.durations;
  const durationsMs = durations.map(d => d * 1000);
  const pauseDuration = calculatePauseDuration(consecutiveErrors, durationsMs);
  const pausedUntil = Date.now() + pauseDuration;

  // Check if this error count triggers auto-disable
  const disableThreshold = config?.disableThreshold || DEFAULT_API_PROTECTION_CONFIG.disableThreshold;
  const shouldDisable = consecutiveErrors >= disableThreshold;

  const updatedEndpoint: APIEndpoint = {
    ...endpoint,
    consecutiveErrors,
    pausedUntil,
    lastError: `${statusCode || 'Error'}: ${error?.message || 'API error'}`,
    enabled: shouldDisable ? false : endpoint.enabled,
  };

  return { updatedEndpoint, shouldDisable };
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
