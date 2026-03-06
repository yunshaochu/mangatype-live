import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const cwd = process.cwd();
const baselinePath = path.join(cwd, 'scripts', 'perf', 'contour-intersection-baseline.json');
const tolerance = 1.1; // <=10% regression allowed

if (!fs.existsSync(baselinePath)) {
  console.error(`[perf:contour:gate] baseline missing: ${path.relative(cwd, baselinePath)}`);
  console.error('Run: npm run perf:contour:check');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const base = baseline?.metrics;
if (!base || typeof base.avgMs !== 'number') {
  console.error('[perf:contour:gate] invalid baseline file');
  process.exit(1);
}

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
    return { id: `c${i}`, left, top, right: left + w, bottom: top + h };
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

const run = ({ maskCount, contourCount, warmupRuns, measureRuns }) => {
  const masks = makeMasks(maskCount);
  const contours = makeContours(contourCount);
  let lastCount = 0;

  for (let i = 0; i < warmupRuns; i++) lastCount = countIntersections(masks, contours);
  const t0 = performance.now();
  for (let i = 0; i < measureRuns; i++) lastCount = countIntersections(masks, contours);
  const totalMs = performance.now() - t0;
  const avgMs = totalMs / measureRuns;

  return {
    scenario: '50_masks_x_200_contours',
    warmupRuns,
    measureRuns,
    totalMs: Number(totalMs.toFixed(4)),
    avgMs: Number(avgMs.toFixed(6)),
    intersectionsPerRun: lastCount,
  };
};

const current = run({
  maskCount: base.maskCount ?? 50,
  contourCount: base.contourCount ?? 200,
  warmupRuns: base.warmupRuns ?? 80,
  measureRuns: base.measureRuns ?? 320,
});

const limit = base.avgMs * tolerance;
if (current.avgMs > limit) {
  console.error('[perf:contour:gate] failed');
  console.error(`- baseline avgMs=${base.avgMs}`);
  console.error(`- current avgMs=${current.avgMs}`);
  console.error(`- limit avgMs=${Number(limit.toFixed(6))} (10% tolerance)`);
  process.exit(1);
}

console.log('[perf:contour:gate] passed');
console.log(JSON.stringify({ baselineAvgMs: base.avgMs, currentAvgMs: current.avgMs, limitAvgMs: Number(limit.toFixed(6)) }));
