export type VerticalPunctuationTune = {
  renderChar: string;
  rotationDeg: number;
  offsetXEm?: number;
};

const VERTICAL_PUNCTUATION_TUNES: Record<string, VerticalPunctuationTune> = {
  '！': { renderChar: '!', rotationDeg: 0, offsetXEm: 0.05 },
  '？': { renderChar: '?', rotationDeg: 0, offsetXEm: 0.08 },
};

export const getVerticalPunctuationTune = (char: string): VerticalPunctuationTune | null => {
  return VERTICAL_PUNCTUATION_TUNES[char] || null;
};
