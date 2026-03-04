# Freehand Baseline Runbook

This runbook defines the standard manual benchmark for `FHOPT-000`.

## 1. Preconditions

- use generated sample images:
  - `artifacts/perf/samples/freehand-4mp.png`
  - `artifacts/perf/samples/freehand-8mp.png`
- browser: record full browser version in result `meta.browser`
- machine: record CPU/GPU/RAM summary in result `meta.machine`
- app build: current local branch at target commit

## 2. Standard Script (per run)

For each scenario (`4mp`, `8mp`), execute 3 runs:

1. import the scenario image
2. switch to freehand brush mode
3. draw continuously for 30 seconds using a repeating zigzag stroke pattern
4. end stroke and capture:
   - `avgFps`
   - `p95PenUpBlockMs`
   - `peakMemoryMb`
   - `exportMs`
5. write one run entry into the results JSON

## 3. Result File

Copy `scripts/perf/freehand-baseline-results.template.json` and fill all runs.

## 4. Validation

```bash
npm run perf:freehand:check -- --input <your-results.json> --out artifacts/perf/freehand-baseline-summary.md
```

Validation passes only when:

- each scenario has at least 3 runs
- each run duration is at least 30s
- all required metrics exist and are numeric
- per-metric fluctuation is not greater than 10%
