import { DetectionLinePolygon } from '../types';

export type DetectionScanRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  maskContourBase64?: string;
  linePolygons?: DetectionLinePolygon[];
  vertical?: boolean;
};

type LineBounds = {
  line: DetectionLinePolygon;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const getLineBounds = (line: DetectionLinePolygon): LineBounds | null => {
  if (!Array.isArray(line) || line.length < 3) return null;
  const xs = line.map(point => point.x).filter(Number.isFinite);
  const ys = line.map(point => point.y).filter(Number.isFinite);
  if (xs.length < 3 || ys.length < 3) return null;

  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  return { line, left, top, right, bottom, width, height };
};

const intersects = (
  first: Pick<LineBounds, 'left' | 'top' | 'right' | 'bottom'>,
  second: Pick<LineBounds, 'left' | 'top' | 'right' | 'bottom'>,
) => first.right > second.left && first.bottom > second.top && first.left < second.right && first.top < second.bottom;

const estimateVertical = (boxes: LineBounds[], region: DetectionScanRegion): boolean => {
  const medianWidth = median(boxes.map(box => box.width));
  const medianHeight = median(boxes.map(box => box.height));
  if (medianHeight > medianWidth * 1.2) return true;
  if (medianWidth > medianHeight * 1.2) return false;
  return region.height >= region.width;
};

export const splitDetectionRegionByLines = (region: DetectionScanRegion): DetectionScanRegion[] => {
  const lines = (region.linePolygons || []).filter(line => Array.isArray(line) && line.length >= 3);
  if (lines.length < 2) return [region];

  const boxes = lines.map(getLineBounds).filter((box): box is LineBounds => box !== null);
  if (boxes.length < 2) return [region];

  const vertical = typeof region.vertical === 'boolean' ? region.vertical : estimateVertical(boxes, region);
  const medianWidth = median(boxes.map(box => box.width));
  const medianHeight = median(boxes.map(box => box.height));
  const padX = vertical
    ? clamp(Math.max(medianWidth * 0.75, region.width * 0.12, 0.6), 0.35, Math.max(0.8, region.width * 0.28))
    : clamp(Math.max(medianWidth * 0.08, region.width * 0.025, 0.25), 0.2, Math.max(0.5, region.width * 0.08));
  const padY = vertical
    ? clamp(Math.max(medianHeight * 0.08, region.height * 0.025, 0.25), 0.2, Math.max(0.5, region.height * 0.08))
    : clamp(Math.max(medianHeight * 0.75, region.height * 0.12, 0.6), 0.35, Math.max(0.8, region.height * 0.28));

  const expanded = boxes.map(box => ({
    ...box,
    left: box.left - padX,
    right: box.right + padX,
    top: box.top - padY,
    bottom: box.bottom + padY,
  }));

  const visited = new Array(expanded.length).fill(false);
  const groups: LineBounds[][] = [];

  for (let i = 0; i < expanded.length; i += 1) {
    if (visited[i]) continue;
    visited[i] = true;
    const stack = [i];
    const group: LineBounds[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      group.push(boxes[current]);

      for (let j = 0; j < expanded.length; j += 1) {
        if (visited[j]) continue;
        if (!intersects(expanded[current], expanded[j])) continue;
        visited[j] = true;
        stack.push(j);
      }
    }

    groups.push(group);
  }

  if (groups.length < 2) return [region];

  const blockArea = Math.max(region.width * region.height, 0.0001);
  const validGroups = groups
    .map(group => {
      const left = Math.min(...group.map(box => box.left));
      const top = Math.min(...group.map(box => box.top));
      const right = Math.max(...group.map(box => box.right));
      const bottom = Math.max(...group.map(box => box.bottom));
      return {
        boxes: group,
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        area: (right - left) * (bottom - top),
      };
    })
    .filter(group => {
      if (group.width < 0.8 || group.height < 0.8) return false;
      if (group.area >= blockArea * 0.045) return true;
      return group.boxes.length >= 2;
    });

  if (validGroups.length < 2) return [region];
  if (validGroups.length > 4) return [region];
  if (validGroups.length === boxes.length && boxes.length > 3) return [region];

  const totalAreaRatio = validGroups.reduce((sum, group) => sum + group.area, 0) / blockArea;
  if (totalAreaRatio < 0.15) return [region];

  const finalPadX = vertical ? clamp(medianWidth * 0.2, 0.15, 0.8) : clamp(medianWidth * 0.3, 0.2, 1.2);
  const finalPadY = vertical ? clamp(medianHeight * 0.3, 0.2, 1.2) : clamp(medianHeight * 0.2, 0.15, 0.8);

  return validGroups
    .sort((first, second) => vertical ? first.top - second.top : first.left - second.left)
    .map(group => {
      const left = clamp(group.left - finalPadX, 0, 100);
      const top = clamp(group.top - finalPadY, 0, 100);
      const right = clamp(group.right + finalPadX, 0, 100);
      const bottom = clamp(group.bottom + finalPadY, 0, 100);
      return {
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        width: Math.max(right - left, 0.5),
        height: Math.max(bottom - top, 0.5),
        maskContourBase64: region.maskContourBase64,
        linePolygons: group.boxes.map(box => box.line),
        vertical,
      };
    });
};
