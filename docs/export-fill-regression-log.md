# Export Fill Regression Log

Date: 2026-03-04

## Automated Evidence
- `npm run check:export-fill`: passed
- `npm run build`: passed

## End-to-End Regression Set (6 Cases)
| Case | Config | Entry | Method | Result |
|---|---|---|---|---|
| R01 | `usePreciseFill=true`, `useCharRects=true` | single export | canvas | Pending manual visual validation |
| R02 | `usePreciseFill=true`, `useCharRects=false` | single export | canvas | Pending manual visual validation |
| R03 | `usePreciseFill=true`, `useCharRects=true` | single export | screenshot | Pending manual visual validation |
| R04 | `usePreciseFill=true`, `useCharRects=false` | single export | screenshot | Pending manual visual validation |
| R05 | `usePreciseFill=true`, `useCharRects=true` | zip export | canvas/screenshot | Pending manual visual validation |
| R06 | `usePreciseFill=true`, `useCharRects=true` | merge then export | canvas/screenshot | Pending manual visual validation |

## Manual Test Procedure
1. Open app and import at least one image with detectable text contour.
2. Run contour fill once with `usePreciseFill=true`.
3. For each case `R01-R06`, export and compare with editor clean layer:
   - no full-rect white block reappears in `baked` scenarios
   - rect mode fallback remains unchanged when `usePreciseFill=false`
4. Save evidence screenshots under `artifacts/` and update each case result to `Pass/Fail`.

## Notes
- This log is generated in CLI-only environment; image-level visual comparison is not executable here.
- Use this file as the review checklist during UI verification.
