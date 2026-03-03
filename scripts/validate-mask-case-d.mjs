import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const projectContext = read('contexts/ProjectContext.tsx');
const canvasInteraction = read('hooks/useCanvasInteraction.ts');
const projectState = read('hooks/useProjectState.ts');

const batchStart = projectContext.indexOf('const handleBatchBoxFill = useCallback');
const batchEnd = projectContext.indexOf('// Restore Region');
assert(batchStart >= 0 && batchEnd > batchStart, 'handleBatchBoxFill block not found');
const handleBatchBoxFillBlock = projectContext.slice(batchStart, batchEnd);

assert(
  handleBatchBoxFillBlock.includes("m.method !== 'inpaint' && !m.isCleaned"),
  'batch fill must avoid inpaint masks and only process pending masks'
);
assert(
  handleBatchBoxFillBlock.includes("isBubbleInsideMask(b.x, b.y, mask.x, mask.y, mask.width, mask.height)"),
  'batch fill must recompute bubble overlap using geometric mask check'
);
assert(
  handleBatchBoxFillBlock.includes("backgroundColor: 'transparent', autoDetectBackground: false"),
  'batch fill must force overlapping bubble background to transparent'
);

assert(
  canvasInteraction.includes("// Final overlap check: ensure bubble transparency is correct before committing to history"),
  'drag end flow must re-check transparency before history commit'
);
assert(
  canvasInteraction.includes("past: [...curr.past, initialSnapshot].slice(-20)"),
  'drag history commit must snapshot pre-move state for undo/redo'
);

assert(
  projectState.includes('const handleUndo = useCallback(() => {'),
  'undo handler must exist'
);
assert(
  projectState.includes('future: [curr.present, ...curr.future]'),
  'undo must push current present into future stack'
);
assert(
  projectState.includes('const handleRedo = useCallback(() => {'),
  'redo handler must exist'
);
assert(
  projectState.includes('past: [...curr.past, curr.present]'),
  'redo must push current present into past stack'
);

console.log('validate-mask-case-d:pass');
