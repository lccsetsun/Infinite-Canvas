import { describe, expect, it } from "vitest";
import { createVideoFrameCaptureSnapshot } from "./videoFrameCaptureLayout";
import type { GraphNode } from "../types";

function makeSourceNode(): GraphNode {
  return {
    id: "source-video",
    type: "video_node",
    title: "视频节点 1",
    x: 100,
    y: 200,
    inputs: [],
    outputs: [{ name: "视频", type: "VIDEO" }],
    properties: { videoUrl: "https://oss.example.com/source.mp4" },
    data: {
      videoUrl: "https://oss.example.com/source.mp4",
      videoNaturalWidth: 720,
      videoNaturalHeight: 1280,
      videoDisplayWidth: 160,
      videoDisplayHeight: 284,
    },
  };
}

describe("createVideoFrameCaptureSnapshot", () => {
  it("creates one segment video node and one five-column frame grid image node per backend item", () => {
    const result = createVideoFrameCaptureSnapshot({
      nodes: [makeSourceNode()],
      links: [],
      nodeOutputs: new Map([
        ["source-video", new Map([[0, "https://oss.example.com/source.mp4"]])],
      ]),
      sourceNodeId: "source-video",
      captures: [
        {
          index: 0,
          videoUrl: "https://oss.example.com/segment.mp4",
          frameImages: Array.from(
            { length: 8 },
            (_, index) => `https://oss.example.com/${index + 1}.png`
          ),
        },
      ],
      makeId: (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`,
    });

    expect(result).not.toBeNull();
    expect(result?.nodes).toHaveLength(3);

    const segmentVideo = result?.createdNodes[0];
    const frameGrid = result?.createdNodes[1];
    expect(segmentVideo?.type).toBe("video_node");
    expect(segmentVideo?.title).toBe("分段 1");
    expect(segmentVideo?.properties.videoUrl).toBe("https://oss.example.com/segment.mp4");
    expect(segmentVideo?.data?.videoDisplayWidth).toBe(520);
    expect(segmentVideo?.data?.videoDisplayHeight).toBe(924);
    expect(frameGrid?.type).toBe("image_node");
    expect(frameGrid?.title).toBe("逐帧分析 1");
    expect(frameGrid?.x).toBeGreaterThanOrEqual((segmentVideo?.x ?? 0) + 640);
    expect(frameGrid?.data?.imageUrls).toHaveLength(8);
    expect(frameGrid?.data?.isFrameStrip).toBe(true);
    expect(frameGrid?.data?.frameGridColumns).toBe(5);
    expect(result?.nodeOutputs.get(frameGrid?.id || "")?.get(0)).toEqual(
      frameGrid?.data?.imageUrls
    );

    expect(result?.links).toEqual([
      {
        id: expect.any(String),
        fromNodeId: "source-video",
        fromOutputIndex: 0,
        toNodeId: segmentVideo?.id,
        toInputIndex: 0,
      },
      {
        id: expect.any(String),
        fromNodeId: segmentVideo?.id,
        fromOutputIndex: 0,
        toNodeId: frameGrid?.id,
        toInputIndex: 5,
      },
    ]);
  });

  it("removes previous frame capture nodes from the same source before regenerating", () => {
    let nextId = 0;
    const sourceNode = makeSourceNode();
    const staleVideo: GraphNode = {
      ...makeSourceNode(),
      id: "old-segment-video",
      title: "分段 1",
      x: 620,
      y: 200,
      data: {
        videoUrl: "https://oss.example.com/old-segment.mp4",
        frameCaptureSourceNodeId: sourceNode.id,
      },
    };
    const staleFrame: GraphNode = {
      ...makeSourceNode(),
      id: "old-frame-grid",
      type: "image_node",
      title: "逐帧分析 1",
      x: 1240,
      y: 200,
      data: {
        imageUrl: "https://oss.example.com/old-frame.png",
        frameCaptureSourceNodeId: sourceNode.id,
        isFrameStrip: true,
      },
    };
    const unrelatedNode: GraphNode = {
      ...makeSourceNode(),
      id: "other-source-frame",
      title: "逐帧分析 1",
      data: {
        videoUrl: "https://oss.example.com/other.mp4",
        frameCaptureSourceNodeId: "other-source",
      },
    };

    const result = createVideoFrameCaptureSnapshot({
      nodes: [sourceNode, staleVideo, staleFrame, unrelatedNode],
      links: [
        {
          id: "old-source-to-video",
          fromNodeId: sourceNode.id,
          fromOutputIndex: 0,
          toNodeId: staleVideo.id,
          toInputIndex: 0,
        },
        {
          id: "old-video-to-frame",
          fromNodeId: staleVideo.id,
          fromOutputIndex: 0,
          toNodeId: staleFrame.id,
          toInputIndex: 5,
        },
        {
          id: "unrelated-link",
          fromNodeId: unrelatedNode.id,
          fromOutputIndex: 0,
          toNodeId: "other-node",
          toInputIndex: 0,
        },
      ],
      nodeOutputs: new Map([
        [sourceNode.id, new Map([[0, "https://oss.example.com/source.mp4"]])],
        [staleVideo.id, new Map([[0, "https://oss.example.com/old-segment.mp4"]])],
        [staleFrame.id, new Map([[0, "https://oss.example.com/old-frame.png"]])],
        [unrelatedNode.id, new Map([[0, "https://oss.example.com/other.mp4"]])],
      ]),
      sourceNodeId: sourceNode.id,
      captures: [
        {
          index: 0,
          videoUrl: "https://oss.example.com/new-segment.mp4",
          frameImages: ["https://oss.example.com/new-frame.png"],
        },
      ],
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    expect(result?.nodes.some((node) => node.id === staleVideo.id)).toBe(false);
    expect(result?.nodes.some((node) => node.id === staleFrame.id)).toBe(false);
    expect(result?.nodes.some((node) => node.id === unrelatedNode.id)).toBe(true);
    expect(result?.links.some((link) => link.id.startsWith("old-"))).toBe(false);
    expect(result?.links.some((link) => link.id === "unrelated-link")).toBe(true);
    expect(result?.nodeOutputs.has(staleVideo.id)).toBe(false);
    expect(result?.nodeOutputs.has(staleFrame.id)).toBe(false);
    expect(result?.nodeOutputs.has(unrelatedNode.id)).toBe(true);
    expect(result?.createdNodes).toHaveLength(2);
    expect(
      result?.createdNodes.every((node) => node.data?.frameCaptureSourceNodeId === sourceNode.id)
    ).toBe(true);
  });
});
