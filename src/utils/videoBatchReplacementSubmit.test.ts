import { describe, expect, it } from "vitest";
import { resolveVideoBatchReplacementSourceFrames } from "./videoBatchReplacementSubmit";
import type { GraphNode } from "../types";

function makeFrameAnalysisNode(data: NonNullable<GraphNode["data"]>): GraphNode {
  return {
    id: "frames",
    type: "image_node",
    title: "逐帧分析 1",
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    properties: {},
    data: {
      isFrameStrip: true,
      ...data,
    },
  };
}

describe("resolveVideoBatchReplacementSourceFrames", () => {
  it("uses the visible frame image count for result placeholders even when oss ids collapse to one", () => {
    const node = makeFrameAnalysisNode({
      frameImageOssIds: ["oss-frame-1"],
      imageUrls: [
        "https://example.com/frame-1.png",
        "https://example.com/frame-2.png",
        "https://example.com/frame-3.png",
      ],
    });

    expect(resolveVideoBatchReplacementSourceFrames(node)).toEqual({
      frameCount: 3,
      ossIds: ["oss-frame-1"],
    });
  });

  it("uses every visible frame for dynamic placeholder count", () => {
    const node = makeFrameAnalysisNode({
      frameImageOssIds: ["oss-1", "oss-2", "oss-3", "oss-4"],
      imageUrls: [
        "https://example.com/frame-1.png",
        "https://example.com/frame-2.png",
        "https://example.com/frame-3.png",
        "https://example.com/frame-4.png",
      ],
    });

    expect(resolveVideoBatchReplacementSourceFrames(node)).toEqual({
      frameCount: 4,
      ossIds: ["oss-1", "oss-2", "oss-3", "oss-4"],
    });
  });

  it("uses frameImageOssIds length when visible image urls are not available yet", () => {
    const node = makeFrameAnalysisNode({
      frameImageOssIds: ["oss-1", "oss-2"],
    });

    expect(resolveVideoBatchReplacementSourceFrames(node)).toEqual({
      frameCount: 2,
      ossIds: ["oss-1", "oss-2"],
    });
  });

  it("preserves repeated frame oss ids so duplicate source frames still create matching placeholders", () => {
    const node = makeFrameAnalysisNode({
      frameImageOssIds: ["oss-same", "oss-same", "oss-same"],
      imageUrls: [
        "https://example.com/frame-1.png",
        "https://example.com/frame-2.png",
        "https://example.com/frame-3.png",
      ],
    });

    expect(resolveVideoBatchReplacementSourceFrames(node)).toEqual({
      frameCount: 3,
      ossIds: ["oss-same", "oss-same", "oss-same"],
    });
  });

  it("uses grouped image oss ids for group batch replacement placeholders", () => {
    const node = makeFrameAnalysisNode({
      groupBatchReplacementSourceOssIds: ["oss-a", "oss-b", "oss-c", "oss-d"],
      isFrameStrip: false,
    });

    expect(resolveVideoBatchReplacementSourceFrames(node)).toEqual({
      frameCount: 4,
      ossIds: ["oss-a", "oss-b", "oss-c", "oss-d"],
    });
  });
});
