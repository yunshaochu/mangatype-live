# Contour Decoupling Acceptance Baseline

## Scope
- Goal: contour exists independently from red mask box and only appears/effects inside red box range.
- In-scope chains:
  1. Editor contour preview
  2. Single-mask precise fill
  3. Batch precise fill
  4. Pre-inpaint contour prefill
  5. Export consistency (DOM/Canvas)

## Non-goals
- No redesign of mask drawing UX.
- No changes to unrelated translation pipeline behavior.

## Checklist (Executable)
1. Preview behavior
- Move red box: contour anchor stays fixed.
- Shrink red box: contour only visible inside red box.
- Move red box away: contour becomes fully hidden when no overlap.

2. Single precise fill
- Fill affects only intersection area (contour ∩ red box).
- Pixels outside intersection remain unchanged.

3. Batch precise fill
- Same intersection rule applied per mask.
- No cross-mask contamination.

4. Pre-inpaint contour prefill
- Prefill writes only within intersection area.
- Inpaint source outside intersection remains unchanged.

5. Export consistency
- DOM export and Canvas export produce equivalent visual result for contour area.

## Evidence Log
- Baseline checklist created: yes
- Baseline source refs reviewed: report.md, plan file, workspace/export call chain
- Regression run record: to be attached after implementation issues are complete
