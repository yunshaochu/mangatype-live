# Freehand Performance Baseline

This folder standardizes baseline measurement inputs and validation outputs for
the freehand performance workstream.

## Files

- `freehand-baseline-scenarios.json`: canonical 4MP/8MP scenario config
- `freehand-baseline-results.template.json`: result schema template for real runs
- `check-freehand-baseline.mjs`: validator and summary generator
- `generate-freehand-samples.ps1`: deterministic 4MP/8MP image generator
- `freehand-baseline-runbook.md`: standard benchmark procedure
- `fixtures/freehand-baseline-sample.json`: fixture for script sanity checks

## Capture Requirements

- run both `4mp` and `8mp` scenarios
- each run lasts `>= 30s`
- each scenario has at least `3` runs
- required metrics per run:
  - `avgFps`
  - `p95PenUpBlockMs`
  - `peakMemoryMb`
  - `exportMs`
- fluctuation per metric must be `<= 10%`

## Usage

Run against fixture data:

```bash
npm run perf:freehand:check -- --input scripts/perf/fixtures/freehand-baseline-sample.json
```

Generate fixed benchmark sample images:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/perf/generate-freehand-samples.ps1
```

Run against real captured data:

```bash
npm run perf:freehand:check -- --input <your-results.json> --out artifacts/perf/freehand-baseline-summary.md
```

If validation fails, the command exits with code `1` and prints the failed rule.
