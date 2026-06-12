import { describe, expect, it } from "vitest";
import { shouldDeferCanvasContentRender } from "./canvasRenderReadiness";

describe("shouldDeferCanvasContentRender", () => {
  it("defers populated canvas content until the workflow viewport key is available", () => {
    expect(
      shouldDeferCanvasContentRender({
        activeWorkflowId: null,
        currentView: "canvas",
        groupCount: 0,
        linkCount: 1,
        nodeCount: 2,
      })
    ).toBe(true);
  });

  it("does not defer empty canvas states or non-canvas views", () => {
    expect(
      shouldDeferCanvasContentRender({
        activeWorkflowId: null,
        currentView: "canvas",
        groupCount: 0,
        linkCount: 0,
        nodeCount: 0,
      })
    ).toBe(false);
    expect(
      shouldDeferCanvasContentRender({
        activeWorkflowId: null,
        currentView: "api",
        groupCount: 0,
        linkCount: 1,
        nodeCount: 2,
      })
    ).toBe(false);
  });
});
