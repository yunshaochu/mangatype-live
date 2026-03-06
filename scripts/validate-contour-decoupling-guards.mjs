import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const checks = [
  {
    file: 'types.ts',
    patterns: ['maskContourX?: number;', 'maskContourY?: number;'],
    label: 'MaskRegion exposes independent contour anchors',
  },
  {
    file: path.join('hooks', 'useProcessor.ts'),
    patterns: ['const contours: ContourRegion[] = originalRects', 'contours: [...(p.contours || []), ...contours]'],
    label: 'scan pipeline writes contours into image contour pool',
  },
  {
    file: path.join('components', 'Workspace.tsx'),
    patterns: ['const contourPreviewLayers = useMemo(() => {', 'for (const contour of contours)', 'clipPath: layer.clipValue'],
    label: 'preview overlay consumes contour pool intersection and clip',
  },
  {
    file: path.join('services', 'exportService.ts'),
    patterns: ['const getContourAnchorPct = (m: MaskRegion)', 'withMaskClipOnCanvas', 'appendFillMaskOverlayToDom'],
    label: 'export/fill pipeline uses shared anchor+clip helpers',
  },
];

const failures = [];

for (const check of checks) {
  const fullPath = path.join(cwd, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`[missing-file] ${check.file} (${check.label})`);
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      failures.push(`[missing-pattern] ${check.file}: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check:contour-decoupling] failed');
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`[check:contour-decoupling] passed (${checks.length} guard groups)`);
