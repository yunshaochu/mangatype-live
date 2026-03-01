# Stop Translation State Machine (Design Contract)

This document defines the stop-consistency contract for translation batch execution.
It is the implementation boundary for `MTL-010`.

## Goals

- Stop must be deterministic from UI perspective.
- In-flight late responses must not write back after stop.
- The rules must support both single-image and batch translation paths.

## Runtime Concepts

- `runId`: Monotonic id assigned at task start.
- `activeRunId`: Current accepted run id; stop invalidates it.
- `abortController`: Transport-level cancellation best effort.
- `writeGate`: Logic-level guard that drops stale writes when `runId` is stale.

## State Machine

### Batch Lifecycle

1. `IDLE` -> `RUNNING`
   - Allocate new `runId`.
   - Set `activeRunId = runId`.
   - Set batch flags (`isProcessingBatch=true`, `processingType=translate`).

2. `RUNNING` -> `STOPPING`
   - Triggered by Stop button.
   - Abort all known controllers.
   - Immediately rollback image status for `status=processing` to `idle`.
   - Invalidate `activeRunId` so no late writes can pass.

3. `STOPPING` -> `IDLE`
   - Cleanup batch flags.
   - Keep image states stable at rolled-back values unless a new run starts.

### Write Gate Rule

For every async success/error write path:

- Before `setImages` write:
  - If `runId !== activeRunId`, drop write.
  - If `signal.aborted`, drop write.

This rule is required after each major `await` boundary in translation path.

## Required Logging

- On run start: `run_start runId=<id> queue=<n>`.
- On stop click: `run_stop requested runId=<id>`.
- On stale write drop: `run_drop_stale runId=<old> active=<new> image=<id>`.
- On transition to idle: `run_end runId=<id> reason=<completed|stopped|error>`.

## Acceptance Mapping

- Immediate rollback is guaranteed by STOPPING transition action.
- Late response overwrite is prevented by write gate.
- Deterministic behavior is auditable by required logs.
