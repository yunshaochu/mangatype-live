# API Protection V2 Rollback Runbook (APRSM-080)

## Feature Flag
- Flag key: `apiProtectionStateMachineV2`
- Scope: translation endpoint protection pipeline only.
- `true`: batch reducer + endpoint event queue.
- `false`: legacy request-level endpoint protection logic.

## Runtime Rollback Steps
1. Open `Settings -> API Endpoints -> API Protection Settings`.
2. Toggle `State Machine V2 Canary` to `Off`.
3. Start a translation batch and verify:
   - no batch-level effective concurrency downgrade logic is applied,
   - legacy request-level pause/disable behavior is active.

## Data Compatibility
- Existing endpoint fields (`disableReason*`, `effectiveConcurrency`, `consecutiveBatchFailures`, `lastEventSeq`) remain readable and do not break legacy mode.
- Legacy mode ignores V2-only semantics but preserves stored endpoint configuration.

## Re-enable Steps
1. Toggle `State Machine V2 Canary` back to `On`.
2. Run translation smoke:
   - one batch with forced protectable failure,
   - one recovery batch.
