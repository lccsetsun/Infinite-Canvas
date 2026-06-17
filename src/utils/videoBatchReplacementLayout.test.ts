import { describe, expect, it } from "vitest";
import {
  createGroupVideoBatchReplacementSnapshot,
  createVideoBatchReplacementSlots,
  createVideoBatchReplacementSnapshot,
  hasFrameAnalysisDescendant,
} from "./videoBatchReplacementLayout";
import type { GraphLink, GraphNode } from "../types";

function makeVideoNode(id = "video-1"): GraphNode {
  return {
    id,
    type: "video_node",
    title: "瑙嗛 1",
    x: 100,
    y: 200,
    inputs: [],
    outputs: [{ name: "瑙嗛", type: "VIDEO" }],
    properties: { videoUrl: "https://oss.example.com/source.mp4" },
    data: {
      videoUrl: "https://oss.example.com/source.mp4",
      videoDisplayWidth: 304,
      videoDisplayHeight: 540,
    },
  };
}

function makeFrameNode(sourceNodeId: string): GraphNode {
  return {
    id: "frame-1",
    type: "image_node",
    title: "閫愬抚鍒嗘瀽 1",
    x: 900,
    y: 200,
    inputs: [{ name: "source_video", type: "VIDEO" }],
    outputs: [{ name: "鍥剧墖", type: "IMAGE" }],
    properties: { imageUrl: "https://oss.example.com/frame-1.png" },
    data: {
      imageUrl: "https://oss.example.com/frame-1.png",
      imageUrls: ["https://oss.example.com/frame-1.png"],
      isFrameStrip: true,
      frameCaptureSourceNodeId: sourceNodeId,
      frameImageOssIds: ["frame-oss-1"],
    },
  };
}

function makeGroupImageNode(id: string, x: number, ossId?: string): GraphNode {
  return {
    id,
    type: "image_node",
    title: `图片 ${id}`,
    x,
    y: 200,
    inputs: [],
    outputs: [{ name: "图片", type: "IMAGE" }],
    properties: { imageUrl: `https://oss.example.com/${id}.png` },
    groupId: "group-1",
    data: {
      imageDisplayWidth: 220,
      imageDisplayHeight: 391,
      imageUrl: `https://oss.example.com/${id}.png`,
      ossId,
    },
  };
}

describe("video batch replacement layout", () => {
  it("requires at least one frame-analysis descendant from the selected source video", () => {
    const source = makeVideoNode();

    expect(hasFrameAnalysisDescendant([source], source.id)).toBe(false);
    expect(hasFrameAnalysisDescendant([source, makeFrameNode(source.id)], source.id)).toBe(true);
    expect(hasFrameAnalysisDescendant([source, makeFrameNode("other-video")], source.id)).toBe(
      false
    );
  });

  it("creates the default front, side, and back upload slots", () => {
    expect(createVideoBatchReplacementSlots()).toEqual([
      {
        key: "front",
        title: "正面",
        placeholder: "请上传正面图",
        imageUrl: "",
        prompt: "正面",
      },
      {
        key: "side",
        title: "侧面",
        placeholder: "请上传侧面图",
        imageUrl: "",
        prompt: "侧面",
      },
      {
        key: "back",
        title: "背面",
        placeholder: "请上传背面图",
        imageUrl: "",
        prompt: "背面",
      },
    ]);
  });

  it("creates one connected batch replacement child from the frame-analysis node", () => {
    let nextId = 0;
    const source = makeVideoNode();
    const segmentNode: GraphNode = {
      ...makeVideoNode("segment-1"),
      title: "鍒嗘 1",
      x: 620,
      y: 200,
      data: {
        videoDisplayWidth: 304,
        videoDisplayHeight: 540,
        frameCaptureSourceNodeId: source.id,
      },
    };
    const frameNode = makeFrameNode(source.id);
    const links: GraphLink[] = [
      {
        id: "source-to-segment",
        fromNodeId: source.id,
        fromOutputIndex: 0,
        toNodeId: segmentNode.id,
        toInputIndex: 0,
      },
      {
        id: "segment-to-frame",
        fromNodeId: segmentNode.id,
        fromOutputIndex: 0,
        toNodeId: frameNode.id,
        toInputIndex: 0,
      },
    ];

    const result = createVideoBatchReplacementSnapshot({
      nodes: [source, segmentNode, frameNode],
      links,
      sourceNodeId: frameNode.id,
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    expect(result).not.toBeNull();
    expect(result?.createdNode.type).toBe("video_batch_replacement_node");
    expect(result?.createdNode.title).toBe("批量替换");
    expect(result?.createdNode.x).toBeGreaterThan(frameNode.x);
    expect(result?.createdNode.y).toBe(frameNode.y);
    expect(result?.createdNode.data?.frameCaptureSourceNodeId).toBe(source.id);
    expect(result?.createdNode.data?.frameAnalysisSourceNodeId).toBe(frameNode.id);
    expect(result?.createdNode.data?.batchReplacementResolution).toBe("1K");
    expect(result?.createdNode.data?.batchReplacementAspectRatio).toBe("9:16");
    expect(result?.createdNode.data?.batchReplacementSlots).toEqual(
      createVideoBatchReplacementSlots()
    );
    expect(result?.links).toEqual([
      ...links,
      {
        id: "link-2",
        fromNodeId: frameNode.id,
        fromOutputIndex: 0,
        toNodeId: "node-1",
        toInputIndex: 0,
      },
    ]);
  });

  it("creates one group batch replacement node from every grouped image with an oss id", () => {
    let nextId = 0;
    const sourceA = makeGroupImageNode("image-a", 120, "oss-a");
    const sourceB = makeGroupImageNode("image-b", 420, "oss-b");
    const sourceWithoutOss = makeGroupImageNode("image-c", 720);
    const outsideGroup = {
      ...makeGroupImageNode("image-outside", 1020, "oss-outside"),
      groupId: "other-group",
    };

    const result = createGroupVideoBatchReplacementSnapshot({
      groupId: "group-1",
      links: [],
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
      nodes: [sourceA, sourceB, sourceWithoutOss, outsideGroup],
    });

    expect(result).not.toBeNull();
    expect(result?.createdNode.type).toBe("video_batch_replacement_node");
    expect(result?.createdNode.title).toBe("批量替换");
    expect(result?.createdNode.x).toBeGreaterThan(sourceB.x);
    expect(result?.createdNode.data?.groupBatchReplacementSourceNodeIds).toEqual([
      "image-a",
      "image-b",
    ]);
    expect(result?.createdNode.data?.groupBatchReplacementSourceOssIds).toEqual(["oss-a", "oss-b"]);
    expect(result?.createdNode.data?.batchReplacementSlots).toEqual(
      createVideoBatchReplacementSlots()
    );
    expect(result?.links).toEqual([
      {
        id: "link-2",
        fromNodeId: "image-a",
        fromOutputIndex: 0,
        toNodeId: "node-1",
        toInputIndex: 0,
      },
      {
        id: "link-3",
        fromNodeId: "image-b",
        fromOutputIndex: 0,
        toNodeId: "node-1",
        toInputIndex: 0,
      },
    ]);
  });
});

