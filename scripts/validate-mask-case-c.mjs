import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const projectContext = read('contexts/ProjectContext.tsx');
const processor = read('hooks/useProcessor.ts');

const inpaintStart = projectContext.indexOf('const handleInpaint = useCallback');
const workshopStart = projectContext.indexOf('// Apply Workshop Result');
assert(inpaintStart >= 0 && workshopStart > inpaintStart, 'handleInpaint block not found');
const handleInpaintBlock = projectContext.slice(inpaintStart, workshopStart);

assert(
  handleInpaintBlock.includes("isCleaned: true, method: 'inpaint' as const"),
  'handleInpaint must persist cleaned + inpaint semantics on target masks'
);
assert(
  handleInpaintBlock.includes("backgroundColor: 'transparent'"),
  'handleInpaint must force overlapping bubbles to transparent'
);
assert(
  projectContext.includes("(currentImg.maskRegions || []).filter(isMaskCleaned)"),
  'updateBubble must rely on semantic cleaned filter'
);
assert(
  processor.includes("const cleanedMasks = (img.maskRegions || []).filter(isMaskCleaned);"),
  'translation processor must pre-filter cleaned masks for transparency'
);
assert(
  processor.includes("backgroundColor: overlapsCleanedMask ? 'transparent' : color"),
  'processor bubble creation must preserve transparent background in cleaned regions'
);

console.log('validate-mask-case-c:pass');
