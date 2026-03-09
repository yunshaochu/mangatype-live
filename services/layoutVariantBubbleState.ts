import type { Bubble } from '../types.ts';

import { deriveBaseText } from './layoutVariantText.ts';

type LayoutStateCarrier = Pick<Bubble, 'text' | 'baseText' | 'layoutVariants' | 'activeLayoutIndex'>;

const logLayoutVariantDebug = (event: string, payload: Record<string, unknown>) => {
  console.log('[layout-variants]', event, payload);
};

export const initializeBubbleLayoutState = <T extends LayoutStateCarrier>(bubble: T): T => {
  const nextBubble = {
    ...bubble,
    baseText: deriveBaseText(bubble.text),
    layoutVariants: bubble.layoutVariants && bubble.layoutVariants.length > 0 ? bubble.layoutVariants : undefined,
    activeLayoutIndex: 0,
  };

  logLayoutVariantDebug('initialize-bubble-layout-state', {
    text: bubble.text,
    baseText: nextBubble.baseText,
    layoutVariantCount: nextBubble.layoutVariants?.length ?? 0,
    layoutVariants: nextBubble.layoutVariants,
  });

  return nextBubble;
};

export const buildMainTextChangeUpdates = (
  bubble: Pick<Bubble, 'text'>,
  nextText: string,
): Pick<Bubble, 'text' | 'baseText' | 'layoutVariants' | 'activeLayoutIndex'> => {
  if (nextText === bubble.text) {
    return { text: nextText };
  }

  const updates = {
    text: nextText,
    baseText: deriveBaseText(nextText),
    layoutVariants: undefined,
    activeLayoutIndex: 0,
  };

  logLayoutVariantDebug('invalidate-layout-variants-on-main-text-change', {
    previousText: bubble.text,
    nextText,
    nextBaseText: updates.baseText,
  });

  return updates;
};
