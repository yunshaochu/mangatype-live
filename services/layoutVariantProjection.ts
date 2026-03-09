import type { Bubble } from '../types.ts';

const projectionLogCache = new Map<string, string>();

export type ActiveBubbleLayoutState = {
  activeLayoutIndex: number;
  totalLayoutCount: number;
  hasVariants: boolean;
  text: string;
  fontSize: number;
};

export const getBubbleLayoutCount = (bubble: Pick<Bubble, 'layoutVariants'>): number => 1 + (bubble.layoutVariants?.length ?? 0);

const getBubbleLayoutNavigationOrder = (
  bubble: Pick<Bubble, 'fontSize' | 'layoutVariants'>,
): number[] => {
  const smaller: Array<{ selectionIndex: number; fontSize: number }> = [];
  const larger: Array<{ selectionIndex: number; fontSize: number }> = [];
  const equal: Array<{ selectionIndex: number; fontSize: number }> = [];

  bubble.layoutVariants?.forEach((variant, index) => {
    const selectionIndex = index + 1;
    const fontSize = variant.fontSize ?? bubble.fontSize;

    if (fontSize < bubble.fontSize) {
      smaller.push({ selectionIndex, fontSize });
      return;
    }

    if (fontSize > bubble.fontSize) {
      larger.push({ selectionIndex, fontSize });
      return;
    }

    equal.push({ selectionIndex, fontSize });
  });

  const sortByFontSizeThenSelection = (
    left: { selectionIndex: number; fontSize: number },
    right: { selectionIndex: number; fontSize: number },
  ): number => left.fontSize - right.fontSize || left.selectionIndex - right.selectionIndex;

  smaller.sort(sortByFontSizeThenSelection);
  larger.sort(sortByFontSizeThenSelection);
  equal.sort(sortByFontSizeThenSelection);

  return [
    ...smaller.map((item) => item.selectionIndex),
    0,
    ...larger.map((item) => item.selectionIndex),
    ...equal.map((item) => item.selectionIndex),
  ];
};

export const getClampedBubbleLayoutIndex = (bubble: Pick<Bubble, 'activeLayoutIndex' | 'layoutVariants'>): number => {
  const totalLayoutCount = getBubbleLayoutCount(bubble);
  const activeLayoutIndex = bubble.activeLayoutIndex ?? 0;
  return Math.min(Math.max(activeLayoutIndex, 0), totalLayoutCount - 1);
};

export const getBubbleLayoutNavigationState = (
  bubble: Pick<Bubble, 'fontSize' | 'layoutVariants' | 'activeLayoutIndex'>,
): {
  activeSelectionPosition: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  currentCandidateOrder: number | null;
  totalCandidateCount: number;
} => {
  const orderedSelectionIndexes = getBubbleLayoutNavigationOrder(bubble);
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  const activeSelectionPosition = Math.max(0, orderedSelectionIndexes.indexOf(activeLayoutIndex));
  const candidateSelectionIndexes = orderedSelectionIndexes.filter((selectionIndex) => selectionIndex !== 0);

  return {
    activeSelectionPosition,
    canGoPrev: activeSelectionPosition > 0,
    canGoNext: activeSelectionPosition < orderedSelectionIndexes.length - 1,
    currentCandidateOrder: activeLayoutIndex === 0
      ? null
      : candidateSelectionIndexes.indexOf(activeLayoutIndex) + 1,
    totalCandidateCount: candidateSelectionIndexes.length,
  };
};

export const getActiveBubbleLayoutState = (
  bubble: Pick<Bubble, 'id' | 'text' | 'fontSize' | 'layoutVariants' | 'activeLayoutIndex'>,
): ActiveBubbleLayoutState => {
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  const totalLayoutCount = getBubbleLayoutCount(bubble);

  if (activeLayoutIndex === 0 || !bubble.layoutVariants?.[activeLayoutIndex - 1]) {
    const mainState = {
      activeLayoutIndex,
      totalLayoutCount,
      hasVariants: totalLayoutCount > 1,
      text: bubble.text,
      fontSize: bubble.fontSize,
    };

    const mainSignature = JSON.stringify(mainState);
    const mainCacheKey = bubble.id || `anonymous-main-${bubble.text}`;
    if (projectionLogCache.get(mainCacheKey) !== mainSignature) {
      console.log('[layout-variants]', 'project-active-layout', {
        bubbleId: bubble.id,
        mode: 'main',
        activeLayoutIndex,
        totalLayoutCount,
        projectedText: mainState.text,
        projectedFontSize: mainState.fontSize,
        layoutVariants: bubble.layoutVariants,
      });
      projectionLogCache.set(mainCacheKey, mainSignature);
    }

    return mainState;
  }

  const variant = bubble.layoutVariants[activeLayoutIndex - 1];

  const projectedState = {
    activeLayoutIndex,
    totalLayoutCount,
    hasVariants: totalLayoutCount > 1,
    text: typeof variant.text === 'string' && variant.text.length > 0
      ? variant.text
      : bubble.text,
    fontSize: variant.fontSize ?? bubble.fontSize,
  };

  const projectedSignature = JSON.stringify({
    activeLayoutIndex,
    totalLayoutCount,
    variantText: variant.text,
    projectedText: projectedState.text,
    projectedFontSize: projectedState.fontSize,
  });
  const projectedCacheKey = bubble.id || `anonymous-variant-${bubble.text}`;
  if (projectionLogCache.get(projectedCacheKey) !== projectedSignature) {
    console.log('[layout-variants]', 'project-active-layout', {
      bubbleId: bubble.id,
      mode: 'variant',
      activeLayoutIndex,
      totalLayoutCount,
      variant,
      projectedText: projectedState.text,
      projectedFontSize: projectedState.fontSize,
    });
    projectionLogCache.set(projectedCacheKey, projectedSignature);
  }

  return projectedState;
};

export const getAdjacentBubbleLayoutIndex = (
  bubble: Pick<Bubble, 'fontSize' | 'activeLayoutIndex' | 'layoutVariants'>,
  direction: 'prev' | 'next',
): number => {
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  const orderedSelectionIndexes = getBubbleLayoutNavigationOrder(bubble);
  const activeSelectionPosition = Math.max(0, orderedSelectionIndexes.indexOf(activeLayoutIndex));

  if (orderedSelectionIndexes.length <= 1) {
    return 0;
  }

  const targetSelectionPosition = direction === 'prev'
    ? Math.max(0, activeSelectionPosition - 1)
    : Math.min(orderedSelectionIndexes.length - 1, activeSelectionPosition + 1);

  return orderedSelectionIndexes[targetSelectionPosition] ?? activeLayoutIndex;
};

export const buildActiveBubbleFontSizeUpdate = (
  bubble: Pick<Bubble, 'fontSize' | 'layoutVariants' | 'activeLayoutIndex'>,
  nextFontSize: number,
): Pick<Bubble, 'fontSize' | 'layoutVariants'> => {
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  if (activeLayoutIndex === 0 || !bubble.layoutVariants?.[activeLayoutIndex - 1]) {
    return { fontSize: nextFontSize };
  }

  const layoutVariants = [...bubble.layoutVariants];
  layoutVariants[activeLayoutIndex - 1] = {
    ...layoutVariants[activeLayoutIndex - 1],
    fontSize: nextFontSize,
  };

  return { layoutVariants };
};

export const buildSteppedActiveBubbleFontSizeUpdate = (
  bubble: Pick<Bubble, 'fontSize' | 'layoutVariants' | 'activeLayoutIndex'>,
  deltaSteps: number,
  stepSize: number = 0.1,
): Pick<Bubble, 'fontSize' | 'layoutVariants'> => {
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  const activeVariant = activeLayoutIndex === 0 ? undefined : bubble.layoutVariants?.[activeLayoutIndex - 1];
  const currentFontSize = activeVariant?.fontSize ?? bubble.fontSize;
  const nextFontSize = Math.max(0.5, Math.min(10, currentFontSize + (deltaSteps * stepSize)));
  return buildActiveBubbleFontSizeUpdate(bubble, parseFloat(nextFontSize.toFixed(1)));
};
