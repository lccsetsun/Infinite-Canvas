import { describe, expect, it } from "vitest";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import {
  completeVideoSuperResolutionChildSnapshot,
  createVideoSuperResolutionChildSnapshot,
  failVideoSuperResolutionChildSnapshot,
} from "./videoSuperResolutionLayout";

describe("video super resolution layout", () => {
  it("creates a loading video child node linked from the source video", () => {
    const source = createNodeFromType("video_node", "video-1", 100, 200);
    source.title = "视频节点 1";
    source.properties.videoUrl = "https://example.com/source.mp4";
    source.data = {
      videoUrl: "https://example.com/source.mp4",
      videoDisplayWidth: 304,
      videoDisplayHeight: 540,
      videoNodeWidth: 304,
      videoNodeHeight: 540,
    };

    const snapshot = createVideoSuperResolutionChildSnapshot({
      links: [],
      makeId: (prefix) => `${prefix}-1`,
      nodes: [source],
      sourceNodeId: source.id,
      sourceVideoUrl: "https://example.com/source.mp4",
    });

    expect(snapshot?.createdNode.type).toBe("video_node");
    expect(snapshot?.createdNode.title).toBe("视频节点 1 超分");
    expect(snapshot?.createdNode.x).toBe(524);
    expect(snapshot?.createdNode.y).toBe(200);
    expect(snapshot?.createdNode.data?.loadingOperation).toBe("video-super-resolution");
    expect(snapshot?.createdNode.data?.status).toBe("loading");
    expect(snapshot?.links[0]).toMatchObject({
      fromNodeId: "video-1",
      toNodeId: "node-1",
      locked: true,
    });
  });

  it("completes the loading child with the returned video url", () => {
    const child = createNodeFromType("video_node", "child", 0, 0);
    child.data = { loading: true, status: "loading" };

    const result = completeVideoSuperResolutionChildSnapshot({
      nodeId: "child",
      nodes: [child],
      videoUrl: "https://example.com/upscaled.mp4",
    });

    expect(result.nodeOutputValue).toBe("https://example.com/upscaled.mp4");
    expect(result.nodes[0].properties.videoUrl).toBe("https://example.com/upscaled.mp4");
    expect(result.nodes[0].properties.status).toBe("success");
    expect(result.nodes[0].data?.videoUrl).toBe("https://example.com/upscaled.mp4");
    expect(result.nodes[0].data?.status).toBe("success");
  });

  it("marks the loading child failed without removing it", () => {
    const child = createNodeFromType("video_node", "child", 0, 0);
    child.data = { loading: true, status: "loading" };

    const nodes = failVideoSuperResolutionChildSnapshot({
      error: "failed",
      nodeId: "child",
      nodes: [child],
    });

    expect(nodes[0].data?.status).toBe("error");
    expect(nodes[0].properties.status).toBe("error");
    expect(nodes[0].data?.error).toBe("failed");
    expect(nodes[0].data?.loading).toBe(false);
  });
});
