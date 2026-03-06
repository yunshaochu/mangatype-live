import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const cwd = process.cwd();
const baselinePath = path.join(cwd, 'scripts', 'perf', 'contour-intersection-baseline.json');

const config = {
  maskCount: 50,
  contourCount: 200,
  warmupRuns: 80,
  measureRuns: 320,
};

const seededRand = (() => {
  let seed = 1337;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
})();

const makeMasks = (count) =>
  Array.from({ length: count }, () => {
    const width = 4 + seededRand() * 22;
    const height = 3 + seededRand() * 18;
    const x = width / 2 + seededRand() * (100 - width);
    const y = height / 2 + seededRand() * (100 - height);
    return { x, y, width, height };
  });

const makeContours = (count) =>
  Array.from({ length: count }, (_, i) => {
    const w = 2 + seededRand() * 15;
    const h = 2 + seededRand() * 12;
    const x = w / 2 + seededRand() * (100 - w);
    const y = h / 2 + seededRand() * (100 - h);
    const left = x - w / 2;
    const top = y - h / 2;
    return { id: `c${i}`, x, y, w, h, left, top, right: left + w, bottom: top + h };
  });

const countIntersections = (masks, contours) => {
  let count = 0;
  for (const mask of masks) {
    const maskLeft = mask.x - mask.width / 2;
    const maskTop = mask.y - mask.height / 2;
    const maskRight = maskLeft + mask.width;
    const maskBottom = maskTop + mask.height;
    for (const contour of contours) {
      const intersects =
        contour.right > maskLeft &&
        contour.bottom > maskTop &&
        contour.left < maskRight &&
        contour.top < maskBottom;
      if (intersects) count++;
    }
  }
  return count;
};

const runBenchmark = () => {
  const masks = makeMasks(config.maskCount);
  const contours = makeContours(config.contourCount);
  let lastCount = 0;

  for (let i = 0; i < config.warmupRuns; i++) {
    lastCount = countIntersections(masks, contours);
  }

  const t0 = performance.now();
  for (let i = 0; i < config.measureRuns; i++) {
    lastCount = countIntersections(masks, contours);
  }
  const totalMs = performance.now() - t0;
  const avgMs = totalMs / config.measureRuns;

  return {
    scenario: '50_masks_x_200_contours',
    warmupRuns: config.warmupRuns,
    measureRuns: config.measureRuns,
    totalMs: Number(totalMs.toFixed(4)),
    avgMs: Number(avgMs.toFixed(6)),
    intersectionsPerRun: lastCount,
  };
};

const metrics = runBenchmark();
fs.writeFileSync(
  baselinePath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      metrics,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(`[perf:contour:check] baseline updated ${path.relative(cwd, baselinePath)}`);
console.log(JSON.stringify(metrics));
