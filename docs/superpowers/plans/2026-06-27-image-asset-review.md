# Image Asset Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a send-for-review action for image nodes from both the node right-click menu and the image node floating toolbar.

**Architecture:** Add one small API wrapper for `GET /system/ai/asset/{ossId}` that returns the backend string. Reuse the existing image node `ossId` resolution helper, pass an app-level `onReviewAsset` handler through `CanvasNodeLayer`, and expose the action in the image toolbar and image-node context menu with notice-based success and error feedback.

**Tech Stack:** React 19, TypeScript, Vitest, existing `devApiFetch` API client.

---

## File Structure

- Create `src/features/api/assetReview.ts`: API wrapper and string response extraction.
- Create `src/features/api/assetReview.test.ts`: verifies endpoint path, string payload parsing, and missing string handling.
- Modify `src/components/canvas/ImageNodeCard.tsx`: add toolbar review button and call `onReviewAsset`.
- Modify `src/components/canvas/ImageNodeCard.test.ts`: source-level regression checks for toolbar review button.
- Modify `src/components/app/CanvasNodeLayer.tsx`: pass `onReviewAsset` into image nodes.
- Modify `src/App.tsx`: add app-level review handler, right-click menu item for image nodes, and loading state.
- Modify `src/App.test.ts`: source-level regression checks for image-node context review action.

## Task 1: API Wrapper

- [x] **Step 1: Write failing API tests**

Add tests that mock `devApiFetch`, call `reviewAsset("oss-123")`, and assert `GET /system/ai/asset/oss-123` plus string return.

- [x] **Step 2: Implement API wrapper**

Create `reviewAsset(ossId: string): Promise<string>` using `devApiFetch` and `parseDevApiEnvelope<unknown>`.

- [x] **Step 3: Verify API tests pass**

Run `npm test -- --run src/features/api/assetReview.test.ts`.

## Task 2: Image Toolbar Action

- [x] **Step 1: Write failing image card source test**

Assert `ImageNodeCard` accepts `onReviewAsset`, renders a `Tooltip content="送审"`, and uses `getPrimaryImageNodeOssId(node, imageUrl)`.

- [x] **Step 2: Implement toolbar button**

Add a review icon button in the selected image toolbar when not in grid selection mode and an `ossId` is available.

- [x] **Step 3: Verify image card test passes**

Run `npm test -- --run src/components/canvas/ImageNodeCard.test.ts`.

## Task 3: App Wiring And Context Menu

- [x] **Step 1: Write failing App source test**

Assert `App` imports `reviewAsset`, defines `handleReviewImageAsset`, passes `onReviewAsset`, and includes context menu copy `送审`.

- [x] **Step 2: Wire app handler**

Use `reviewAsset(ossId)`, show the returned string through `showNotice`, show missing-oss and error messages through `showNotice`, and track a single reviewing node id for disabled/loading states.

- [x] **Step 3: Verify app tests pass**

Run `npm test -- --run src/App.test.ts src/components/app/CanvasNodeLayer.test.ts`.

## Task 4: Full Verification

- [x] **Step 1: Run targeted tests**

Run `npm test -- --run src/features/api/assetReview.test.ts src/components/canvas/ImageNodeCard.test.ts src/App.test.ts`.

- [x] **Step 2: Run lint**

Run `npm run lint`.

- [x] **Step 3: Run full tests**

Run `npm test`.
