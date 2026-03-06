# Contour Decoupling Rollout and Rollback

## Rollout Strategy
1. Pre-check
- Run `npm run check:contour-decoupling`.
- Run `npm run build`.
- Confirm manual regression checklist in `docs/contour-decoupling-manual-regression.md`.

2. Controlled enablement
- Keep existing fallback semantics:
  - contour anchor uses `maskContourX/maskContourY` when present.
  - fallback to `x/y` for legacy data.
- Enable `showContourPreview` and `usePreciseFill` only for validation batches first.

3. Acceptance gate
- Preview: contour moves independently and is clipped to red mask box.
- Fill/erase: only affects overlap area (contour ∩ red box).
- Export: DOM and Canvas outputs match.

## Rollback Strategy
1. Functional rollback (no code revert)
- Set `showContourPreview=false`.
- Set `usePreciseFill=false` to return to rect-mode fill behavior.
- Keep existing project data untouched.

2. Code rollback (if functional rollback is insufficient)
- Revert the contour decoupling commit range.
- Re-run `npm run build`.
- Re-verify legacy project loading.

3. Data compatibility guarantee
- Legacy entries without `maskContourX/maskContourY` must continue using `x/y`.
- No migration task required for existing saved projects.

## Drill Checklist
- Toggle feature flags on/off and verify behavior changes are immediate.
- Open a legacy project and a newly scanned project in the same session.
- Validate export and restore operations after toggling flags.
