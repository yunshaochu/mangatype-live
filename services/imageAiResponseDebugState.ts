import type { ImageAiResponseDebug } from '../types.ts';

export type ImageAiResponseDebugMap = Record<string, ImageAiResponseDebug>;

export const setImageAiResponseDebugEntry = (
  current: ImageAiResponseDebugMap,
  imageId: string,
  debug: ImageAiResponseDebug | null | undefined,
): ImageAiResponseDebugMap => {
  if (!imageId) return current;

  if (!debug) {
    if (!(imageId in current)) return current;
    const { [imageId]: _removed, ...rest } = current;
    return rest;
  }

  return {
    ...current,
    [imageId]: debug,
  };
};

export const clearImageAiResponseDebugEntries = (
  current: ImageAiResponseDebugMap,
  imageIds?: Iterable<string>,
): ImageAiResponseDebugMap => {
  if (!imageIds) {
    return Object.keys(current).length === 0 ? current : {};
  }

  const idsToClear = new Set(imageIds);
  if (idsToClear.size === 0) return current;

  let changed = false;
  const next: ImageAiResponseDebugMap = {};

  for (const [imageId, debug] of Object.entries(current)) {
    if (idsToClear.has(imageId)) {
      changed = true;
      continue;
    }
    next[imageId] = debug;
  }

  return changed ? next : current;
};

export const pruneImageAiResponseDebugEntries = (
  current: ImageAiResponseDebugMap,
  activeImageIds: Iterable<string>,
): ImageAiResponseDebugMap => {
  const activeIds = new Set(activeImageIds);
  let changed = false;
  const next: ImageAiResponseDebugMap = {};

  for (const [imageId, debug] of Object.entries(current)) {
    if (!activeIds.has(imageId)) {
      changed = true;
      continue;
    }
    next[imageId] = debug;
  }

  return changed ? next : current;
};
