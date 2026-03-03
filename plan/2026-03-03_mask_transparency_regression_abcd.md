# MASK-040 Regression Record (A/B/C/D)

Date: 2026-03-03
Scope: transparency semantic regression after MASK-000/010/020/030

## Environment

- Available npm scripts: `dev`, `build`, `preview`
- No project e2e runner found (`playwright/cypress/vitest/jest` not configured in scripts)
- Runtime baseline: `node v22.18.0`, `npm 10.9.3`
- Executed check: `npm run build` (pass, 2026-03-03)

## Unified Preflight Checklist (Do Not Skip)

1. Install dependencies once with `npm install`.
2. Start app with `npm run dev`.
3. Open sample workspace page at `http://localhost:3001`.
4. Use the same dataset/session for all cases and keep autosave/history enabled.
5. Execute cases strictly in this order: `Case A -> Case B -> Case C -> Case D`.
6. Do not switch branch/port/runtime config between cases; if changed, restart from Case A.

## Case A

- Scenario: red-box fill -> translate/create bubble
- Steps:
  1. Open app with `npm run dev`
  2. Draw mask box and run box fill
  3. Trigger translation or create new bubble in filled area
- Expected: bubble background is transparent inside cleaned region
- Status: LIMITED_VALIDATED_STATIC (manual runtime run required)
- Evidence:
  - Guarded async auto-color writeback to re-check latest cleaned overlap before applying detected color.
  - `npm run build` pass after change.

## Case B

- Scenario: red-box fill -> freehand brush save -> translate/create bubble
- Steps:
  1. Complete Case A step 1-2
  2. Enter brush mode and save canvas
  3. Trigger translation or create new bubble in same region
- Expected: bubble remains transparent; no duplicated overlay after save
- Status: LIMITED_VALIDATED_STATIC (manual runtime run required)
- Evidence:
  - Added `scripts/validate-mask-case-b.mjs` to assert `handlePaintSave` keeps cleaned semantics and only bakes rect overlays.
  - `node scripts/validate-mask-case-b.mjs` pass.
  - `npm run build` pass after validation script addition.

## Case C

- Scenario: purple-box inpaint -> freehand brush save -> translate/create bubble
- Steps:
  1. Run inpaint on selected region
  2. Enter brush mode and save canvas
  3. Trigger translation or create new bubble in same region
- Expected: bubble remains transparent
- Status: LIMITED_VALIDATED_STATIC (manual runtime run required)
- Evidence:
  - Added `scripts/validate-mask-case-c.mjs` to assert inpaint flow writes `method='inpaint' + isCleaned=true` and overlapping bubbles stay transparent.
  - `node scripts/validate-mask-case-c.mjs` pass.
  - `npm run build` pass after validation script addition.

## Case D

- Scenario: batch processing + undo/redo mixed red/purple workflow
- Steps:
  1. Batch fill/inpaint across pages
  2. Perform undo then redo
  3. Re-run translation/create bubble checks in cleaned regions
- Expected: transparency rule remains consistent after history operations
- Status: LIMITED_VALIDATED_STATIC (manual runtime run required)
- Evidence:
  - Added `scripts/validate-mask-case-d.mjs` to verify batch fill transparency writeback, drag-end overlap guard, and undo/redo stack semantics.
  - `node scripts/validate-mask-case-d.mjs` pass.
  - `npm run build` pass after validation script addition.

## Static Evidence (Code-Level)

- `handlePaintSave` no longer resets `isCleaned` for fill overlays:
  - `contexts/ProjectContext.tsx:668`
  - `contexts/ProjectContext.tsx:675`
  - `scripts/validate-mask-case-b.mjs:20`
- Transparency checks use semantic cleaned helper in all target entry points:
  - `contexts/ProjectContext.tsx:706`
  - `contexts/ProjectContext.tsx:720`
  - `contexts/ProjectContext.tsx:360`
  - `contexts/ProjectContext.tsx:576`
  - `contexts/ProjectContext.tsx:747`
  - `hooks/useCanvasInteraction.ts:194`
  - `hooks/useCanvasInteraction.ts:215`
  - `hooks/useCanvasInteraction.ts:365`
  - `hooks/useProcessor.ts:284`
  - `scripts/validate-mask-case-c.mjs:20`
  - `scripts/validate-mask-case-d.mjs:21`
- Entry-point static audit:
  - `scripts/validate-mask-entrypoints.mjs:15`
  - Result: no cleaned-semantic entry point found to overwrite cleaned-region bubbles to non-transparent.

## Conclusion

- Automated e2e execution is limited by current repo test setup.
- Build check passes, and static code path review matches the expected semantic contract.
- Static audit scripts (`case-b/c/d + entrypoints`) pass in the current branch.
- Manual A/B/C/D UI execution remains required to fully close runtime regression risk.
