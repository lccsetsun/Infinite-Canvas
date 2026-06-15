# Video Batch Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a batch replacement action for video nodes that already have frame-analysis children, creating a connected child node with front, side, and back product-image slots.

**Architecture:** Add a focused graph utility for detecting eligible frame-analysis descendants and creating the batch replacement node/link snapshot. Add a dedicated React card for the new node type and wire it through `CanvasNodeLayer`, `VideoNodeCard`, and `App.tsx`.

**Tech Stack:** React, TypeScript, Vite, Vitest, Tailwind utility classes, existing canvas graph types.

---

### Task 1: Graph Utility

**Files:**

- Create: `src/utils/videoBatchReplacementLayout.ts`
- Create: `src/utils/videoBatchReplacementLayout.test.ts`
- Modify: `src/types.ts`

- [ ] Write failing tests for detecting frame-analysis descendants and creating the connected batch replacement node.
- [ ] Implement the utility with default front, side, and back slots.
- [ ] Run `npm run test -- src/utils/videoBatchReplacementLayout.test.ts`.

### Task 2: Node Card

**Files:**

- Create: `src/components/canvas/VideoBatchReplacementNodeCard.tsx`
- Create: `src/components/canvas/VideoBatchReplacementNodeCard.test.tsx`
- Modify: `src/components/app/CanvasNodeLayer.tsx`

- [ ] Write failing tests for default slot labels, upload/drop affordances, editable prompt text, and submit callback.
- [ ] Implement the card and render it for `video_batch_replacement_node`.
- [ ] Run the focused component test.

### Task 3: Video Toolbar And App Wiring

**Files:**

- Modify: `src/components/canvas/VideoNodeCard.tsx`
- Modify: `src/components/canvas/VideoNodeCard.test.tsx`
- Modify: `src/App.tsx`

- [ ] Write failing tests that the toolbar only exposes batch replacement when the video has a frame-analysis descendant.
- [ ] Pass eligibility into `VideoNodeCard`, create the child node on click, and select it.
- [ ] Run focused tests, then `npm run lint:types`.
