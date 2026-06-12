import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import {
  getBatchOutputDrafts,
  getClickDragDistance,
  getNodesFullyInsideSelection,
  getSelectionBounds,
  isClickWithoutDrag,
  normalizeSelectionRect,
} from "./multiSelection";

function node(partial: Partial<GraphNode> & Pick<GraphNode, "id" | "x" | "y">): GraphNode {
  return {
    id: partial.id,
    inputs: partial.inputs ?? [{ name: "in", type: "IMAGE" }],
    outputs: partial.outputs ?? [{ name: "out", type: "IMAGE" }],
    properties: partial.properties ?? {},
    title: partial.title ?? partial.id,
    type: partial.type ?? "image_node",
    x: partial.x,
    y: partial.y,
    data: partial.data,
  };
}

describe("multiSelection", () => {
  it("normalizes drag rectangles regardless of drag direction", () => {
    expect(normalizeSelectionRect({ x: 320, y: 240 }, { x: 100, y: 80 })).toEqual({
      height: 160,
      width: 220,
      x: 100,
      y: 80,
    });
  });

  it("selects only nodes fully inside the selection rectangle", () => {
    const nodes = [
      node({ id: "inside", x: 120, y: 120, data: { imageNodeWidth: 120, imageNodeHeight: 160 } }),
      node({ id: "partial", x: 40, y: 120, data: { imageNodeWidth: 120, imageNodeHeight: 160 } }),
      node({ id: "outside", x: 360, y: 120, data: { imageNodeWidth: 120, imageNodeHeight: 160 } }),
    ];

    expect(
      getNodesFullyInsideSelection(nodes, { x: 100, y: 100, width: 240, height: 220 }).map(
        (candidate) => candidate.id
      )
    ).toEqual(["inside"]);
  });

  it("builds padded bounds for selected nodes", () => {
    const bounds = getSelectionBounds(
      [
        node({ id: "a", x: 100, y: 80, data: { imageNodeWidth: 100, imageNodeHeight: 150 } }),
        node({ id: "b", x: 130, y: 300, data: { imageNodeWidth: 120, imageNodeHeight: 90 } }),
      ],
      12
    );

    expect(bounds).toEqual({ x: 88, y: 68, width: 174, height: 334 });
  });

  it("keeps batch output drafts in the selected node order and skips nodes without outputs", () => {
    const drafts = getBatchOutputDrafts([
      node({ id: "first", x: 0, y: 0 }),
      node({ id: "no-output", x: 0, y: 160, outputs: [] }),
      node({ id: "second", x: 0, y: 320, outputs: [{ name: "alt", type: "STRING" }] }),
    ]);

    expect(drafts).toEqual([
      { fromNodeId: "first", fromOutputIndex: 0 },
      { fromNodeId: "second", fromOutputIndex: 0 },
    ]);
  });

  it("distinguishes click from drag by pointer distance", () => {
    expect(getClickDragDistance({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(5);
    expect(isClickWithoutDrag({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(true);
    expect(isClickWithoutDrag({ x: 10, y: 10 }, { x: 17, y: 14 })).toBe(false);
  });
});
