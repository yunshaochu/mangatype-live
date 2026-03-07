export type FailoverAttemptState = {
  attemptCount: number;
  attemptedEndpointIds: string[];
  lastErrorMessage?: string;
};

export const markFailoverAttempt = (
  state: FailoverAttemptState | undefined,
  endpointId: string,
  errorMessage?: string,
): FailoverAttemptState => {
  const nextState: FailoverAttemptState = state
    ? {
        attemptCount: state.attemptCount,
        attemptedEndpointIds: [...state.attemptedEndpointIds],
        lastErrorMessage: state.lastErrorMessage,
      }
    : { attemptCount: 0, attemptedEndpointIds: [] };

  nextState.attemptCount += 1;
  if (!nextState.attemptedEndpointIds.includes(endpointId)) {
    nextState.attemptedEndpointIds.push(endpointId);
  }
  nextState.lastErrorMessage = errorMessage || nextState.lastErrorMessage || 'Unknown error occurred';
  return nextState;
};

export const hasRemainingFailoverBudget = (
  state: FailoverAttemptState,
  maxFailoverAttempts: number,
): boolean => state.attemptCount < maxFailoverAttempts;

export const pickFailoverEndpoint = <T extends { id: string }>(
  endpoints: T[],
  attemptedEndpointIds: string[],
  getLoad: (endpoint: T) => number,
): T | null => {
  if (endpoints.length === 0) return null;

  const preferred = endpoints.filter(endpoint => !attemptedEndpointIds.includes(endpoint.id));
  const candidatePool = preferred.length > 0 ? preferred : endpoints;

  return candidatePool.reduce((best, endpoint) =>
    getLoad(endpoint) < getLoad(best) ? endpoint : best,
  );
};

export const shouldAllowRunWrite = (
  isActiveRun: boolean,
  signalAborted: boolean,
  allowAbortedSignal = false,
): boolean => {
  if (signalAborted && !allowAbortedSignal) return false;
  return isActiveRun;
};

export const cleanupTranslateProcessingImages = <T extends { status?: string; errorMessage?: string }>(images: T[]): T[] => (
  images.map(image => image.status === 'processing'
    ? { ...image, status: 'idle', errorMessage: undefined }
    : image)
);

export const shouldTranslateImage = (skipped?: boolean): boolean => skipped !== true;

export const shouldExportOriginalImage = (skipped?: boolean): boolean => skipped === true;
