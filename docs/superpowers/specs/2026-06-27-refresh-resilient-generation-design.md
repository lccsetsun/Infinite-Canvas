# Refresh Resilient Generation Design

## Goal

Make canvas refreshes, tab closes, and navigation away from the canvas resilient against losing newly created nodes, generation placeholders, and recoverable background task state.

The backend currently exposes polling only for:

- video generation tasks
- batch image replacement tasks

Because text generation and image generation do not have polling query endpoints, the frontend cannot recover the result of an interrupted text or image request after a browser refresh. The design therefore separates recoverable tasks from non-recoverable running requests.

## Scope

In scope:

- persist newly created nodes, links, groups, and generated placeholder nodes more aggressively
- add an explicit remote persist flush path for important transitions
- preserve and resume video generation polling after refresh
- preserve and resume batch image replacement polling after refresh
- convert non-recoverable text, image, audio, and upload loading states into an interrupted retry state after refresh
- warn users before leaving when a non-recoverable request is running
- expose save status so users know whether the canvas has unsaved changes

Out of scope:

- adding new backend task or polling endpoints
- claiming text or image generation can recover the exact interrupted request
- changing backend task semantics for video or batch replacement
- replacing the existing remote canvas API contract

## Recommended Approach

Use a combined strategy:

- immediate remote persistence for structure-critical changes
- continued polling recovery for task types that already have backend query APIs
- explicit interrupted states for running work that cannot be queried after refresh
- leave-page protection for unsaved or non-recoverable work

This gives the strongest behavior possible without requiring new backend endpoints.

## Current Behavior

The canvas saves remote snapshots through a debounced effect. The delay is short, but a user can still refresh before the `PUT /system/canvas` request succeeds. In that window, the next page load receives the previous backend snapshot and newly created nodes or placeholders can disappear.

The current code already distinguishes some pending runtime nodes as persistable:

- pending remote video tasks
- pending batch replacement tasks
- pending batch replacement result nodes
- video auxiliary loading states

Generic running states are sanitized or skipped because they are not safely recoverable.

## Data Model

### Persist Status

Add a small persist status model inside `useWorkflowState`:

- `persistStatus: "idle" | "dirty" | "saving" | "saved" | "error"`
- `lastPersistError?: string`
- `hasUnsavedRemoteChanges: boolean`
- `hasNonRecoverableRuntimeState: boolean`

The UI can display this in the canvas header as concise save feedback.

### Interrupted Runtime State

For non-recoverable running nodes, preserve the node and its parameters but stop showing it as actively generating after refresh.

Node data should use:

- `status: "interrupted"`
- `loading: false`
- `loadingOperation: undefined`
- `interruptedReason: "refresh" | "navigation" | "upload"`
- `interruptedAt: number`

The node card should show a retry affordance using the existing run action. It should not imply the previous request is still running.

### Recoverable Task State

Keep the current task-specific fields for compatibility:

- `remoteVideoTaskId`
- `remoteVideoTaskStatus`
- `batchReplacementTaskId`
- `batchReplacementTaskStatus`
- `batchReplacementRunId`
- `batchReplacementSourceNodeId`

These fields remain the source of truth for refresh recovery because they map to existing polling endpoints.

## Persistence Design

### Debounced Save

Keep the existing debounced save for normal edits so frequent dragging and typing do not flood the backend.

### Immediate Flush

Add a `flushRemotePersist(reason)` function that serializes the current persistable snapshot and sends it immediately when the canvas reaches a critical transition.

Critical transitions:

- adding a node
- inserting pasted nodes
- adding or removing links
- creating batch replacement result placeholders
- starting any generation request
- receiving a video task ID
- receiving a batch replacement task ID
- completing or failing a recoverable task

The flush should reuse the same snapshot serialization, duplicate-submit handling, and in-flight deferral rules as the current debounced persist path.

### In-Flight Save Rules

If a save is already in flight:

- identical payloads do nothing
- newer payloads are deferred until the current request settles
- the deferred save runs immediately after the in-flight request finishes

This preserves current duplicate-submit protection while reducing the refresh-loss window.

## Refresh And Navigation Protection

Register `pagehide` and `beforeunload` handlers while the canvas is open.

On page leave:

- if there are unsaved remote changes, trigger a best-effort immediate flush
- if non-recoverable runtime state exists, ask for confirmation
- if only recoverable task state exists and the latest task ID has been persisted, allow navigation

Browsers do not guarantee async requests complete during unload, so this is not the only protection. The main protection remains flushing immediately at critical transitions, before the user decides to refresh.

## Recovery Design

On remote project load:

1. Normalize nodes and links from the backend snapshot.
2. Preserve recoverable pending states.
3. Start video polling for nodes with valid `remoteVideoTaskId`.
4. Start batch replacement polling for nodes or result grids with valid batch task IDs.
5. Convert non-recoverable loading states into interrupted states.
6. Reset stale upload states into interrupted or error states with retry guidance.

The existing protection that avoids applying stale remote snapshots while local runtime state exists should remain.

## Polling Coverage

Recoverable:

- video generation via `GET /system/generator/video/{taskId}`
- batch image replacement via `GET /system/generator/batchEditImgaes/{taskId}`

Not recoverable:

- text generation direct requests
- image generation direct requests
- audio generation while it has no implemented backend flow
- local file uploads that have not completed

For non-recoverable work, the user experience is retry, not resume.

## UI Behavior

### Save Status

Canvas header should show a compact save indicator:

- saving
- saved
- unsaved changes
- save failed

This should be subtle and not block normal canvas work.

### Interrupted Nodes

Text and image nodes interrupted by refresh should:

- keep their prompt, model, references, and other properties
- stop showing loading spinners
- show a concise interrupted message
- offer the existing generate action again

The copy should avoid suggesting that the previous generation can still finish.

### Leave Confirmation

When the user refreshes or leaves during text/image generation:

- explain that the current request cannot be recovered after leaving
- clarify that the node and parameters will be preserved
- allow the user to stay or leave

## Error Handling

Persist errors should:

- set `persistStatus` to `error`
- keep the dirty snapshot pending
- retry through the existing remote persist retry path
- avoid applying remote snapshots that are older than pending local changes

Polling errors should:

- keep recoverable nodes in loading state when the task is still valid
- record the latest task error message
- continue polling unless the task explicitly reaches a terminal error

Interrupted non-recoverable nodes should not retry automatically after refresh. Automatic retry could duplicate a text or image generation request.

## Testing Plan

Add focused tests for:

- critical transitions request an immediate remote flush
- pending local changes block stale remote snapshots
- recoverable video tasks still collect poll targets after refresh
- recoverable batch replacement tasks still collect poll targets after refresh
- ordinary text/image loading states convert to interrupted after refresh
- upload loading states convert to interrupted or error after refresh
- leave protection reports non-recoverable runtime state
- duplicate-submit errors remain idempotent

Existing tests for remote video and batch replacement parsing should remain unchanged.

## Risks

### Risk: Async unload saves are unreliable

Browsers may cancel async work during unload.

Mitigation:

- flush at critical transitions before unload
- use unload handlers only as a last best-effort layer

### Risk: Text and image generation appear recoverable when they are not

Without query endpoints, the frontend cannot fetch the result of an interrupted request.

Mitigation:

- use an explicit interrupted state
- keep retry copy clear
- do not auto-retry after refresh

### Risk: More frequent saves increase backend load

Immediate flushing on every small edit would be noisy.

Mitigation:

- reserve immediate flush for structural and generation lifecycle transitions
- keep debounce for normal typing, dragging, and low-risk edits

## Success Criteria

The work is successful when:

- newly created nodes and placeholders do not disappear after refresh once critical-transition flush succeeds
- video generation continues polling after refresh
- batch replacement continues polling after refresh
- text and image nodes interrupted by refresh keep their parameters and show a retryable interrupted state
- the user receives a warning before leaving during non-recoverable generation
- save state is visible enough to explain whether the canvas is safe to refresh
