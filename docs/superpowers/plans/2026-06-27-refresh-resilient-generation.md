# Refresh Resilient Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Prevent canvas refreshes from losing saved structure, resume the two backend-supported polling tasks, and turn non-recoverable running work into a clear retryable interrupted state.

**Architecture:** Keep the existing `useWorkflowState` ownership model, but extract small pure helpers for runtime-state recovery and remote persist policy. Add an immediate flush path that reuses the existing remote snapshot serialization and duplicate-submit behavior. Surface persist status through `App` into `CanvasHeader`, while node cards read `status: "interrupted"` from existing node data.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing remote canvas APIs.

---

## File Structure

- Modify `src/types.ts`: add interrupted runtime metadata fields to `GraphNode["data"]`.
- Modify `src/hooks/useWorkflowState.ts`: add interrupted-state helpers, immediate remote flush support, persist status return values, unload protection, and recovery normalization.
- Modify `src/hooks/useWorkflowState.test.ts`: add focused helper tests and source-level checks for flush integration.
- Modify `src/utils/remotePersistPolicy.ts`: add small policy helpers for persist status and leave protection if they can stay pure.
- Modify `src/utils/remotePersistPolicy.test.ts`: cover new pure policy helpers.
- Modify `src/App.tsx`: consume persist status from `useWorkflowState` and pass it to `CanvasHeader`.
- Modify `src/components/app/CanvasHeader.tsx`: render compact save status feedback beside the project name and expose save failure detail through the status element title.
- Modify `src/components/app/CanvasHeader.test.tsx` or `src/components/app/CanvasHeader.test.ts`: add save status rendering tests following the existing test style.
- Modify `src/utils/textNodeViewState.ts` and `src/utils/textNodeViewState.test.ts`: include interrupted state for text nodes.
- Modify `src/utils/mediaNodeLoadingState.ts` and `src/utils/mediaNodeLoadingState.test.ts`: keep interrupted media nodes out of running state and expose interrupted copy if useful.

## Task 1: Interrupted Runtime State Helpers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useWorkflowState.ts`
- Test: `src/hooks/useWorkflowState.test.ts`

- [x] **Step 1: Write failing tests for non-recoverable interruption**

Add tests near `describe("sanitizeNodeRuntimeState", ...)`:

```ts
it("converts non-recoverable text and image loading states to interrupted after refresh", () => {
  const textNode: GraphNode = {
    ...makeTextNode("text-loading"),
    type: "text_node",
    properties: { status: "loading", text: "写一段文案" },
    data: { loading: true, status: "loading", loadingOperation: "generate" },
  };
  const imageNode: GraphNode = {
    ...makeTextNode("image-loading"),
    type: "image_node",
    properties: { status: "loading", prompt: "a glass house" },
    data: { loading: true, status: "loading", loadingOperation: "generate" },
  };

  const interruptedText = interruptNonRecoverableRuntimeNode(textNode, "refresh", 1000);
  const interruptedImage = interruptNonRecoverableRuntimeNode(imageNode, "refresh", 1000);

  expect(interruptedText.data).toMatchObject({
    loading: false,
    status: "interrupted",
    interruptedReason: "refresh",
    interruptedAt: 1000,
  });
  expect(interruptedText.data?.loadingOperation).toBeUndefined();
  expect(interruptedText.properties.status).toBeUndefined();
  expect(interruptedText.properties.text).toBe("写一段文案");

  expect(interruptedImage.data).toMatchObject({
    loading: false,
    status: "interrupted",
    interruptedReason: "refresh",
    interruptedAt: 1000,
  });
  expect(interruptedImage.data?.loadingOperation).toBeUndefined();
  expect(interruptedImage.properties.prompt).toBe("a glass house");
});

it("does not interrupt recoverable video or batch replacement pending nodes", () => {
  const pendingVideoNode: GraphNode = {
    ...makeTextNode("video-1"),
    type: "video_node",
    properties: { status: "loading" },
    data: {
      loading: true,
      loadingOperation: "generate",
      remoteVideoTaskId: "video-task-1",
      status: "loading",
    },
  };

  const result = interruptNonRecoverableRuntimeNode(pendingVideoNode, "refresh", 1000);

  expect(result).toBe(pendingVideoNode);
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
npm test -- --run src/hooks/useWorkflowState.test.ts
```

Expected: FAIL because `interruptNonRecoverableRuntimeNode` is not exported yet.

- [x] **Step 3: Add interrupted fields to `GraphNode["data"]`**

Add fields in `src/types.ts` under `status?: string`:

```ts
    interruptedReason?: "refresh" | "navigation" | "upload";
    interruptedAt?: number;
```

- [x] **Step 4: Implement helper in `useWorkflowState.ts`**

Add this helper after `sanitizeNodeRuntimeState`:

```ts
export type InterruptedRuntimeReason = "refresh" | "navigation" | "upload";

export function interruptNonRecoverableRuntimeNode(
  node: GraphNode,
  reason: InterruptedRuntimeReason = "refresh",
  interruptedAt = Date.now()
): GraphNode {
  if (!hasNodeRuntimeState(node)) return node;
  if (isPersistablePendingRuntimeNode(node)) return node;

  const {
    loading: _loading,
    loadingOperation: _loadingOperation,
    progress: _progress,
    uploadingAsset: _uploadingAsset,
    ...restData
  } = node.data || {};
  const { status: propertyStatus, ...restProperties } = node.properties;

  return {
    ...node,
    properties: propertyStatus === "loading" ? restProperties : node.properties,
    data: {
      ...restData,
      loading: false,
      status: "interrupted",
      interruptedReason: reason,
      interruptedAt,
    },
  };
}

function interruptNonRecoverableRuntimeNodes(
  nodes: GraphNode[],
  reason: InterruptedRuntimeReason = "refresh",
  interruptedAt = Date.now()
) {
  return nodes.map((node) => interruptNonRecoverableRuntimeNode(node, reason, interruptedAt));
}
```

- [x] **Step 5: Use helper during remote load recovery**

In the remote project effect, change:

```ts
const nextNodes = normalizeNodes(nextWorkflow.data.nodes);
```

to:

```ts
const nextNodes = interruptNonRecoverableRuntimeNodes(normalizeNodes(nextWorkflow.data.nodes));
```

- [x] **Step 6: Verify tests pass**

Run:

```bash
npm test -- --run src/hooks/useWorkflowState.test.ts
```

Expected: PASS.

## Task 2: Persist Status And Pure Policy Helpers

**Files:**
- Modify: `src/utils/remotePersistPolicy.ts`
- Modify: `src/utils/remotePersistPolicy.test.ts`
- Modify: `src/hooks/useWorkflowState.ts`

- [x] **Step 1: Write failing policy tests**

Add to `src/utils/remotePersistPolicy.test.ts`:

```ts
import { getLeaveProtectionState } from "./remotePersistPolicy";

it("requires leave protection for unsaved changes or non-recoverable runtime state", () => {
  expect(
    getLeaveProtectionState({
      hasNonRecoverableRuntimeState: false,
      hasUnsavedRemoteChanges: false,
      persistStatus: "saved",
    })
  ).toEqual({ shouldWarn: false, reason: "none" });

  expect(
    getLeaveProtectionState({
      hasNonRecoverableRuntimeState: false,
      hasUnsavedRemoteChanges: true,
      persistStatus: "dirty",
    })
  ).toEqual({ shouldWarn: true, reason: "unsaved" });

  expect(
    getLeaveProtectionState({
      hasNonRecoverableRuntimeState: true,
      hasUnsavedRemoteChanges: false,
      persistStatus: "saved",
    })
  ).toEqual({ shouldWarn: true, reason: "non-recoverable-runtime" });
});
```

- [x] **Step 2: Run failing policy tests**

Run:

```bash
npm test -- --run src/utils/remotePersistPolicy.test.ts
```

Expected: FAIL because the helper and type are missing.

- [x] **Step 3: Implement persist status policy**

Add to `src/utils/remotePersistPolicy.ts`:

```ts
export type RemotePersistStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function getLeaveProtectionState({
  hasNonRecoverableRuntimeState,
  hasUnsavedRemoteChanges,
  persistStatus,
}: {
  hasNonRecoverableRuntimeState: boolean;
  hasUnsavedRemoteChanges: boolean;
  persistStatus: RemotePersistStatus;
}) {
  if (hasNonRecoverableRuntimeState) {
    return { shouldWarn: true, reason: "non-recoverable-runtime" as const };
  }
  if (hasUnsavedRemoteChanges || persistStatus === "dirty" || persistStatus === "saving") {
    return { shouldWarn: true, reason: "unsaved" as const };
  }
  if (persistStatus === "error") {
    return { shouldWarn: true, reason: "save-error" as const };
  }
  return { shouldWarn: false, reason: "none" as const };
}
```

- [x] **Step 4: Add state to `useWorkflowState`**

Import `RemotePersistStatus`, then add state:

```ts
const [persistStatus, setPersistStatus] = useState<RemotePersistStatus>("idle");
const [lastPersistError, setLastPersistError] = useState("");
```

Return:

```ts
persistStatus,
lastPersistError,
hasUnsavedRemoteChanges: persistStatus === "dirty" || persistStatus === "saving",
hasNonRecoverableRuntimeState: nodes.some(
  (node) => hasNodeRuntimeState(node) && !isPersistablePendingRuntimeNode(node)
),
```

- [x] **Step 5: Verify policy tests**

Run:

```bash
npm test -- --run src/utils/remotePersistPolicy.test.ts
```

Expected: PASS.

## Task 3: Immediate Remote Persist Flush

**Files:**
- Modify: `src/hooks/useWorkflowState.ts`
- Test: `src/hooks/useWorkflowState.test.ts`

- [x] **Step 1: Add source-level failing tests for flush integration**

Add to `describe("useWorkflowState remote-only persistence", ...)`:

```ts
it("exposes an immediate remote persist flush path for critical transitions", () => {
  const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

  expect(source).toContain("const flushRemotePersist = useCallback");
  expect(source).toContain('flushRemotePersist("add-node")');
  expect(source).toContain('flushRemotePersist("run-node-start")');
  expect(source).toContain('flushRemotePersist("remote-video-task")');
  expect(source).toContain('flushRemotePersist("batch-result-run")');
});
```

- [x] **Step 2: Run failing test**

Run:

```bash
npm test -- --run src/hooks/useWorkflowState.test.ts
```

Expected: FAIL because `flushRemotePersist` does not exist.

- [x] **Step 3: Extract shared persist request function**

Inside `useWorkflowState`, add a callback before the debounced persist effect:

```ts
const persistRemoteSnapshot = useCallback(
  (options: { force?: boolean; reason: string }) => {
    if (!isRemoteMode || !onRemotePersist || !currentWorkflowSummary?.id) return false;

    const activeNodes = currentNodesRef.current;
    const hasPendingRuntimeState = activeNodes.some(
      (node) => hasNodeRuntimeState(node) && !isPersistablePendingRuntimeNode(node)
    );
    if (hasPendingRuntimeState) return false;

    const persistableNodes = sanitizeNodesRuntimeState(activeNodes);
    const activeLinks = currentLinksRef.current;
    const activeNodeOutputs = currentNodeOutputsRef.current;
    const activeGroups = currentGroupsRef.current;
    const persistSignature = serializeRemotePersistSnapshot({
      workflowId: currentWorkflowSummary.id,
      name: currentWorkflowSummary.name,
      category: currentWorkflowSummary.category,
      tags: currentWorkflowSummary.tags ?? [],
      nodes: persistableNodes,
      links: activeLinks,
      nodeOutputs: activeNodeOutputs,
      groups: activeGroups,
    });
    const projectSnapshot = buildRemoteProjectSnapshot(currentWorkflowSummary, {
      nodes: persistableNodes,
      links: activeLinks,
      nodeOutputs: mapToOutputs(activeNodeOutputs),
      groups: activeGroups,
    });
    const persistKey = getRemotePersistKey?.(projectSnapshot) ?? persistSignature;
    if (persistKey === lastRemotePersistSignatureRef.current) {
      setPersistStatus("saved");
      return false;
    }
    if (persistKey === inFlightRemotePersistKeyRef.current) return false;
    if (
      shouldDeferRemoteSnapshotForInFlight({
        inFlightKey: inFlightRemotePersistKeyRef.current,
        nextKey: persistKey,
      })
    ) {
      deferredRemotePersistRef.current = true;
      setPersistStatus("dirty");
      return false;
    }

    const dirtyKind = remoteDirtyKindRef.current === "none" ? "content" : remoteDirtyKindRef.current;
    const now = Date.now();
    if (
      !options.force &&
      !shouldPersistRemoteSnapshot({
        dirtyKind,
        hasPendingRuntimeState,
        lastPersistedAt: lastRemotePersistedAtRef.current,
        lastSignature: lastRemotePersistSignatureRef.current,
        now,
        nextSignature: persistKey,
      })
    ) {
      return false;
    }

    pendingLocalPersistSignatureRef.current = persistSignature;
    inFlightRemotePersistKeyRef.current = persistKey;
    setPersistStatus("saving");
    setLastPersistError("");

    void Promise.resolve(onRemotePersist(projectSnapshot))
      .then(() => {
        if (inFlightRemotePersistKeyRef.current !== persistKey) return;
        inFlightRemotePersistKeyRef.current = "";
        lastRemotePersistSignatureRef.current = persistKey;
        lastRemotePersistedAtRef.current = Date.now();
        if (pendingLocalPersistSignatureRef.current === persistSignature) {
          pendingLocalPersistSignatureRef.current = "";
        }
        remoteDirtyKindRef.current = "none";
        setPersistStatus("saved");
        if (deferredRemotePersistRef.current) {
          deferredRemotePersistRef.current = false;
          setRemotePersistRetryTick((tick) => tick + 1);
        }
      })
      .catch((error) => {
        if (inFlightRemotePersistKeyRef.current === persistKey) {
          inFlightRemotePersistKeyRef.current = "";
        }
        if (isDuplicateRemotePersistError(error)) {
          lastRemotePersistSignatureRef.current = persistKey;
          lastRemotePersistedAtRef.current = Date.now();
          if (pendingLocalPersistSignatureRef.current === persistSignature) {
            pendingLocalPersistSignatureRef.current = "";
          }
          remoteDirtyKindRef.current = "none";
          deferredRemotePersistRef.current = false;
          setPersistStatus("saved");
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setLastPersistError(message);
        setPersistStatus("error");
        console.warn("Failed to persist remote canvas", error);
        deferredRemotePersistRef.current = false;
        setRemotePersistRetryTick((tick) => tick + 1);
      });

    return true;
  },
  [currentWorkflowSummary, getRemotePersistKey, isRemoteMode, onRemotePersist]
);

const flushRemotePersist = useCallback(
  (reason: string) => {
    return persistRemoteSnapshot({ force: true, reason });
  },
  [persistRemoteSnapshot]
);
```

- [x] **Step 4: Route dirty marking into persist status**

Inside `markRemoteDirty`, set:

```ts
setPersistStatus("dirty");
```

when remote mode is active and the dirty kind is not `"none"`.

- [x] **Step 5: Replace duplicated debounced remote persist body**

In the debounced persist effect, keep the local `setWorkspace` update, then call:

```ts
if (isRemoteMode) {
  if (skipNextRemotePersistRef.current) {
    skipNextRemotePersistRef.current = false;
    return;
  }
  persistRemoteSnapshot({ force: false, reason: "debounced" });
}
```

Remove the duplicated promise body from that effect.

- [x] **Step 6: Call flush at critical transitions**

Add calls after local refs/state are updated:

```ts
flushRemotePersist("add-node");
flushRemotePersist("insert-nodes");
flushRemotePersist("remove-node");
flushRemotePersist("add-link");
flushRemotePersist("remove-link");
flushRemotePersist("run-node-start");
flushRemotePersist("remote-video-task");
flushRemotePersist("batch-result-run");
```

Use only the calls that match the relevant function. For `runNode`, call `flushRemotePersist("run-node-start")` immediately after setting loading state, and `flushRemotePersist("remote-video-task")` after applying pending video task state.

- [x] **Step 7: Verify tests**

Run:

```bash
npm test -- --run src/hooks/useWorkflowState.test.ts src/utils/remotePersistPolicy.test.ts
```

Expected: PASS.

## Task 4: Leave Protection

**Files:**
- Modify: `src/hooks/useWorkflowState.ts`
- Test: `src/hooks/useWorkflowState.test.ts`

- [x] **Step 1: Add source-level failing test**

Add:

```ts
it("registers unload protection for unsaved or non-recoverable work", () => {
  const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

  expect(source).toContain("getLeaveProtectionState");
  expect(source).toContain('window.addEventListener("beforeunload"');
  expect(source).toContain('window.addEventListener("pagehide"');
  expect(source).toContain('flushRemotePersist("pagehide")');
});
```

- [x] **Step 2: Implement unload effect**

Import `getLeaveProtectionState`, then add:

```ts
useEffect(() => {
  if (!isRemoteMode) return;

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    const protection = getLeaveProtectionState({
      hasNonRecoverableRuntimeState: currentNodesRef.current.some(
        (node) => hasNodeRuntimeState(node) && !isPersistablePendingRuntimeNode(node)
      ),
      hasUnsavedRemoteChanges: persistStatus === "dirty" || persistStatus === "saving",
      persistStatus,
    });
    if (!protection.shouldWarn) return;
    flushRemotePersist("beforeunload");
    event.preventDefault();
    event.returnValue = "";
  };

  const handlePageHide = () => {
    flushRemotePersist("pagehide");
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    window.removeEventListener("pagehide", handlePageHide);
  };
}, [flushRemotePersist, isRemoteMode, persistStatus]);
```

- [x] **Step 3: Verify tests**

Run:

```bash
npm test -- --run src/hooks/useWorkflowState.test.ts
```

Expected: PASS.

## Task 5: Header Save Status UI

**Files:**
- Modify: `src/components/app/CanvasHeader.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/app/CanvasHeader.test.ts`

- [x] **Step 1: Write failing header tests**

Add tests following existing file conventions:

```ts
import { describe, expect, it } from "vitest";
import { getCanvasHeaderPersistStatusLabel } from "./CanvasHeader";

describe("getCanvasHeaderPersistStatusLabel", () => {
  it("maps remote persist state to compact user-facing copy", () => {
    expect(getCanvasHeaderPersistStatusLabel("saving")).toBe("保存中");
    expect(getCanvasHeaderPersistStatusLabel("saved")).toBe("已保存");
    expect(getCanvasHeaderPersistStatusLabel("dirty")).toBe("未保存");
    expect(getCanvasHeaderPersistStatusLabel("error")).toBe("保存失败");
    expect(getCanvasHeaderPersistStatusLabel("idle")).toBe("");
  });
});
```

- [x] **Step 2: Add CanvasHeader prop and label helper**

In `CanvasHeader.tsx`:

```ts
import type { RemotePersistStatus } from "../../utils/remotePersistPolicy";
```

Extend props:

```ts
persistStatus?: RemotePersistStatus;
lastPersistError?: string;
```

Export helper:

```ts
export function getCanvasHeaderPersistStatusLabel(status: RemotePersistStatus = "idle") {
  if (status === "saving") return "保存中";
  if (status === "saved") return "已保存";
  if (status === "dirty") return "未保存";
  if (status === "error") return "保存失败";
  return "";
}
```

Render near the project name:

```tsx
const persistLabel = getCanvasHeaderPersistStatusLabel(persistStatus);
...
{persistLabel ? (
  <span title={lastPersistError || persistLabel} className="ml-2 shrink-0 text-[10px] font-semibold text-slate-500">
    {persistLabel}
  </span>
) : null}
```

- [x] **Step 3: Pass state from App**

Destructure from `useWorkflowState`:

```ts
persistStatus,
lastPersistError,
```

Pass to `CanvasHeader`:

```tsx
persistStatus={persistStatus}
lastPersistError={lastPersistError}
```

- [x] **Step 4: Verify header tests**

Run:

```bash
npm test -- --run src/components/app/CanvasHeader.test.ts
```

Expected: PASS.

## Task 6: Interrupted Node View Copy

**Files:**
- Modify: `src/utils/textNodeViewState.ts`
- Modify: `src/utils/textNodeViewState.test.ts`
- Modify: `src/utils/mediaNodeLoadingState.ts`
- Modify: `src/utils/mediaNodeLoadingState.test.ts`
- Modify: `src/components/canvas/TextNodeCard.tsx`
- Modify: `src/components/canvas/ImageNodeCard.tsx`

- [x] **Step 1: Write failing utility tests**

In `textNodeViewState.test.ts`:

```ts
it("shows interrupted state before idle state", () => {
  expect(
    getTextNodeViewState({
      errorText: "",
      isInterrupted: true,
      isRunning: false,
      promptText: "prompt",
      responseText: "",
    }).kind
  ).toBe("interrupted");
});
```

In `mediaNodeLoadingState.test.ts`:

```ts
it("does not treat interrupted media nodes as running", () => {
  expect(
    isMediaNodeRunning({
      data: { loading: false, status: "interrupted" },
      properties: {},
    })
  ).toBe(false);
});
```

- [x] **Step 2: Update text view state helper**

Add `"interrupted"` to `TextNodeViewKind`, accept `isInterrupted`, and return:

```ts
if (isInterrupted) {
  return {
    kind: "interrupted",
    title: "生成已中断",
    description: "刷新或离开页面中断了这次生成，可保留参数重新生成",
  };
}
```

Place it after error and before success/ready/idle.

- [x] **Step 3: Pass interrupted flag in `TextNodeCard`**

Change the call:

```ts
const viewState = getTextNodeViewState({
  errorText,
  isInterrupted: node.data?.status === "interrupted",
  isRunning,
  promptText: displayPromptText,
  responseText,
});
```

- [x] **Step 4: Add image interrupted copy**

In `ImageNodeCard.tsx`, derive:

```ts
const isInterrupted = node.data?.status === "interrupted";
```

Where the loading/empty overlay text is selected, show:

```tsx
{isInterrupted ? "上次生成已中断，可重新生成" : ...}
```

Keep `isMediaNodeRunning` false for interrupted nodes so the spinner does not continue.

- [x] **Step 5: Verify utility tests**

Run:

```bash
npm test -- --run src/utils/textNodeViewState.test.ts src/utils/mediaNodeLoadingState.test.ts
```

Expected: PASS.

## Task 7: Full Verification

**Files:**
- All modified files

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run src/hooks/useWorkflowState.test.ts src/utils/remotePersistPolicy.test.ts src/components/app/CanvasHeader.test.ts src/utils/textNodeViewState.test.ts src/utils/mediaNodeLoadingState.test.ts
```

Expected: all listed test files pass.

- [x] **Step 2: Run type check**

Run:

```bash
npm run lint:types
```

Expected: `tsc --noEmit` exits 0.

- [x] **Step 3: Run full tests if targeted tests pass**

Run:

```bash
npm test
```

Expected: all Vitest files pass.

- [x] **Step 4: Review diff for scope**

Run:

```bash
git diff --stat
git diff
```

Expected: changes are limited to refresh resilient persistence, recovery, and save/interrupted UI.

- [x] **Step 5: Commit implementation**

Run:

```bash
git add src/types.ts src/hooks/useWorkflowState.ts src/hooks/useWorkflowState.test.ts src/utils/remotePersistPolicy.ts src/utils/remotePersistPolicy.test.ts src/App.tsx src/components/app/CanvasHeader.tsx src/components/app/CanvasHeader.test.ts src/utils/textNodeViewState.ts src/utils/textNodeViewState.test.ts src/utils/mediaNodeLoadingState.ts src/utils/mediaNodeLoadingState.test.ts src/components/canvas/TextNodeCard.tsx src/components/canvas/ImageNodeCard.tsx docs/superpowers/plans/2026-06-27-refresh-resilient-generation.md
git commit -m "feat: make generation refresh resilient"
```
