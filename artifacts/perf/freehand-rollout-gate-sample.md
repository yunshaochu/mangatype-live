# Freehand Rollout Gate

- generated_at: 2026-03-04T13:28:29.330Z
- phase: phase1
- baseline: scripts/perf/fixtures/freehand-baseline-sample.json
- candidate: scripts/perf/fixtures/freehand-regression-candidate-sample.json

## Checks
- PASS: 4mp avgFps regression <= 10% (baseline=53.00 candidate=55.33 delta=4.40%)
- PASS: 4mp p95PenUpBlock regression <= 10% (baseline=11.53 candidate=10.83 delta=-6.07%)
- PASS: 4mp peakMemory regression <= 10% (baseline=648.67 candidate=638.67 delta=-1.54%)
- PASS: 4mp exportMs regression <= 10% (baseline=177.67 candidate=171.33 delta=-3.56%)
- PASS: 8mp avgFps regression <= 10% (baseline=38.00 candidate=41.33 delta=8.77%)
- PASS: 8mp p95PenUpBlock regression <= 10% (baseline=19.43 candidate=18.03 delta=-7.20%)
- PASS: 8mp peakMemory regression <= 10% (baseline=894.33 candidate=862.67 delta=-3.54%)
- PASS: 8mp exportMs regression <= 10% (baseline=321.67 candidate=307.33 delta=-4.46%)
- PASS: pixel diff <= 0.5% (pixelDiffRate=0.22)
- PASS: eyedropper consistency delta <= 1 (eyedropperMaxRgbDelta=1)
- PASS: no P0 regression (p0RegressionCount=0)

## Decision
- PASS: rollout gate satisfied.

