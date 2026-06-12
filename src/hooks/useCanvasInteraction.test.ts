import { describe, expect, it } from "vitest";
import {
  getDraggedNodePosition,
  getDraggedNodePositions,
  getWheelPanPosition,
  shouldStartCanvasPan,
} from "./useCanvasInteraction";

describe("getDraggedNodePosition", () => {
  it("allows nodes to be dragged past the current top-left viewport", () => {
    expect(
      getDraggedNodePosition({
        clientX: -220,
        clientY: -180,
        nodeStartX: 40,
        nodeStartY: 32,
        startX: 20,
        startY: 12,
        zoom: 1,
      })
    ).toEqual({ x: -192, y: -168 });
  });

  it("keeps alt-drag unsnapped", () => {
    expect(
      getDraggedNodePosition({
        altKey: true,
        clientX: -19,
        clientY: -23,
        nodeStartX: 7,
        nodeStartY: 11,
        startX: 0,
        startY: 0,
        zoom: 1,
      })
    ).toEqual({ x: -12, y: -12 });
  });
});

describe("getDraggedNodePositions", () => {
  it("moves selected nodes together using the grabbed node snap delta", () => {
    expect(
      getDraggedNodePositions({
        clientX: 26,
        clientY: 26,
        grabbedNodeId: "a",
        nodeStarts: [
          { nodeId: "a", x: 7, y: 7 },
          { nodeId: "b", x: 52, y: 31 },
        ],
        snapToGridEnabled: true,
        startX: 0,
        startY: 0,
        zoom: 1,
      })
    ).toEqual([
      { nodeId: "a", x: 24, y: 24 },
      { nodeId: "b", x: 69, y: 48 },
    ]);
  });

  it("keeps selected nodes unsnapped while alt is held", () => {
    expect(
      getDraggedNodePositions({
        altKey: true,
        clientX: 26,
        clientY: 26,
        grabbedNodeId: "a",
        nodeStarts: [
          { nodeId: "a", x: 7, y: 7 },
          { nodeId: "b", x: 52, y: 31 },
        ],
        snapToGridEnabled: true,
        startX: 0,
        startY: 0,
        zoom: 1,
      })
    ).toEqual([
      { nodeId: "a", x: 33, y: 33 },
      { nodeId: "b", x: 78, y: 57 },
    ]);
  });
});

describe("shouldStartCanvasPan", () => {
  it("starts canvas panning only from the middle mouse button", () => {
    expect(shouldStartCanvasPan(1)).toBe(true);
    expect(shouldStartCanvasPan(0)).toBe(false);
    expect(shouldStartCanvasPan(2)).toBe(false);
  });
});

describe("getWheelPanPosition", () => {
  it("moves the canvas viewport with normal wheel deltas", () => {
    expect(
      getWheelPanPosition({
        deltaX: 12,
        deltaY: 80,
        pan: { x: 100, y: 240 },
      })
    ).toEqual({ x: 88, y: 160 });
  });
});
