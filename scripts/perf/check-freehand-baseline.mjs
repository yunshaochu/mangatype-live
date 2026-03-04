import fs from "node:fs";
import path from "node:path";

const DEFAULT_SCENARIOS = "scripts/perf/freehand-baseline-scenarios.json";
const DEFAULT_INPUT = "scripts/perf/freehand-baseline-results.template.json";
const DEFAULT_OUTPUT = "artifacts/perf/freehand-baseline-summary.md";
const MAX_FLUCTUATION_PERCENT = 10;

function parseArgs(argv) {
  const args = {
    scenarios: DEFAULT_SCENARIOS,
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scenarios") {
      args.scenarios = argv[++i];
    } else if (arg === "--input") {
      args.input = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--no-out") {
      args.out = "";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function fluctuationPercent(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  if (avg === 0) return Number.POSITIVE_INFINITY;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return ((max - min) / avg) * 100;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "NaN";
  return value.toFixed(2);
}

function toMetricLabel(key) {
  if (key === "avgFps") return "Avg FPS";
  if (key === "p95PenUpBlockMs") return "P95 Pen-Up Block (ms)";
  if (key === "peakMemoryMb") return "Peak Memory (MB)";
  if (key === "exportMs") return "Export (ms)";
  return key;
}

function validateRun(run, requiredMetrics, minDurationSec, scenarioId, index) {
  const errors = [];
  if (typeof run !== "object" || run === null) {
    errors.push(`${scenarioId}[${index}] is not an object`);
    return errors;
  }
  if (typeof run.durationSec !== "number" || run.durationSec < minDurationSec) {
    errors.push(
      `${scenarioId}[${index}].durationSec must be >= ${minDurationSec}, got ${run.durationSec}`
    );
  }
  for (const metric of requiredMetrics) {
    if (typeof run[metric] !== "number" || Number.isNaN(run[metric])) {
      errors.push(`${scenarioId}[${index}].${metric} must be a number`);
    }
  }
  return errors;
}

function run() {
  const args = parseArgs(process.argv);
  const scenariosConfig = readJson(args.scenarios);
  const result = readJson(args.input);

  const scenarios = scenariosConfig.scenarios || [];
  const requiredMetrics = scenariosConfig.requiredMetrics || [];
  const allErrors = [];
  const summary = [];

  for (const scenario of scenarios) {
    const scenarioId = scenario.id;
    const repeats = scenario.repeats ?? 3;
    const minDurationSec = scenario.durationSec ?? 30;
    const runs = result.scenarios?.[scenarioId];
    if (!Array.isArray(runs)) {
      allErrors.push(`Missing scenario results: ${scenarioId}`);
      continue;
    }
    if (runs.length < repeats) {
      allErrors.push(
        `${scenarioId} needs at least ${repeats} runs, got ${runs.length}`
      );
    }

    runs.forEach((runItem, index) => {
      allErrors.push(
        ...validateRun(runItem, requiredMetrics, minDurationSec, scenarioId, index)
      );
    });

    const metricStats = {};
    for (const metric of requiredMetrics) {
      const values = runs
        .map((runItem) => runItem[metric])
        .filter((value) => typeof value === "number" && Number.isFinite(value));
      const avg = mean(values);
      const fluctuation = fluctuationPercent(values);
      if (values.length > 0 && fluctuation > MAX_FLUCTUATION_PERCENT) {
        allErrors.push(
          `${scenarioId}.${metric} fluctuation ${formatNumber(
            fluctuation
          )}% exceeds ${MAX_FLUCTUATION_PERCENT}%`
        );
      }
      metricStats[metric] = { avg, fluctuation, count: values.length };
    }

    summary.push({
      id: scenarioId,
      label: scenario.label || scenarioId,
      width: scenario.width,
      height: scenario.height,
      runs: runs.length,
      metricStats,
    });
  }

  const lines = [];
  lines.push("# Freehand Baseline Summary");
  lines.push("");
  lines.push(`- generated_at: ${new Date().toISOString()}`);
  lines.push(`- input: ${args.input}`);
  lines.push(`- scenarios: ${args.scenarios}`);
  if (result.meta?.browser) lines.push(`- browser: ${result.meta.browser}`);
  if (result.meta?.machine) lines.push(`- machine: ${result.meta.machine}`);
  lines.push("");

  for (const item of summary) {
    lines.push(`## ${item.label} (${item.width}x${item.height})`);
    lines.push(`- run_count: ${item.runs}`);
    for (const [metric, stat] of Object.entries(item.metricStats)) {
      lines.push(
        `- ${toMetricLabel(metric)}: mean=${formatNumber(
          stat.avg
        )}, fluctuation=${formatNumber(stat.fluctuation)}% (${stat.count} runs)`
      );
    }
    lines.push("");
  }

  if (allErrors.length > 0) {
    lines.push("## Validation");
    allErrors.forEach((err) => lines.push(`- FAIL: ${err}`));
  } else {
    lines.push("## Validation");
    lines.push(
      `- PASS: all scenarios satisfy duration/repeats/metrics and fluctuation <= ${MAX_FLUCTUATION_PERCENT}%`
    );
  }
  lines.push("");

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${lines.join("\n")}\n`, "utf8");
  }

  console.log(lines.join("\n"));

  if (allErrors.length > 0) {
    process.exit(1);
  }
}

run();
