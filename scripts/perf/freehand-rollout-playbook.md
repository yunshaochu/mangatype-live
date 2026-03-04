# Freehand Rollout Playbook

This playbook defines release gating for `FHOPT-090`.

## Inputs

- baseline result file (from `FHOPT-000`)
- candidate result file (current build)
- regression signals:
  - `pixelDiffRate`
  - `eyedropperMaxRgbDelta`
  - `p0RegressionCount`
  - `monitoringStableHours` (required for phase2 full rollout)

## Gate Command

```bash
npm run perf:freehand:gate -- --baseline <baseline.json> --candidate <candidate.json> --phase phase1
```

Phase options:

- `phase1`
- `phase2-canary`
- `phase2-full` (requires `monitoringStableHours >= 24`)

## Rollout Policy

1. `phase1` pass: keep `freehandPerfPhase1Enabled=true` as default.
2. `phase2-canary` pass: enable `freehandPerfPhase2Enabled` only for target high-resolution scenarios.
3. `phase2-full` pass: requires no P0 regression and monitoring stability for at least 24 hours.

## Rollback Policy

- if any P0/P1 regression appears after rollout:
  - set `freehandPerfPhase2Enabled=false` immediately
  - if impact remains, set `freehandPerfPhase1Enabled=false`
  - target rollback completion within 30 minutes
  - capture RCA summary in incident notes
