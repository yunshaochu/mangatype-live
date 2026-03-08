import type { Bubble } from '../types.ts';

import { deriveBaseText } from './layoutVariantText.ts';

type LayoutStateCarrier = Pick<Bubble, 'text' | 'baseText' | 'layoutVariants' | 'activeLayoutIndex'>;

export const initializeBubbleLayoutState = <T extends LayoutStateCarrier>(bubble: T): T => ({
  ...bubble,
  baseText: deriveBaseText(bubble.text),
  layoutVariants: bubble.layoutVariants && bubble.layoutVariants.length > 0 ? bubble.layoutVariants : undefined,
  activeLayoutIndex: 0,
});

export const buildMainTextChangeUpdates = (
  bubble: Pick<Bubble, 'text'>,
  nextText: string,
): Pick<Bubble, 'text' | 'baseText' | 'layoutVariants' | 'activeLayoutIndex'> => {
  if (nextText === bubble.text) {
    return { text: nextText };
  }

  return {
    text: nextText,
    baseText: deriveBaseText(nextText),
    layoutVariants: undefined,
    activeLayoutIndex: 0,
  };
};
