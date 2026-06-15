import { describe, expect, it } from "vitest";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphNode } from "../types";
import { createVideoFrameCaptureSnapshot } from "./videoFrameCaptureLayout";
import { createVideoPromptTextSnapshot } from "./videoPromptTextLayout";

function makeVideoNode(): GraphNode {
  const node = createNodeFromType("video_node", "video-1", 100, 200);
  node.data = {
    ...(node.data || {}),
    videoUrl: "https://oss.example.com/video.mp4",
  };
  return node;
}

describe("createVideoPromptTextSnapshot", () => {
  it("creates a text node from the reversed prompt and links the source video into it", () => {
    const videoNode = makeVideoNode();
    let nextId = 0;

    const result = createVideoPromptTextSnapshot({
      nodes: [videoNode],
      links: [],
      nodeOutputs: new Map() as NodeOutputMap,
      sourceNodeId: videoNode.id,
      prompt: "  soft cinematic camera move  ",
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    expect(result?.createdNode.type).toBe("text_node");
    expect(result?.createdNode.title).toBe("视频反推提示词");
    expect(result?.createdNode.x).toBe(720);
    expect(result?.createdNode.y).toBe(200);
    expect(result?.createdNode.properties.text).toBe("soft cinematic camera move");
    expect(result?.createdNode.properties.response).toBe("soft cinematic camera move");
    expect(result?.links).toEqual([
      {
        id: "link-2",
        fromNodeId: "video-1",
        fromOutputIndex: 0,
        toNodeId: "node-1",
        toInputIndex: 3,
      },
    ]);
    expect(result?.nodeOutputs.get("node-1")?.get(0)).toBe("soft cinematic camera move");
  });

  it("does not create a node when the prompt is empty", () => {
    expect(
      createVideoPromptTextSnapshot({
        nodes: [makeVideoNode()],
        links: [],
        nodeOutputs: new Map() as NodeOutputMap,
        sourceNodeId: "video-1",
        prompt: " ",
        makeId: (prefix) => prefix,
      })
    ).toBeNull();
  });

  it("preserves frame analysis nodes and links when a reversed prompt is added afterwards", () => {
    const videoNode = makeVideoNode();
    let nextId = 0;

    const frameSnapshot = createVideoFrameCaptureSnapshot({
      nodes: [videoNode],
      links: [],
      nodeOutputs: new Map() as NodeOutputMap,
      sourceNodeId: videoNode.id,
      captures: [
        {
          index: 0,
          videoUrl: "https://oss.example.com/segment.mp4",
          frameImages: ["https://oss.example.com/frame-1.png"],
          frameImageOssIds: ["oss-frame-1"],
        },
      ],
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    expect(frameSnapshot).not.toBeNull();

    const promptSnapshot = createVideoPromptTextSnapshot({
      nodes: frameSnapshot?.nodes || [],
      links: frameSnapshot?.links || [],
      nodeOutputs: frameSnapshot?.nodeOutputs || (new Map() as NodeOutputMap),
      sourceNodeId: videoNode.id,
      prompt: "reverse prompt",
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    const frameNodeIds = new Set(frameSnapshot?.createdNodes.map((node) => node.id));
    const frameLinkIds = new Set(frameSnapshot?.links.map((link) => link.id));

    expect(promptSnapshot).not.toBeNull();
    expect(promptSnapshot?.nodes).toEqual(
      expect.arrayContaining([...frameNodeIds].map((id) => expect.objectContaining({ id })))
    );
    expect(promptSnapshot?.links).toEqual(
      expect.arrayContaining([...frameLinkIds].map((id) => expect.objectContaining({ id })))
    );
    expect(promptSnapshot?.createdNode.type).toBe("text_node");
  });

  it("places the reversed prompt below the first frame-analysis child when one exists", () => {
    const videoNode = makeVideoNode();
    let nextId = 0;

    const frameSnapshot = createVideoFrameCaptureSnapshot({
      nodes: [videoNode],
      links: [],
      nodeOutputs: new Map() as NodeOutputMap,
      sourceNodeId: videoNode.id,
      captures: [
        {
          index: 0,
          videoUrl: "https://oss.example.com/segment.mp4",
          frameImages: ["https://oss.example.com/frame-1.png"],
          frameImageOssIds: ["oss-frame-1"],
        },
      ],
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    const firstFrameChild = frameSnapshot?.createdNodes[0];
    expect(firstFrameChild).toBeDefined();

    const promptSnapshot = createVideoPromptTextSnapshot({
      nodes: frameSnapshot?.nodes || [],
      links: frameSnapshot?.links || [],
      nodeOutputs: frameSnapshot?.nodeOutputs || (new Map() as NodeOutputMap),
      sourceNodeId: videoNode.id,
      prompt: "reverse prompt",
      makeId: (prefix) => `${prefix}-${(nextId += 1)}`,
    });

    expect(promptSnapshot?.createdNode.x).toBe(firstFrameChild?.x);
    expect(promptSnapshot?.createdNode.y).toBeGreaterThan(firstFrameChild?.y || 0);
  });
});
