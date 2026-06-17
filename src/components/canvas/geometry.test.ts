import { describe, expect, it } from "vitest";
import {
  GRID_SIZE,
  getNodeHeight,
  getNodeWidth,
  getOutputAnchor,
  snapPointToGrid,
  snapToGrid,
} from "./geometry";

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
  it("fits the generated image placeholder into the text-node footprint before node data is measured", () => {
    const node = {
      id: "image",
      title: "图片节点 1",
      type: "image_node" as const,
      x: 120,
      y: 80,
      inputs: [],
      outputs: [{ name: "图片", type: "IMAGE" as const }],
      properties: {},
    };

    expect(getNodeWidth(node)).toBe(540);
    expect(getNodeHeight(node)).toBe(304);
    expect(getOutputAnchor(node, 0)).toEqual({ x: 660, y: 232 });
  });

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

describe("text node sizing", () => {
  it("uses a compact square default footprint", () => {
    const node = {
      id: "text",
      title: "文本节点 1",
      type: "text_node" as const,
      x: 120,
      y: 80,
      inputs: [],
      outputs: [{ name: "文本", type: "STRING" as const }],
      properties: {},
    };

    expect(getNodeWidth(node)).toBe(360);
    expect(getNodeHeight(node)).toBe(360);
    expect(getOutputAnchor(node, 0)).toEqual({ x: 480, y: 260 });
  });

  it("normalizes legacy default text node dimensions", () => {
    const node = {
      id: "text",
      title: "鏂囨湰鑺傜偣 1",
      type: "text_node" as const,
      x: 120,
      y: 80,
      inputs: [],
      outputs: [{ name: "鏂囨湰", type: "STRING" as const }],
      properties: {},
      data: {
        textNodeWidth: 420,
        textNodeHeight: 420,
      },
    };

    expect(getNodeWidth(node)).toBe(360);
    expect(getNodeHeight(node)).toBe(360);
    expect(getOutputAnchor(node, 0)).toEqual({ x: 480, y: 260 });
  });

  it("uses custom text node dimensions when present", () => {
    const node = {
      id: "text",
      title: "文本节点 1",
      type: "text_node" as const,
      x: 120,
      y: 80,
      inputs: [],
      outputs: [{ name: "文本", type: "STRING" as const }],
      properties: {},
      data: {
        textNodeWidth: 560,
        textNodeHeight: 500,
      },
    };

    expect(getNodeWidth(node)).toBe(560);
    expect(getNodeHeight(node)).toBe(500);
    expect(getOutputAnchor(node, 0)).toEqual({ x: 680, y: 330 });
  });
});

describe("audio node sizing", () => {
  it("uses the same default footprint as the text node", () => {
    const node = {
      id: "audio",
      title: "音频节点 1",
      type: "audio_node" as const,
      x: 120,
      y: 80,
      inputs: [],
      outputs: [{ name: "音频", type: "AUDIO" as const }],
      properties: {},
    };

    expect(getNodeWidth(node)).toBe(540);
    expect(getNodeHeight(node)).toBe(540);
    expect(getOutputAnchor(node, 0)).toEqual({ x: 660, y: 350 });
  });
});

describe("video batch replacement node sizing", () => {
  it("uses the rendered card height so links align with the visible plus port", () => {
    const node = {
      id: "batch",
      title: "批量替换",
      type: "video_batch_replacement_node" as const,
      x: 120,
      y: 80,
      inputs: [{ name: "source_video", type: "VIDEO" as const }],
      outputs: [{ name: "替换配置", type: "ANY" as const }],
      properties: {},
    };

    expect(getNodeWidth(node)).toBe(760);
    expect(getNodeHeight(node)).toBe(464);
    expect(getOutputAnchor(node, 0)).toEqual({ x: 880, y: 312 });
  });
});
