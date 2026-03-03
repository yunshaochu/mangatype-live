# Export Fill Validation Matrix

## Scope
- Goal: verify editor and export consistency for fill semantics (`baked`, `rect`, `contour`).
- Export methods: `canvas`, `screenshot`.
- Entry points: single-image download, ZIP export, merge layers.

## Baseline Rules
- `baked`: must not draw any extra rectangle overlay during export.
- `rect`: must export full region rectangle fill.
- `contour`: must export contour-only fill (char-rect or mask-based mode).

## Test Matrix
| ID | preciseFill | useCharRects | fillMode source | exportMethod | entry | Expected |
|---|---|---|---|---|---|---|
| M01 | on | true | baked (single box fill) | canvas | single | No full-rect white block; only contour effect remains in output. |
| M02 | on | false | baked (single box fill) | canvas | single | No full-rect white block; dilated contour behavior only. |
| M03 | on | true | baked (single box fill) | screenshot | single | No full-rect white block; visual semantics match canvas. |
| M04 | on | false | baked (single box fill) | screenshot | single | No full-rect white block; visual semantics match canvas. |
| M05 | off | n/a | rect | canvas | single | Full region rectangle is filled in export image. |
| M06 | off | n/a | rect | screenshot | single | Full region rectangle is filled in export image. |
| M07 | on | true | baked | canvas | zip | ZIP output stays consistent with editor (no extra rect fill). |
| M08 | on | false | baked | screenshot | zip | ZIP output stays consistent with editor (no extra rect fill). |
| M09 | on | true | baked | canvas | merge | Merged image has no extra rect fill; result is reusable as new base. |
| M10 | on | false | baked | screenshot | merge | Merged image has no extra rect fill; result is reusable as new base. |

## Execution Record Template
| ID | Input image | Operation steps | Actual result | Pass/Fail | Evidence path |
|---|---|---|---|---|---|
| Mxx | `<name>` | `<short steps>` | `<observed behavior>` | `<pass/fail>` | `<artifacts/...>` |

## Pass Criteria
1. All `baked` scenarios (`M01-M04`, `M07-M10`) show no rectangular re-fill in exported output.
2. `rect` fallback scenarios (`M05-M06`) keep expected full-region fill behavior.
3. No regression in entry-path behavior among single, ZIP, and merge flows.
