# API Protection Refactor Boundary Baseline (APRSM-000)

## Scope Source
- This boundary baseline is anchored to `Report.md` section 7 acceptance criteria.
- Only translation endpoint protection behavior is in scope for the reducer/event-queue refactor.

## In-Scope Modules
- `services/apiProtection.ts`: event protocol, failure classification, reducer transitions.
- `hooks/useProcessor.ts`: translation scheduler and protection event dispatch path.
- `services/geminiService.ts`: translation failure normalization inputs.
- `components/settings/ProviderTab.tsx`: disable reason and effective concurrency display.
- `types.ts` and `contexts/ProjectContext.tsx`: endpoint state fields and persistence compatibility.

## Out-of-Scope Modules
- Inpaint workflow behavior and API calls.
- Scan workflow behavior and local detection flow.
- Export, canvas rendering, and unrelated settings behavior.

## Rollout and Rollback
- Rollout is limited to translation endpoint protection state machine V2.
- Rollback touchpoint A: switch off `apiProtectionStateMachineV2`.
- Rollback touchpoint B: if throughput or disable behavior regresses, fall back to prior logic while keeping storage compatibility.
- Rollback touchpoint C: UI-only display regressions roll back presentation first.

## Smoke Regression Checklist (Non-target Flows)
- Translation flow: protection-path scenarios verified by related refactor issues.
- Inpaint flow: no behavior change expected in this issue.
- Scan flow: no behavior change expected in this issue.

## Acceptance Binding
- Batch failure counting, degraded concurrency recovery, and persistent disable reason follow `Report.md` section 7 criteria.
