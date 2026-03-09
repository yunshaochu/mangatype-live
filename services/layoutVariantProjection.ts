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

export const getClampedBubbleLayoutIndex = (bubble: Pick<Bubble, 'activeLayoutIndex' | 'layoutVariants'>): number => {
  const totalLayoutCount = getBubbleLayoutCount(bubble);
  const activeLayoutIndex = bubble.activeLayoutIndex ?? 0;
  return Math.min(Math.max(activeLayoutIndex, 0), totalLayoutCount - 1);
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
  bubble: Pick<Bubble, 'activeLayoutIndex' | 'layoutVariants'>,
  direction: 'prev' | 'next',
): number => {
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  const totalLayoutCount = getBubbleLayoutCount(bubble);
  if (totalLayoutCount <= 1) return 0;
  return direction === 'prev'
    ? Math.max(0, activeLayoutIndex - 1)
    : Math.min(totalLayoutCount - 1, activeLayoutIndex + 1);
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
