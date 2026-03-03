# Export Fill Unified Strategy

## Semantic Mapping
- `baked`: fill is already written into image pixels; exporters must skip any extra overlay draw.
- `rect`: export full region rectangle fill.
- `contour`: export contour-only fill (character-rect path or dilated mask path).

## Affected Entry Paths
- Single image download (`downloadSingleImage` -> `compositeDispatch`)
- ZIP export (`downloadAllAsZip` -> `compositeDispatch`)
- Merge layers (`ControlPanel.onMergeLayers` -> `compositeDispatch`)
- Dispatcher:
  - `canvas`: `compositeImageWithCanvas`
  - `screenshot`: `compositeImageWithScreenshot`

## Unified Decision and Rendering
- Decision source: `resolveExportFillRenderMode` in `services/exportService.ts`.
- Canvas renderer: `drawFillMaskOnCanvas`.
- Screenshot renderer: `appendFillMaskOverlayToDom`.
- Legacy renderer (`compositeImage`) also reuses `drawFillMaskOnCanvas`.

## Rollback Trigger Conditions
- Reappearance of full-rect white block in `baked` scenarios.
- Canvas/screenshot divergence that changes visible export semantics.
- Legacy export path produces behavior different from current dispatcher path.

## Minimal Rollback Path (Safe First)
1. Keep `resolveExportFillRenderMode` and force `baked -> skip` behavior.
2. If regression persists, revert helper wiring in one exporter at a time:
   - first `compositeImageWithScreenshot`
   - then `compositeImageWithCanvas`
   - finally legacy `compositeImage`
3. Re-run:
   - `npm run check:export-fill`
   - `npm run build`
4. Execute manual regression checklist:
   - `docs/export-fill-regression-log.md` (`R01` to `R06`).

## Verification Checklist After Rollback
- `baked` never draws rectangle overlay in export image.
- `rect` fallback remains unchanged.
- `contour` output remains contour-shaped (char-rect or mask-based).
