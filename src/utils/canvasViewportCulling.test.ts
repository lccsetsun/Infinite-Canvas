import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import { getVisibleCanvasNodeIds, getVisibleWorldRect } from "./canvasViewportCulling";

const node = (id: string, x: number, y: number, width = 300, height = 220): GraphNode =>
  ({
    id,
    title: id,
    type: "image_node",
    x,
    y,
    inputs: [],
    outputs: [],
    properties: { aspect_ratio: "16:9" },
    data: { imageNodeWidth: width, imageNodeHeight: height },
  }) as GraphNode;

describe("canvasViewportCulling", () => {
  it("converts screen viewport to world rect with buffer", () => {
    expect(
      getVisibleWorldRect({
        bufferPx: 100,
        canvasSize: { width: 1000, height: 800 },
        pan: { x: -200, y: -100 },
        zoom: 2,
      })
    ).toEqual({ minX: 50, minY: 0, maxX: 650, maxY: 500 });
  });

  it("keeps visible nodes and explicit exception nodes", () => {
    const ids = getVisibleCanvasNodeIds({
      alwaysVisibleNodeIds: new Set(["selected"]),
      canvasSize: { width: 1000, height: 800 },
      nodes: [node("visible", 100, 100), node("hidden", 5000, 5000), node("selected", 6000, 6000)],
      pan: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(ids).toEqual(new Set(["visible", "selected"]));
  });

  it("keeps nodes that intersect the buffered viewport edge", () => {
    const ids = getVisibleCanvasNodeIds({
      bufferPx: 100,
      canvasSize: { width: 500, height: 400 },
      nodes: [node("left-edge", -250, 120), node("outside", -450, 120)],
      pan: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(ids).toEqual(new Set(["left-edge"]));
  });

  it("keeps all nodes before the canvas has a measurable size", () => {
    const ids = getVisibleCanvasNodeIds({
      canvasSize: { width: 0, height: 0 },
      nodes: [node("visible", 0, 0), node("far-away", 5000, 5000)],
      pan: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(ids).toEqual(new Set(["visible", "far-away"]));
  });
});
