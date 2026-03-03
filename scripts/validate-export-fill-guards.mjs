import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.join(process.cwd(), 'services', 'exportService.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const failures = [];

const assertCheck = (name, condition) => {
  if (!condition) failures.push(name);
};

const getBlock = (startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1 || end <= start) return '';
  return source.slice(start, end);
};

// Assertion 1: baked must be normalized to skip.
assertCheck(
  'resolveExportFillRenderMode must map baked -> skip',
  source.includes("if (m.fillMode === 'baked') return 'skip';")
);

const canvasBlock = getBlock(
  'export const compositeImageWithCanvas = async',
  'export const compositeImage = async'
);
const legacyBlock = getBlock(
  'export const compositeImage = async',
  'export const downloadSingleImage = async'
);
const screenshotBlock = getBlock(
  'export const compositeImageWithScreenshot = async',
  'export const compositeDispatch = async'
);

// Assertion 2: exporters must call shared helpers (no direct fillMode branch in blocks).
assertCheck(
  'canvas exporter should use drawFillMaskOnCanvas',
  canvasBlock.includes('await drawFillMaskOnCanvas(ctx, m, width, height);')
);
assertCheck(
  'legacy exporter should use drawFillMaskOnCanvas',
  legacyBlock.includes('await drawFillMaskOnCanvas(ctx, m, width, height);')
);
assertCheck(
  'screenshot exporter should use appendFillMaskOverlayToDom',
  screenshotBlock.includes('appendFillMaskOverlayToDom(overlay, m);')
);

assertCheck(
  'canvas exporter should not directly branch on m.fillMode',
  !canvasBlock.includes("m.fillMode === 'contour'")
);
assertCheck(
  'legacy exporter should not directly branch on m.fillMode',
  !legacyBlock.includes("m.fillMode === 'contour'")
);
assertCheck(
  'screenshot exporter should not directly branch on m.fillMode',
  !screenshotBlock.includes("m.fillMode === 'contour'")
);

if (failures.length > 0) {
  console.error('Export fill guard checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Export fill guard checks passed.');
