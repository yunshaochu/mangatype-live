import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const projectContext = read('contexts/ProjectContext.tsx');
const workspace = read('components/Workspace.tsx');

const saveStart = projectContext.indexOf('const handlePaintSave = useCallback');
const sharedActionsStart = projectContext.indexOf('// 6. Shared Actions');
assert(saveStart >= 0 && sharedActionsStart > saveStart, 'handlePaintSave block not found');
const handlePaintSaveBlock = projectContext.slice(saveStart, sharedActionsStart);

assert(
  handlePaintSaveBlock.includes("getFillOverlayMode(m) === 'rect'"),
  'handlePaintSave must gate bake transition by rect overlay mode'
);
assert(
  handlePaintSaveBlock.includes("fillMode: 'baked' as const"),
  'handlePaintSave must convert rect overlays to baked mode after save'
);
assert(
  !handlePaintSaveBlock.includes('isCleaned: false'),
  'handlePaintSave must not clear cleaned semantic state'
);

assert(
  workspace.includes("if (getFillOverlayMode(region) === 'rect')"),
  'paint canvas must only composite rect overlay fills'
);
assert(
  workspace.includes("overlayMode !== 'hidden'"),
  'workspace overlay rendering must hide baked fills'
);

console.log('validate-mask-case-b:pass');
