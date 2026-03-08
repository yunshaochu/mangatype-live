import { normalizeTranslationPromptPreset, TranslationPromptPreset } from '../types';

export const shouldShowBubbleContextSection = (
  preset: TranslationPromptPreset | null | undefined,
): boolean => normalizeTranslationPromptPreset(preset) === 'contextual_v1';
