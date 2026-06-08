import { describe, expect, it } from "vitest";
import { getCanvasNodeZIndex } from "./canvasNodeLayering";

describe("getCanvasNodeZIndex", () => {
  it("places the dragging node above selected and ordinary nodes", () => {
    expect(
      getCanvasNodeZIndex({
        draggingNodeId: "image-1",
        nodeId: "image-1",
        selectedNodeId: "text-1",
      }),
    ).toBeGreaterThan(
      getCanvasNodeZIndex({
        draggingNodeId: "image-1",
        nodeId: "text-1",
        selectedNodeId: "text-1",
      }),
    );
  });

  it("keeps the selected node above ordinary nodes when no node is being dragged", () => {
    expect(
      getCanvasNodeZIndex({
        draggingNodeId: null,
        nodeId: "text-1",
        selectedNodeId: "text-1",
      }),
    ).toBeGreaterThan(
      getCanvasNodeZIndex({
        draggingNodeId: null,
        nodeId: "image-1",
        selectedNodeId: "text-1",
      }),
    );
  });
});
