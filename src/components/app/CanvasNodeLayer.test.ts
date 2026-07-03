import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GraphNode } from "../../types";
import { getCanvasVideoPosterUrls } from "./CanvasNodeLayer";

function makeNode(partial: Partial<GraphNode> & Pick<GraphNode, "id" | "type">): GraphNode {
  return {
    title: partial.id,
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    properties: {},
    ...partial,
  };
}

describe("CanvasNodeLayer media throttling", () => {
  it("prioritizes current viewport media and passes load allowance to heavy media nodes", () => {
    const source = readFileSync(new URL("./CanvasNodeLayer.tsx", import.meta.url), "utf8");

    expect(source).toContain("getCanvasMediaLoadAllowance");
    expect(source).toContain("getViewportPrioritizedMediaNodeIds");
    expect(source).toContain("hasMeasuredCanvasSize");
    expect(source).toContain("getFallbackCanvasSize");
    expect(source).toContain("const effectiveCanvasSize");
    expect(source).toContain("retainedMediaLoadNodeIds");
    expect(source).toContain("setRetainedMediaLoadNodeIds");
    expect(source).toContain("retainedNodeIds: retainedMediaLoadNodeIds");
    expect(source).toContain("Math.hypot(centerX - viewportCenter.x, centerY - viewportCenter.y)");
    expect(source).toContain("mediaLoadAllowedNodeIds.has(node.id)");
    expect(source).toContain("getCanvasVideoPosterUrls");
    expect(source).toContain("videoPosterUrl={videoPosterUrls.get(node.id)}");
    expect(source.match(/mediaLoadAllowed=\{/g)).toHaveLength(3);
  });

  it("maps existing frame analysis images to source and segment video posters", () => {
    const nodes = [
      makeNode({ id: "source-video", type: "video_node" }),
      makeNode({
        id: "segment-1",
        type: "video_node",
        y: 100,
        data: { frameCaptureSourceNodeId: "source-video" },
      }),
      makeNode({
        id: "segment-2",
        type: "video_node",
        y: 300,
        data: { frameCaptureSourceNodeId: "source-video" },
      }),
      makeNode({
        id: "frames-1",
        type: "image_node",
        y: 90,
        data: {
          frameCaptureSourceNodeId: "source-video",
          imageUrls: ["https://example.com/first.png"],
        },
      }),
      makeNode({
        id: "frames-2",
        type: "image_node",
        y: 290,
        data: {
          frameCaptureSourceNodeId: "source-video",
          imageUrls: ["https://example.com/second.png"],
        },
      }),
    ];

    const posters = getCanvasVideoPosterUrls(nodes);

    expect(posters.get("source-video")).toBe("https://example.com/first.png");
    expect(posters.get("segment-1")).toBe("https://example.com/first.png");
    expect(posters.get("segment-2")).toBe("https://example.com/second.png");
  });
});
