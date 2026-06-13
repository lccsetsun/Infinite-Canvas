import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import {
  completeVideoFrameImageChildSnapshot,
  createVideoFrameImageChildSnapshot,
  failVideoFrameImageChildSnapshot,
  relayoutVideoFrameImageChildSnapshots,
} from "./videoFrameImageExtraction";

function makeVideoNode(data: GraphNode["data"] = {}): GraphNode {
  return {
    id: "video-1",
    type: "video_node",
    title: "视频节点 5",
    x: 100,
    y: 200,
    inputs: [],
    outputs: [{ name: "视频", type: "VIDEO" }],
    properties: {},
    data,
  };
}

describe("createVideoFrameImageChildSnapshot", () => {
  it("creates a loading image child node linked from the source video", () => {
    const result = createVideoFrameImageChildSnapshot({
      captureMode: "current",
      links: [],
      makeId: (prefix) => (prefix === "link" ? "link-1" : "image-1"),
      nodes: [makeVideoNode()],
      previewUrl: "data:image/png;base64,preview",
      sourceNodeId: "video-1",
      naturalSize: { width: 496, height: 864 },
    });

    expect(result?.createdNode).toMatchObject({
      id: "image-1",
      type: "image_node",
      title: "视频节点 5 当前帧",
      data: {
        imageUrl: "data:image/png;base64,preview",
        imageUrls: ["data:image/png;base64,preview"],
        loading: true,
        uploadingAsset: true,
        status: "uploading",
        extractedFrameSourceNodeId: "video-1",
      },
    });
    expect(result?.createdNode.data?.imageDisplayWidth).toBe(310);
    expect(result?.createdNode.data?.imageDisplayHeight).toBe(540);
    expect(result?.links).toEqual([
      {
        id: "link-1",
        fromNodeId: "video-1",
        fromOutputIndex: 0,
        toNodeId: "image-1",
        toInputIndex: 5,
        locked: true,
      },
    ]);
  });

  it("creates an immediate loading placeholder before the frame preview is ready", () => {
    const result = createVideoFrameImageChildSnapshot({
      captureMode: "first",
      links: [],
      makeId: (prefix) => (prefix === "link" ? "link-1" : "image-1"),
      nodes: [makeVideoNode()],
      previewUrl: "",
      sourceNodeId: "video-1",
      naturalSize: { width: 864, height: 496 },
    });

    expect(result?.createdNode).toMatchObject({
      id: "image-1",
      type: "image_node",
      data: {
        imageUrl: "",
        imageUrls: [],
        imageDisplayWidth: 540,
        imageDisplayHeight: 310,
        loading: true,
        uploadingAsset: true,
        status: "uploading",
      },
    });
  });

  it("keeps a single capture horizontally aligned with the source video", () => {
    const result = createVideoFrameImageChildSnapshot({
      captureMode: "first",
      links: [],
      makeId: (prefix) => `${prefix}-1`,
      nodes: [makeVideoNode({ videoDisplayHeight: 360 })],
      previewUrl: "data:image/png;base64,first",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;

    expect(result.createdNode.y).toBe(200);
  });

  it("stacks multiple captures without auto-centering while adaptive layout is disabled", () => {
    const first = createVideoFrameImageChildSnapshot({
      captureMode: "first",
      links: [],
      makeId: (prefix) => `${prefix}-1`,
      nodes: [makeVideoNode({ videoDisplayHeight: 360 })],
      previewUrl: "data:image/png;base64,first",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;
    const second = createVideoFrameImageChildSnapshot({
      captureMode: "current",
      links: first.links,
      makeId: (prefix) => `${prefix}-2`,
      nodes: first.nodes,
      previewUrl: "data:image/png;base64,current",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;
    const third = createVideoFrameImageChildSnapshot({
      captureMode: "last",
      links: second.links,
      makeId: (prefix) => `${prefix}-3`,
      nodes: second.nodes,
      previewUrl: "data:image/png;base64,last",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;

    expect(first.createdNode.y).toBe(200);
    expect(second.createdNode.y).toBe(600);
    expect(third.createdNode.y).toBe(1000);
    expect(first.createdNode.x).toBe(second.createdNode.x);
    expect(second.createdNode.x).toBe(third.createdNode.x);
  });

  it("does not recenter remaining captures while adaptive layout is disabled", () => {
    const first = createVideoFrameImageChildSnapshot({
      captureMode: "first",
      links: [],
      makeId: (prefix) => `${prefix}-1`,
      nodes: [makeVideoNode({ videoDisplayHeight: 360 })],
      previewUrl: "data:image/png;base64,first",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;
    const second = createVideoFrameImageChildSnapshot({
      captureMode: "current",
      links: first.links,
      makeId: (prefix) => `${prefix}-2`,
      nodes: first.nodes,
      previewUrl: "data:image/png;base64,current",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;
    const third = createVideoFrameImageChildSnapshot({
      captureMode: "last",
      links: second.links,
      makeId: (prefix) => `${prefix}-3`,
      nodes: second.nodes,
      previewUrl: "data:image/png;base64,last",
      sourceNodeId: "video-1",
      naturalSize: { width: 640, height: 360 },
    })!;

    const relaidOut = relayoutVideoFrameImageChildSnapshots(
      third.nodes.filter((node) => node.id !== second.createdNode.id)
    );
    const remainingFirst = relaidOut.find((node) => node.id === first.createdNode.id);
    const remainingLast = relaidOut.find((node) => node.id === third.createdNode.id);

    expect(remainingFirst?.y).toBe(200);
    expect(remainingLast?.y).toBe(1000);
  });
});

describe("completeVideoFrameImageChildSnapshot", () => {
  it("replaces the preview with the uploaded OSS image and ends loading", () => {
    const created = createVideoFrameImageChildSnapshot({
      captureMode: "first",
      links: [],
      makeId: (prefix) => (prefix === "link" ? "link-1" : "image-1"),
      nodes: [makeVideoNode()],
      previewUrl: "data:image/png;base64,preview",
      sourceNodeId: "video-1",
      naturalSize: { width: 1024, height: 768 },
    })!;

    const result = completeVideoFrameImageChildSnapshot({
      nodeId: "image-1",
      nodes: created.nodes,
      ossId: "oss-1",
      uploadedUrl: "https://oss.example.com/frame.png",
    });

    expect(result.nodes.find((node) => node.id === "image-1")?.data).toMatchObject({
      imageUrl: "https://oss.example.com/frame.png",
      imageUrls: ["https://oss.example.com/frame.png"],
      ossId: "oss-1",
      loading: false,
      uploadingAsset: false,
      status: "success",
      isSourceNode: true,
    });
    expect(result.nodeOutputValue).toBe("https://oss.example.com/frame.png");
  });

  it("marks the child node as failed without removing the preview", () => {
    const created = createVideoFrameImageChildSnapshot({
      captureMode: "last",
      links: [],
      makeId: (prefix) => (prefix === "link" ? "link-1" : "image-1"),
      nodes: [makeVideoNode()],
      previewUrl: "data:image/png;base64,preview",
      sourceNodeId: "video-1",
      naturalSize: { width: 1024, height: 768 },
    })!;

    const result = failVideoFrameImageChildSnapshot({
      error: "upload failed",
      nodeId: "image-1",
      nodes: created.nodes,
    });

    expect(result.find((node) => node.id === "image-1")?.data).toMatchObject({
      imageUrl: "data:image/png;base64,preview",
      loading: false,
      uploadingAsset: false,
      status: "error",
      error: "upload failed",
    });
  });
});
