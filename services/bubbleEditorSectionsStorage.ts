export const BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY = 'mangatype_live_bubble_editor_sections_v1';

export const BUBBLE_EDITOR_SECTION_IDS = ['mask', 'color', 'layout', 'font', 'context'] as const;
export type BubbleEditorSectionId = typeof BUBBLE_EDITOR_SECTION_IDS[number];

export const BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS: BubbleEditorSectionId[] = ['layout'];

const isBubbleEditorSectionId = (value: unknown): value is BubbleEditorSectionId => (
  typeof value === 'string' && BUBBLE_EDITOR_SECTION_IDS.includes(value as BubbleEditorSectionId)
);

export const normalizeBubbleEditorOpenSections = (input: unknown): BubbleEditorSectionId[] => {
  if (!Array.isArray(input)) {
    return [...BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS];
  }

  const normalized = Array.from(new Set(input.filter(isBubbleEditorSectionId)));
  return normalized.length > 0 ? normalized : [...BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS];
};

export const loadBubbleEditorOpenSections = (storage: Storage | null | undefined): BubbleEditorSectionId[] => {
  if (!storage) {
    return [...BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS];
  }

  try {
    const raw = storage.getItem(BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return [...BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS];
    }

    return normalizeBubbleEditorOpenSections(JSON.parse(raw));
  } catch {
    return [...BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS];
  }
};

export const saveBubbleEditorOpenSections = (
  storage: Storage | null | undefined,
  sections: Iterable<string>,
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY,
      JSON.stringify(normalizeBubbleEditorOpenSections(Array.from(sections))),
    );
  } catch {}
};
