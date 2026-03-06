# Contour Decoupling Manual Regression

## Preconditions
- At least one scanned mask region with `maskContourBase64`.
- `usePreciseFill=true`.
- `showContourPreview=true`.

## Cases
1. Preview clip behavior
- Move red mask box while keeping contour anchor fixed.
- Expected: orange contour does not follow red box, and only overlap area is visible.

2. Single precise fill
- Fill selected mask in precise mode.
- Expected: only the overlap of contour and mask box is painted; outside overlap stays unchanged.

3. Pre-inpaint contour prefill
- Enable pre-inpaint contour and run erase for selected mask.
- Expected: prefill effect is limited to contour/mask overlap area.

4. Export consistency
- Export same page through both canvas and screenshot(DOM) paths.
- Expected: contour-filled area looks equivalent between both outputs.
