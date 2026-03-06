import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const checks = [
  {
    id: 'AC1',
    file: path.join('components', 'Workspace.tsx'),
    patterns: ['for (const region of maskRegions)', 'for (const contour of contours)'],
    label: '任意红框可见已有轮廓（交集渲染）',
  },
  {
    id: 'AC2',
    file: path.join('components', 'Workspace.tsx'),
    patterns: ['key: `contour-preview-${region.id}-${contour.id}`'],
    label: '同一轮廓可被多个红框并行显示',
  },
  {
    id: 'AC3',
    file: path.join('contexts', 'ProjectContext.tsx'),
    patterns: [
      'buildContourIntersectionMasks(targetImg, [targetMask])',
      'buildContourIntersectionMasks(img, masksToFill)',
      'buildContourIntersectionMasks(img, targetMasks).all',
    ],
    label: '精确填充/预擦除消费交集集合',
  },
  {
    id: 'AC4',
    file: path.join('hooks', 'useProcessor.ts'),
    patterns: ['const contours: ContourRegion[] = originalRects', 'contours: [...(p.contours || []), ...contours],'],
    label: '扫描写入独立轮廓池（删除初始红框后可保留轮廓来源）',
  },
  {
    id: 'AC5',
    file: path.join('services', 'exportService.ts'),
    patterns: [
      'const resolveExportFillMasks = (imageState: ImageState): MaskRegion[] => {',
      'for (const m of resolveExportFillMasks(imageState))',
      'resolveExportFillMasks(imageState).forEach',
    ],
    label: 'DOM/Canvas 导出复用同一交集规则',
  },
];

const failures = [];

for (const check of checks) {
  const fullPath = path.join(cwd, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`[missing-file] ${check.id} ${check.file} (${check.label})`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      failures.push(`[missing-pattern] ${check.id} ${check.file}: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check:contour-acceptance] failed');
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`[check:contour-acceptance] passed (${checks.length} guard groups)`);
