# API Protection Refactor Test Baseline (APRSM-070)

## Executed Checks
- `npx --yes tsx services/apiProtectionClassification.test.ts`
- `npx --yes tsx services/apiProtectionReducer.test.ts`
- `npx --yes tsx services/apiProtectionEventQueue.test.ts`
- `npx tsc --noEmit`
- `npm run build`

## Coverage Mapping
- Failure classification parity:
  - `HTTP_429` and `PARSE_BUBBLES_INVALID` both classify as protectable and trigger the same protection path.
- Reducer transitions:
  - Batch failure increments by exactly `+1`.
  - First failure degrades to `effectiveConcurrency=1`.
  - Success in degraded mode restores user concurrency and clears counters.
  - Mixed failure reason priority is deterministic.
- Event queue ordering:
  - Stale events (`event_seq` older than latest) are dropped.
  - Latest sequence wins, preventing slow writeback overwrite.

## Limited Validation
- UI regression assertions (disable reason persistence after pause expiry) are manual due no frontend test harness in repo.
- Throughput baseline comparison is manual due no stable load profile fixture.
