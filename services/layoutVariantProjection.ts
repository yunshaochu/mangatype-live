import type { Bubble } from '../types.ts';

import { applyBreakAfterToBaseText, deriveBaseText } from './layoutVariantText.ts';

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
  bubble: Pick<Bubble, 'text' | 'fontSize' | 'baseText' | 'layoutVariants' | 'activeLayoutIndex'>,
): ActiveBubbleLayoutState => {
  const activeLayoutIndex = getClampedBubbleLayoutIndex(bubble);
  const totalLayoutCount = getBubbleLayoutCount(bubble);

  if (activeLayoutIndex === 0 || !bubble.layoutVariants?.[activeLayoutIndex - 1]) {
    return {
      activeLayoutIndex,
      totalLayoutCount,
      hasVariants: totalLayoutCount > 1,
      text: bubble.text,
      fontSize: bubble.fontSize,
    };
  }

  const variant = bubble.layoutVariants[activeLayoutIndex - 1];
  const baseText = bubble.baseText || deriveBaseText(bubble.text);

  return {
    activeLayoutIndex,
    totalLayoutCount,
    hasVariants: totalLayoutCount > 1,
    text: typeof variant.text === 'string' && variant.text.length > 0
      ? variant.text
      : applyBreakAfterToBaseText(baseText, variant.breakAfter),
    fontSize: variant.fontSize ?? bubble.fontSize,
  };
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
