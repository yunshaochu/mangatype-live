# Scope Baseline

Date: 2026-03-01
Source: Report.md

This document freezes the implementation boundary and acceptance baseline for the four Report requirements.

## Requirement Mapping

### R1. Remove concurrency max cap (min stays 1)

- Scope boundary:
  - Remove UI hard max clamp for global and endpoint concurrency.
  - Keep lower bound at 1.
  - Add soft warning for high values (non-blocking).
- Implemented in:
  - `components/ControlPanel.tsx`
  - `components/settings/ProviderTab.tsx`
- Acceptance criteria:
  - Input can persist values over previous max limits.
  - Input values below 1 are normalized to 1.
  - High concurrency warning appears (no hard block).

### R2. Stop translation must rollback processing state immediately

- Scope boundary:
  - On Stop, all currently processing images rollback to idle immediately.
  - Late async results from old run must not write back to UI.
  - Loading spinner must not remain after Stop.
- Implemented in:
  - `hooks/useProcessor.ts`
  - Design contract: `STOP_TRANSLATION_STATE_MACHINE.md`
- Acceptance criteria:
  - After pressing Stop, processing count drops to 0 immediately.
  - No stale write-back to done state from invalidated run.
  - Spinner marker is cleared with processing state rollback.

### R3. Add endpoint capability test (basic/function-calling/json-mode)

- Scope boundary:
  - Add endpoint test entry in provider settings.
  - Provide three checks: basic, function-calling, json-mode.
  - Keep advanced checks visually collapsible to reduce UI noise.
- Implemented in:
  - `services/endpointTestService.ts`
  - `components/settings/ProviderTab.tsx`
- Acceptance criteria:
  - Test result shows pass/fail and error reason per capability.
  - Basic result visible directly.
  - Function-calling and json-mode results are under collapsible section.

### R4. Add skipped export original-image toggle

- Scope boundary:
  - Add config toggle `exportSkippedAsOriginal`.
  - When ON, skipped images export original on single download/ZIP/batch/merge.
  - When OFF, keep existing composited export behavior.
- Implemented in:
  - `types.ts`
  - `contexts/ProjectContext.tsx`
  - `components/settings/AdvancedTab.tsx`
  - `components/ControlPanel.tsx`
  - `components/Gallery.tsx`
  - `services/exportService.ts`
  - `services/i18n.ts`
- Acceptance criteria:
  - ON path exports original without translated overlays.
  - OFF path keeps current composited result.
  - Single/ZIP/batch/merge paths are behavior-consistent.

## Out of Scope (Freeze)

- No new architecture or unrelated refactors.
- No additional endpoint management features beyond capability test.
- No hard reintroduction of concurrency max cap.

## Regression Entry Points

- Build check: `npm run build`
- Manual flows:
  - Start translation -> Stop -> verify rollback/no stale spinner.
  - Toggle skipped-export ON/OFF -> run single and ZIP export.
  - Provider endpoint test -> verify basic + collapsible advanced checks.

## Traceability

- Plan: `plan/2026-03-01_22-41-14-generate-plan-from-report-md.md`
- Report: `Report.md`
- Issue tracking source: `issues/2026-03-01_22-52-45-generate-plan-from-report-md.csv`
