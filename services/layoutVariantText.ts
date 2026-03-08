const asciiWordBoundary = /[A-Za-z0-9]$/;
const asciiWordStart = /^[A-Za-z0-9]/;

const splitGraphemes = (text: string): string[] => {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), segment => segment.segment);
  }

  return Array.from(text);
};

const shouldInsertSpaceBetween = (left: string, right: string): boolean => (
  asciiWordBoundary.test(left) && asciiWordStart.test(right)
);

export const deriveBaseText = (text: string | undefined | null): string => {
  if (typeof text !== 'string' || text.length === 0) {
    return '';
  }

  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.reduce((result, line) => {
    if (!result) return line;
    return `${result}${shouldInsertSpaceBetween(result.at(-1) || '', line[0]) ? ' ' : ''}${line}`;
  }, '');
};

export const normalizeBreakAfter = (baseText: string, breakAfter?: readonly number[]): number[] => {
  const graphemes = splitGraphemes(baseText);
  if (!Array.isArray(breakAfter) || graphemes.length <= 1) {
    return [];
  }

  const maxBreakPoint = graphemes.length - 1;
  return Array.from(new Set(
    breakAfter
      .filter((point): point is number => typeof point === 'number' && Number.isFinite(point))
      .map((point) => Math.trunc(point))
      .filter((point) => point > 0 && point <= maxBreakPoint)
  )).sort((left, right) => left - right);
};

export const applyBreakAfterToBaseText = (baseText: string | undefined | null, breakAfter?: readonly number[]): string => {
  const normalizedBaseText = deriveBaseText(baseText);
  if (!normalizedBaseText) {
    return '';
  }

  const graphemes = splitGraphemes(normalizedBaseText);
  const breakPoints = new Set(normalizeBreakAfter(normalizedBaseText, breakAfter));

  return graphemes
    .map((grapheme, index) => `${grapheme}${breakPoints.has(index + 1) ? '\n' : ''}`)
    .join('');
};
