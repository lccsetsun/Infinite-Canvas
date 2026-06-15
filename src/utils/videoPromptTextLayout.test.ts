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

  it("places the reversed prompt below every existing frame-analysis child", () => {
    const videoNode = makeVideoNode();
    const firstSegment: GraphNode = {
      ...createNodeFromType("video_node", "segment-1", 720, 200),
      data: {
        frameCaptureSourceNodeId: videoNode.id,
        videoNodeHeight: 340,
      },
    };
    const firstFrameGrid: GraphNode = {
      ...createNodeFromType("image_node", "frames-1", 1380, 200),
      data: {
        frameCaptureSourceNodeId: videoNode.id,
        imageNodeHeight: 180,
        isFrameStrip: true,
      },
    };
    const secondSegment: GraphNode = {
      ...createNodeFromType("video_node", "segment-2", 720, 672),
      data: {
        frameCaptureSourceNodeId: videoNode.id,
        videoNodeHeight: 340,
      },
    };
    const secondFrameGrid: GraphNode = {
      ...createNodeFromType("image_node", "frames-2", 1380, 672),
      data: {
        frameCaptureSourceNodeId: videoNode.id,
        imageNodeHeight: 180,
        isFrameStrip: true,
      },
    };

    const promptSnapshot = createVideoPromptTextSnapshot({
      nodes: [videoNode, firstSegment, firstFrameGrid, secondSegment, secondFrameGrid],
      links: [],
      nodeOutputs: new Map() as NodeOutputMap,
      sourceNodeId: videoNode.id,
      prompt: "reverse prompt",
      makeId: (prefix) => `${prefix}-new`,
    });

    expect(promptSnapshot?.createdNode.x).toBe(firstSegment.x);
    expect(promptSnapshot?.createdNode.y).toBeGreaterThanOrEqual(secondSegment.y + 340 + 96);
  });

  it("keeps previous reversed prompt nodes and appends the next one below them", () => {
    const videoNode = makeVideoNode();
    const previousPrompt = createNodeFromType("text_node", "prompt-1", 720, 200);
    previousPrompt.title = "视频反推提示词";
    previousPrompt.data = {
      textNodeHeight: 360,
      response: "first prompt",
    };

    const promptSnapshot = createVideoPromptTextSnapshot({
      nodes: [videoNode, previousPrompt],
      links: [
        {
          id: "source-to-prompt-1",
          fromNodeId: videoNode.id,
          fromOutputIndex: 0,
          toNodeId: previousPrompt.id,
          toInputIndex: 3,
        },
      ],
      nodeOutputs: new Map([[previousPrompt.id, new Map([[0, "first prompt"]])]]) as NodeOutputMap,
      sourceNodeId: videoNode.id,
      prompt: "second prompt",
      makeId: (prefix) => `${prefix}-new`,
    });

    expect(promptSnapshot?.nodes.some((node) => node.id === previousPrompt.id)).toBe(true);
    expect(promptSnapshot?.links.some((link) => link.id === "source-to-prompt-1")).toBe(true);
    expect(promptSnapshot?.nodeOutputs.get(previousPrompt.id)?.get(0)).toBe("first prompt");
    expect(promptSnapshot?.createdNode.x).toBe(previousPrompt.x);
    expect(promptSnapshot?.createdNode.y).toBeGreaterThanOrEqual(previousPrompt.y + 360 + 96);
  });
});
