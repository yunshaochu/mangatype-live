import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const projectContext = read('contexts/ProjectContext.tsx');
const canvasInteraction = read('hooks/useCanvasInteraction.ts');
const processor = read('hooks/useProcessor.ts');

assert(
  projectContext.includes("import { getFillOverlayMode, isBubbleInsideMask, isMaskCleaned } from '../utils/editorUtils';"),
  'ProjectContext must import isMaskCleaned helper'
);
assert(
  projectContext.includes("(imgState.maskRegions || []).filter(isMaskCleaned)"),
  'triggerAutoColorDetection must filter cleaned masks through helper'
);
assert(
  projectContext.includes("(currentImg.maskRegions || []).filter(isMaskCleaned)"),
  'updateBubble must filter cleaned masks through helper'
);

assert(
  canvasInteraction.includes("import { createBubble, createMaskRegion, clamp, isBubbleInsideMask, isMaskCleaned } from '../utils/editorUtils';"),
  'useCanvasInteraction must import isMaskCleaned helper'
);
assert(
  canvasInteraction.includes("(img.maskRegions || []).filter(isMaskCleaned)"),
  'useCanvasInteraction must use helper in draw/move lifecycle'
);
assert(
  canvasInteraction.includes("const cleanedMasks = maskRegions.filter(isMaskCleaned);"),
  'useCanvasInteraction overlap function must use helper'
);

assert(
  processor.includes("import { isBubbleInsideMask, isMaskCleaned } from '../utils/editorUtils';"),
  'useProcessor must import isMaskCleaned helper'
);
assert(
  processor.includes("const cleanedMasks = (img.maskRegions || []).filter(isMaskCleaned);"),
  'useProcessor translate flow must use helper-filtered masks'
);

console.log('validate-mask-entrypoints:pass');
