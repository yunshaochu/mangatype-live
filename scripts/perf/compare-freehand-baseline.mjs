import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASELINE = "scripts/perf/fixtures/freehand-baseline-sample.json";
const DEFAULT_CANDIDATE = "scripts/perf/fixtures/freehand-regression-candidate-sample.json";
const DEFAULT_OUTPUT = "artifacts/perf/freehand-rollout-gate-summary.md";

function parseArgs(argv) {
  const args = {
    baseline: DEFAULT_BASELINE,
    candidate: DEFAULT_CANDIDATE,
    out: DEFAULT_OUTPUT,
    phase: "phase1",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--baseline") args.baseline = argv[++i];
    else if (arg === "--candidate") args.candidate = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--phase") args.phase = argv[++i];
    else if (arg === "--no-out") args.out = "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function scenarioMeans(result, scenarioId) {
  const runs = result.scenarios?.[scenarioId] || [];
  const avgFps = mean(runs.map((run) => run.avgFps).filter(Number.isFinite));
  const p95PenUpBlockMs = mean(
    runs.map((run) => run.p95PenUpBlockMs).filter(Number.isFinite)
  );
  const peakMemoryMb = mean(
    runs.map((run) => run.peakMemoryMb).filter(Number.isFinite)
  );
  const exportMs = mean(runs.map((run) => run.exportMs).filter(Number.isFinite));
  return { avgFps, p95PenUpBlockMs, peakMemoryMb, exportMs, runs: runs.length };
}

function pctDelta(candidate, baseline) {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline) || baseline === 0) {
    return Number.NaN;
  }
  return ((candidate - baseline) / baseline) * 100;
}

function toFixed(value) {
  if (!Number.isFinite(value)) return "NaN";
  return value.toFixed(2);
}

function addCheck(checks, name, pass, detail) {
  checks.push({ name, pass, detail });
}

function run() {
  const args = parseArgs(process.argv);
  const baseline = readJson(args.baseline);
  const candidate = readJson(args.candidate);
  const checks = [];

  for (const scenarioId of ["4mp", "8mp"]) {
    const b = scenarioMeans(baseline, scenarioId);
    const c = scenarioMeans(candidate, scenarioId);
    if (b.runs < 1 || c.runs < 1) {
      addCheck(
        checks,
        `${scenarioId} data present`,
        false,
        `baseline runs=${b.runs}, candidate runs=${c.runs}`
      );
      continue;
    }

    const fpsDelta = pctDelta(c.avgFps, b.avgFps);
    const blockDelta = pctDelta(c.p95PenUpBlockMs, b.p95PenUpBlockMs);
    const memoryDelta = pctDelta(c.peakMemoryMb, b.peakMemoryMb);
    const exportDelta = pctDelta(c.exportMs, b.exportMs);

    addCheck(
      checks,
      `${scenarioId} avgFps regression <= 10%`,
      Number.isFinite(fpsDelta) && fpsDelta >= -10,
      `baseline=${toFixed(b.avgFps)} candidate=${toFixed(c.avgFps)} delta=${toFixed(fpsDelta)}%`
    );
    addCheck(
      checks,
      `${scenarioId} p95PenUpBlock regression <= 10%`,
      Number.isFinite(blockDelta) && blockDelta <= 10,
      `baseline=${toFixed(b.p95PenUpBlockMs)} candidate=${toFixed(c.p95PenUpBlockMs)} delta=${toFixed(blockDelta)}%`
    );
    addCheck(
      checks,
      `${scenarioId} peakMemory regression <= 10%`,
      Number.isFinite(memoryDelta) && memoryDelta <= 10,
      `baseline=${toFixed(b.peakMemoryMb)} candidate=${toFixed(c.peakMemoryMb)} delta=${toFixed(memoryDelta)}%`
    );
    addCheck(
      checks,
      `${scenarioId} exportMs regression <= 10%`,
      Number.isFinite(exportDelta) && exportDelta <= 10,
      `baseline=${toFixed(b.exportMs)} candidate=${toFixed(c.exportMs)} delta=${toFixed(exportDelta)}%`
    );
  }

  const signals = candidate.regressionSignals || {};
  addCheck(
    checks,
    "pixel diff <= 0.5%",
    Number.isFinite(signals.pixelDiffRate) && signals.pixelDiffRate <= 0.5,
    `pixelDiffRate=${signals.pixelDiffRate}`
  );
  addCheck(
    checks,
    "eyedropper consistency delta <= 1",
    Number.isFinite(signals.eyedropperMaxRgbDelta) && signals.eyedropperMaxRgbDelta <= 1,
    `eyedropperMaxRgbDelta=${signals.eyedropperMaxRgbDelta}`
  );
  addCheck(
    checks,
    "no P0 regression",
    signals.p0RegressionCount === 0,
    `p0RegressionCount=${signals.p0RegressionCount}`
  );

  if (args.phase === "phase2-full") {
    addCheck(
      checks,
      "phase2 full rollout requires monitoring stable >= 24h",
      Number.isFinite(signals.monitoringStableHours) && signals.monitoringStableHours >= 24,
      `monitoringStableHours=${signals.monitoringStableHours}`
    );
  }

  const failed = checks.filter((item) => !item.pass);
  const lines = [];
  lines.push("# Freehand Rollout Gate");
  lines.push("");
  lines.push(`- generated_at: ${new Date().toISOString()}`);
  lines.push(`- phase: ${args.phase}`);
  lines.push(`- baseline: ${args.baseline}`);
  lines.push(`- candidate: ${args.candidate}`);
  lines.push("");
  lines.push("## Checks");
  for (const item of checks) {
    lines.push(`- ${item.pass ? "PASS" : "FAIL"}: ${item.name} (${item.detail})`);
  }
  lines.push("");
  lines.push("## Decision");
  lines.push(
    failed.length === 0
      ? "- PASS: rollout gate satisfied."
      : `- FAIL: ${failed.length} check(s) failed.`
  );
  lines.push("");

  const output = `${lines.join("\n")}\n`;
  console.log(output);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output, "utf8");
  }
  if (failed.length > 0) process.exit(1);
}

run();
