# Freehand Baseline Summary

- generated_at: 2026-03-04T12:49:05.547Z
- input: scripts/perf/fixtures/freehand-baseline-sample.json
- scenarios: scripts/perf/freehand-baseline-scenarios.json
- browser: Fixture-Only
- machine: Fixture-Only

## 4MP (2304x1728)
- run_count: 3
- Avg FPS: mean=53.00, fluctuation=3.77% (3 runs)
- P95 Pen-Up Block (ms): mean=11.53, fluctuation=6.94% (3 runs)
- Peak Memory (MB): mean=648.67, fluctuation=2.00% (3 runs)
- Export (ms): mean=177.67, fluctuation=3.94% (3 runs)

## 8MP (3264x2448)
- run_count: 3
- Avg FPS: mean=38.00, fluctuation=5.26% (3 runs)
- P95 Pen-Up Block (ms): mean=19.43, fluctuation=6.69% (3 runs)
- Peak Memory (MB): mean=894.33, fluctuation=2.91% (3 runs)
- Export (ms): mean=321.67, fluctuation=4.66% (3 runs)

## Validation
- PASS: all scenarios satisfy duration/repeats/metrics and fluctuation <= 10%

