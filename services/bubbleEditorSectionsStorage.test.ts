import assert from 'node:assert/strict';
import {
  BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS,
  BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY,
  loadBubbleEditorOpenSections,
  normalizeBubbleEditorOpenSections,
  saveBubbleEditorOpenSections,
} from './bubbleEditorSectionsStorage';

const createStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
};

assert.deepEqual(
  normalizeBubbleEditorOpenSections(['context', 'layout', 'context', 'unknown']),
  ['context', 'layout'],
  'normalize should keep known unique sections only',
);
assert.deepEqual(
  normalizeBubbleEditorOpenSections(['unknown']),
  BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS,
  'normalize should fall back when every section is invalid',
);
assert.deepEqual(
  loadBubbleEditorOpenSections(undefined),
  BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS,
  'load should fall back when storage is unavailable',
);

const storage = createStorage();
saveBubbleEditorOpenSections(storage, ['mask', 'context', 'mask', 'bad']);
assert.equal(storage.getItem(BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY), JSON.stringify(['mask', 'context']), 'save should persist normalized sections');
assert.deepEqual(loadBubbleEditorOpenSections(storage), ['mask', 'context'], 'load should restore persisted sections');

storage.setItem(BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY, '{bad json');
assert.deepEqual(
  loadBubbleEditorOpenSections(storage),
  BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS,
  'load should fall back when persisted JSON is invalid',
);

storage.setItem(BUBBLE_EDITOR_OPEN_SECTIONS_STORAGE_KEY, JSON.stringify(['bad-section']));
assert.deepEqual(
  loadBubbleEditorOpenSections(storage),
  BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS,
  'load should fall back when persisted sections are unknown',
);

const throwingStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
} as unknown as Storage;

assert.deepEqual(
  loadBubbleEditorOpenSections(throwingStorage),
  BUBBLE_EDITOR_DEFAULT_OPEN_SECTIONS,
  'load should swallow storage exceptions and return defaults',
);
assert.doesNotThrow(
  () => saveBubbleEditorOpenSections(throwingStorage, ['layout']),
  'save should swallow storage exceptions',
);

console.log('bubbleEditorSectionsStorage tests passed');
