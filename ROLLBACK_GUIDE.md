# Rollback Guide

This guide documents fast rollback actions for recent changes.

## Scope

- Stop consistency gate (`runId` + stop rollback behavior)
- Skipped export behavior toggle (`exportSkippedAsOriginal`)
- Unified export fill semantics (`baked|rect|contour`)
- Endpoint capability testing UI and service
- Concurrency max-limit removal in UI

## Fast Rollback (Configuration First)

1. Open Settings -> Advanced.
2. Disable `Export Skipped As Original` to restore previous export behavior for skipped images.
3. Reduce global/endpoint concurrency to a conservative value (for example `1` to `5`) if rate limiting appears.

## Code Rollback (Git)

Use commit-level rollback if behavior regression is confirmed:

1. Identify target commit via `git log --oneline`.
2. Revert specific issue commit:
   - `git revert <commit_hash>`
3. Rebuild:
   - `npm run build`
4. Re-test manual critical flows:
   - Start translation -> Stop -> verify statuses return to idle
   - Export skipped image with toggle ON/OFF
   - Endpoint test button basic + advanced section

## Suggested Rollback Order

1. Revert endpoint testing UI/service (least risky for core flow).
2. Revert export split behavior if export output mismatch is observed.
3. Revert stop consistency changes only if stop path introduces deadlock or status corruption.
4. Keep concurrency UI unclamped unless provider constraints require temporary hard cap.

## Export Fill Rollback Reference

For export fill mismatch (`baked` showing full-rect white block), use:

- `docs/export-fill-unified-strategy.md`

Follow the "Minimal Rollback Path (Safe First)" section and re-run:

- `npm run check:export-fill`
- `npm run build`
