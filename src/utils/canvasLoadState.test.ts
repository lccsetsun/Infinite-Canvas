import { describe, expect, it } from "vitest";
import { shouldShowCanvasProjectLoading, shouldShowEmptyCanvasState } from "./canvasLoadState";

describe("shouldShowCanvasProjectLoading", () => {
  it("keeps the canvas loading while the project detail request is in flight", () => {
    expect(
      shouldShowCanvasProjectLoading({
        currentWorkflowId: null,
        isProjectLoading: true,
        requestedWorkflowId: "project-1",
      }),
    ).toBe(true);
  });

  it("keeps the canvas loading until the remote project is applied to workflow state", () => {
    expect(
      shouldShowCanvasProjectLoading({
        currentWorkflowId: "local-empty-workflow",
        isProjectLoading: false,
        requestedWorkflowId: "project-1",
      }),
    ).toBe(true);
  });

  it("stops loading after the requested remote project is active", () => {
    expect(
      shouldShowCanvasProjectLoading({
        currentWorkflowId: "project-1",
        isProjectLoading: false,
        requestedWorkflowId: "project-1",
      }),
    ).toBe(false);
  });
});

describe("shouldShowEmptyCanvasState", () => {
  it("does not show the empty state while the canvas project is loading", () => {
    expect(
      shouldShowEmptyCanvasState({
        currentView: "canvas",
        isCanvasProjectLoading: true,
        nodeCount: 0,
      }),
    ).toBe(false);
  });

  it("shows the empty state after loading finishes with no nodes", () => {
    expect(
      shouldShowEmptyCanvasState({
        currentView: "canvas",
        isCanvasProjectLoading: false,
        nodeCount: 0,
      }),
    ).toBe(true);
  });
});
