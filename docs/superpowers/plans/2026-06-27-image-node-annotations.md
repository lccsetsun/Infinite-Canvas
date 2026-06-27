# Image Node Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add non-destructive rectangle and pen annotations to image nodes.

**Architecture:** Keep annotations as structured `node.data.annotations` values. Put pure geometry and validation helpers in `src/utils/imageAnnotations.ts`, render annotations through an SVG overlay inside `ImageNodeCard`, and persist changes through the existing `onUpdateData` path.

**Tech Stack:** React 19, TypeScript, Vitest, existing image node toolbar styles.

---

## Task 1: Annotation Helpers

- [x] Add failing tests for normalized point conversion, rectangle creation, and pen creation.
- [x] Implement `src/utils/imageAnnotations.ts`.
- [x] Add annotation types to `GraphNode["data"]`.
- [x] Run `npm test -- --run src/utils/imageAnnotations.test.ts`.

## Task 2: Image Node UI Wiring

- [x] Add failing source tests for `ImageNodeCard` annotation toolbar and persistence wiring.
- [x] Add local annotation mode/tool/color/stroke state.
- [x] Render SVG overlay above the main image.
- [x] Persist committed annotations with `onUpdateData(node.id, { annotations })`.
- [x] Run `npm test -- --run src/components/canvas/ImageNodeCard.test.ts src/utils/imageAnnotations.test.ts`.

## Task 3: Verification

- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
