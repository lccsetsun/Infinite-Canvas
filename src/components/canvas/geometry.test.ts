import { describe, expect, it } from "vitest";
import { GRID_SIZE, getOutputAnchor, snapPointToGrid, snapToGrid } from "./geometry";

describe("grid snapping", () => {
  it("snaps scalar values to the nearest base grid line", () => {
    expect(snapToGrid(35)).toBe(24);
    expect(snapToGrid(37)).toBe(48);
    expect(snapToGrid(-13)).toBe(-24);
  });

  it("snaps points with the shared grid size", () => {
    expect(snapPointToGrid({ x: 61, y: 83 })).toEqual({ x: 72, y: 72 });
    expect(GRID_SIZE).toBe(24);
  });
});

describe("media node anchors", () => {
  it("uses frame-strip image node dimensions even without a single imageUrl", () => {
    const node = {
      id: "frames",
      title: "逐帧分析 1",
      type: "image_node" as const,
      x: 160,
      y: 110,
      inputs: [],
      outputs: [{ name: "图片", type: "IMAGE" as const }],
      properties: {},
      data: {
        imageUrls: ["https://example.com/1.png", "https://example.com/2.png"],
        isFrameStrip: true,
        imageDisplayWidth: 840,
        imageDisplayHeight: 192,
        imagePortCenterY: 126,
      },
    };

    expect(getOutputAnchor(node, 0)).toEqual({ x: 1000, y: 236 });
  });
});
