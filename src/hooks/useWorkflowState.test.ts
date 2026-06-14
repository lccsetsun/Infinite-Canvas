import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IMAGE_PROMPT_PLACEHOLDER_URL,
  createTextNodeStarterFlowSnapshot,
  markUploadedAssetNodeAsSource,
  addNodeToWorkflowSnapshot,
  updateNodeDataSnapshot,
  updateNodePropertySnapshot,
  isRemoteWorkflowEcho,
  serializeRemotePersistSnapshot,
  sanitizeNodeRuntimeState,
  hasNodeRuntimeState,
  applyRemoteVideoTaskResultSnapshot,
  applyPendingRemoteVideoTaskSnapshot,
  collectLinkedMediaReferences,
  shouldApplyRemoteWorkflowSnapshot,
} from "./useWorkflowState";
import type { RemoteCanvasProject } from "../features/workspace/remoteCanvas";
import type { GraphNode } from "../types";
import { buildGridSplitChildNodeInitialProps } from "../utils/imageGridSplit";

describe("useWorkflowState remote-only persistence", () => {
  it("does not keep local workspace storage fallback code", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("aicanvas_workspace_v2");
    expect(source).not.toContain("sanitizeWorkspaceForStorage");
  });
});

describe("video helper operations", () => {
  it("builds frame-analysis and reversed-prompt snapshots from the latest canvas refs", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const frameAnalysisBlock = source.slice(
      source.indexOf("const addVideoFrameAnalysis = useCallback"),
      source.indexOf("const addVideoPromptTextNode = useCallback")
    );
    const promptReverseBlock = source.slice(
      source.indexOf("const addVideoPromptTextNode = useCallback"),
      source.indexOf("const updateSelectedProperty")
    );

    expect(frameAnalysisBlock).toContain("nodes: currentNodesRef.current");
    expect(frameAnalysisBlock).toContain("links: currentLinksRef.current");
    expect(frameAnalysisBlock).toContain("nodeOutputs: currentNodeOutputsRef.current");
    expect(promptReverseBlock).toContain("nodes: currentNodesRef.current");
    expect(promptReverseBlock).toContain("links: currentLinksRef.current");
    expect(promptReverseBlock).toContain("nodeOutputs: currentNodeOutputsRef.current");
  });
});

describe("IMAGE_PROMPT_PLACEHOLDER_URL", () => {
  it("is a valid encoded svg data url for starter image nodes", () => {
    expect(IMAGE_PROMPT_PLACEHOLDER_URL).toMatch(/^data:image\/svg\+xml,/);
    expect(IMAGE_PROMPT_PLACEHOLDER_URL).not.toContain("?3C");

    const decoded = decodeURIComponent(
      IMAGE_PROMPT_PLACEHOLDER_URL.replace("data:image/svg+xml,", "")
    );
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("</svg>");
    expect(decoded).toContain("<rect");
    expect(decoded).toContain("<path");
  });
});

function makeTextNode(id: string): GraphNode {
  return {
    id,
    type: "text_node",
    title: "文本节点 1",
    x: 120,
    y: 160,
    inputs: [],
    outputs: [],
    properties: {},
  };
}

function makeRemoteProject(nodes: GraphNode[]): RemoteCanvasProject {
  return {
    id: "canvas-1",
    name: "Project 1",
    coverUrl: "",
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    nodeCount: nodes.length,
    workflow: {
      nodes,
      links: [],
      nodeOutputs: [],
      groups: [],
    },
  };
}

describe("isRemoteWorkflowEcho", () => {
  it("treats a persisted copy of the current remote workflow as an echo", () => {
    const nodes = [makeTextNode("node-1")];

    expect(
      isRemoteWorkflowEcho(makeRemoteProject(nodes), {
        workflowId: "canvas-1",
        nodes,
        links: [],
        nodeOutputs: new Map(),
        groups: [],
      })
    ).toBe(true);
  });

  it("does not treat different remote workflow data as an echo", () => {
    expect(
      isRemoteWorkflowEcho(makeRemoteProject([makeTextNode("node-2")]), {
        workflowId: "canvas-1",
        nodes: [makeTextNode("node-1")],
        links: [],
        nodeOutputs: new Map(),
        groups: [],
      })
    ).toBe(false);
  });

  it("treats newly added local nodes as different from stale remote data", () => {
    expect(
      isRemoteWorkflowEcho(makeRemoteProject([makeTextNode("node-1")]), {
        workflowId: "canvas-1",
        nodes: [makeTextNode("node-1"), makeTextNode("node-2")],
        links: [],
        nodeOutputs: new Map(),
        groups: [],
      })
    ).toBe(false);
  });

  it("treats a sanitized remote copy as an echo while the local node is still running", () => {
    const runningNode: GraphNode = {
      ...makeTextNode("node-1"),
      data: { loading: true, status: "loading", loadingOperation: "generate" },
      properties: { status: "loading" },
    };
    const sanitizedNode = sanitizeNodeRuntimeState(runningNode);

    expect(
      isRemoteWorkflowEcho(makeRemoteProject([sanitizedNode]), {
        workflowId: "canvas-1",
        nodes: [runningNode],
        links: [],
        nodeOutputs: new Map(),
        groups: [],
      })
    ).toBe(true);
  });
});

describe("shouldApplyRemoteWorkflowSnapshot", () => {
  it("blocks stale remote snapshots while a newer local edit is waiting to persist", () => {
    expect(
      shouldApplyRemoteWorkflowSnapshot({
        incomingRemotePersistSignature: "remote-old",
        pendingLocalPersistSignature: "local-new",
      })
    ).toBe(false);
  });

  it("allows remote snapshots when they acknowledge the pending local edit", () => {
    expect(
      shouldApplyRemoteWorkflowSnapshot({
        incomingRemotePersistSignature: "local-new",
        pendingLocalPersistSignature: "local-new",
      })
    ).toBe(true);
  });

  it("allows remote snapshots when there is no pending local edit", () => {
    expect(
      shouldApplyRemoteWorkflowSnapshot({
        incomingRemotePersistSignature: "remote",
        pendingLocalPersistSignature: "",
      })
    ).toBe(true);
  });
});

describe("serializeRemotePersistSnapshot", () => {
  it("does not serialize interrupted loading state as persisted workflow data", () => {
    const loadingNode: GraphNode = {
      ...makeTextNode("node-1"),
      properties: { status: "loading" },
      data: {
        loading: true,
        status: "loading",
        loadingOperation: "generate",
        progress: 30,
        error: undefined,
      },
    };

    const serialized = serializeRemotePersistSnapshot({
      workflowId: "canvas-1",
      name: "Project 1",
      tags: [],
      nodes: [loadingNode],
      links: [],
      nodeOutputs: new Map(),
      groups: [],
    });

    const parsed = JSON.parse(serialized);
    const node = parsed.workflow.nodes[0];
    expect(node.properties.status).toBeUndefined();
    expect(node.data.loading).toBe(false);
    expect(node.data.status).toBe("idle");
    expect(node.data.loadingOperation).toBeUndefined();
    expect(node.data.progress).toBeUndefined();
  });

  it("stays stable when only local updatedAt-style metadata would change elsewhere", () => {
    const nodes = [makeTextNode("node-1")];

    const first = serializeRemotePersistSnapshot({
      workflowId: "canvas-1",
      name: "Project 1",
      category: "创作项目",
      tags: ["tag-1"],
      nodes,
      links: [],
      nodeOutputs: new Map(),
      groups: [],
    });

    const second = serializeRemotePersistSnapshot({
      workflowId: "canvas-1",
      name: "Project 1",
      category: "创作项目",
      tags: ["tag-1"],
      nodes,
      links: [],
      nodeOutputs: new Map(),
      groups: [],
    });

    expect(second).toBe(first);
  });

  it("changes when workflow content changes", () => {
    const first = serializeRemotePersistSnapshot({
      workflowId: "canvas-1",
      name: "Project 1",
      category: "创作项目",
      tags: ["tag-1"],
      nodes: [makeTextNode("node-1")],
      links: [],
      nodeOutputs: new Map(),
      groups: [],
    });

    const second = serializeRemotePersistSnapshot({
      workflowId: "canvas-1",
      name: "Project 1",
      category: "创作项目",
      tags: ["tag-1"],
      nodes: [makeTextNode("node-2")],
      links: [],
      nodeOutputs: new Map(),
      groups: [],
    });

    expect(second).not.toBe(first);
  });
});

describe("createTextNodeStarterFlowSnapshot", () => {
  it("creates a linked video node and primes an empty text node with a video system prompt", () => {
    const textNode = makeTextNode("text-1");

    const result = createTextNodeStarterFlowSnapshot({
      nodes: [textNode],
      links: [],
      textNodeId: "text-1",
      action: "video",
      makeId: (prefix) => `${prefix}-new`,
    });

    expect(result?.nodes).toHaveLength(2);
    expect(result?.createdNodeId).toBe("node-new");
    const updatedTextNode = result?.nodes.find((node) => node.id === "text-1") as
      | GraphNode
      | undefined;
    expect(updatedTextNode?.properties.system_prompt).toContain("视频生成");
    expect(updatedTextNode?.properties.textMode).toBe("plain");
    expect(updatedTextNode?.data?.forceInlineEditing).toBe(true);
    expect(updatedTextNode?.properties.text).toBeUndefined();
    expect(result?.nodes.find((node) => node.id === "node-new")?.type).toBe("video_node");
    expect(result?.links).toEqual([
      {
        id: "link-new",
        fromNodeId: "text-1",
        fromOutputIndex: 0,
        toNodeId: "node-new",
        toInputIndex: 0,
      },
    ]);
  });

  it("creates a linked audio node without replacing existing text", () => {
    const textNode = {
      ...makeTextNode("text-1"),
      properties: { text: "已有提示词" },
    };

    const result = createTextNodeStarterFlowSnapshot({
      nodes: [textNode],
      links: [],
      textNodeId: "text-1",
      action: "music",
      makeId: (prefix) => `${prefix}-new`,
    });

    const updatedTextNode = result?.nodes.find((node) => node.id === "text-1") as
      | GraphNode
      | undefined;
    expect(updatedTextNode?.properties.text).toBe("已有提示词");
    expect(updatedTextNode?.properties.textMode).toBe("plain");
    expect(updatedTextNode?.data?.forceInlineEditing).toBe(true);
    expect(result?.nodes.find((node) => node.id === "node-new")?.type).toBe("audio_node");
    expect(result?.nodes.find((node) => node.id === "node-new")?.y).toBe(textNode.y);
    expect(result?.links[0]).toMatchObject({
      fromNodeId: "text-1",
      toNodeId: "node-new",
      toInputIndex: 0,
    });
  });
});

describe("source node semantics", () => {
  it("clears text node inputs when switching to plain text mode", () => {
    const textNode = {
      ...makeTextNode("text-1"),
      inputs: [
        { name: "system_prompt", type: "STRING" as const },
        { name: "user_prompt", type: "ANY" as const },
      ],
      outputs: [{ name: "文本", type: "STRING" as const }],
    };

    const nodes = updateNodePropertySnapshot([textNode], "text-1", "textMode", "plain");

    expect(nodes[0].properties.textMode).toBe("plain");
    expect(nodes[0].inputs).toEqual([]);
    expect(nodes[0].outputs).toEqual(textNode.outputs);
  });

  it("marks uploaded image, video, and audio nodes as source nodes without inputs", () => {
    const imageNode: GraphNode = {
      id: "image-1",
      type: "image_node",
      title: "图片节点 1",
      x: 0,
      y: 0,
      inputs: [{ name: "prompt", type: "STRING" }],
      outputs: [{ name: "图片", type: "IMAGE" }],
      properties: {},
    };

    const sourceNode = markUploadedAssetNodeAsSource(
      imageNode,
      "image",
      "https://oss.example.com/a.png"
    );

    expect(sourceNode.inputs).toEqual([]);
    expect(sourceNode.properties.isSourceNode).toBe(true);
    expect(sourceNode.data?.isSourceNode).toBe(true);
    expect(sourceNode.properties.imageUrl).toBe("https://oss.example.com/a.png");
  });

  it("clears inputs when a node upload marks an existing media node as a source", () => {
    const imageNode: GraphNode = {
      id: "image-1",
      type: "image_node",
      title: "图片节点 1",
      x: 0,
      y: 0,
      inputs: [{ name: "prompt", type: "STRING" }],
      outputs: [{ name: "图片", type: "IMAGE" }],
      properties: {},
    };

    const nodes = updateNodeDataSnapshot([imageNode], "image-1", {
      imageUrl: "https://oss.example.com/upload.png",
      isSourceNode: true,
    });

    expect(nodes[0].inputs).toEqual([]);
    expect(nodes[0].data?.isSourceNode).toBe(true);
    expect(nodes[0].properties.isSourceNode).toBe(true);
  });

  it("creates uploading canvas file nodes as inputless external upload source nodes before OSS returns", () => {
    const result = addNodeToWorkflowSnapshot({
      nodes: [],
      links: [],
      type: "video_node",
      x: 0,
      y: 0,
      initialProps: {
        __uploadedAssetKind: "video",
        __nodeData: {
          externalUploadSource: true,
          isSourceNode: true,
          uploadingAsset: true,
          uploadedAssetName: "pasted-video.mp4",
        },
      },
      makeId: () => "video-source",
    });

    expect(result.node.inputs).toEqual([]);
    expect(result.node.type).toBe("video_node");
    expect(result.node.data?.externalUploadSource).toBe(true);
    expect(result.node.data?.isSourceNode).toBe(true);
    expect(result.node.data?.uploadingAsset).toBe(true);
    expect(result.node.properties.isSourceNode).toBe(true);
  });
});

describe("sanitizeNodeRuntimeState", () => {
  it("detects active runtime state", () => {
    expect(
      hasNodeRuntimeState({
        ...makeTextNode("node-1"),
        data: { loading: true, status: "loading" },
      })
    ).toBe(true);
    expect(hasNodeRuntimeState(makeTextNode("node-2"))).toBe(false);
  });

  it("clears stale loading state for every runnable node type after refresh", () => {
    const nodeTypes: Array<GraphNode["type"]> = [
      "text_node",
      "image_node",
      "video_node",
      "audio_node",
    ];

    nodeTypes.forEach((type) => {
      const loadingNode: GraphNode = {
        ...makeTextNode(`${type}-1`),
        type,
        properties: { status: "loading" },
        data: {
          loading: true,
          status: "loading",
          loadingOperation: "generate",
          progress: 60,
        },
      };

      const sanitized = sanitizeNodeRuntimeState(loadingNode);

      expect(sanitized.properties.status, type).toBeUndefined();
      expect(sanitized.data?.loading, type).toBe(false);
      expect(sanitized.data?.status, type).toBe("idle");
      expect(sanitized.data?.loadingOperation, type).toBeUndefined();
      expect(sanitized.data?.progress, type).toBeUndefined();
    });
  });

  it("preserves pending remote video task loading state after refresh", () => {
    const pendingVideoNode: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      properties: { status: "loading" },
      data: {
        loading: true,
        status: "loading",
        loadingOperation: "generate",
        progress: 60,
        remoteVideoTaskId: "remote-video-task-1",
        remoteVideoTaskStatus: "pending",
      },
    };

    const sanitized = sanitizeNodeRuntimeState(pendingVideoNode);

    expect(sanitized.properties.status).toBe("loading");
    expect(sanitized.data?.loading).toBe(true);
    expect(sanitized.data?.status).toBe("loading");
    expect(sanitized.data?.loadingOperation).toBe("generate");
    expect(sanitized.data?.remoteVideoTaskId).toBe("remote-video-task-1");
  });

  it("clears stale upload state after refresh", () => {
    const uploadingImageNode: GraphNode = {
      id: "image-1",
      type: "image_node",
      title: "图片节点 1",
      x: 0,
      y: 0,
      inputs: [],
      outputs: [],
      properties: {},
      data: {
        uploadingAsset: true,
        status: "uploading",
        uploadedAssetName: "demo.png",
      },
    };

    const sanitized = sanitizeNodeRuntimeState(uploadingImageNode);

    expect(sanitized.data?.uploadingAsset).toBeUndefined();
    expect(sanitized.data?.status).toBe("idle");
    expect(sanitized.data?.uploadedAssetName).toBe("demo.png");
  });
});

describe("applyRemoteVideoTaskResultSnapshot", () => {
  it("creates an immediately persistable pending remote video task snapshot", () => {
    const node: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      data: {
        status: "idle",
      },
    };

    const nextNodes = applyPendingRemoteVideoTaskSnapshot({
      nodes: [node],
      nodeId: "video-1",
      patch: {
        remoteVideoTaskId: "remote-video-task-1",
        remoteVideoTaskStatus: "pending",
      },
    });

    expect(nextNodes[0].data).toMatchObject({
      loading: true,
      loadingOperation: "generate",
      status: "loading",
      remoteVideoTaskId: "remote-video-task-1",
      remoteVideoTaskStatus: "pending",
    });
    expect(nextNodes[0].properties.status).toBe("loading");
  });

  it("writes completed remote video tasks to the node and outputs", () => {
    const node: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      data: {
        loading: true,
        status: "loading",
        remoteVideoTaskId: "remote-video-task-1",
      },
    };

    const result = applyRemoteVideoTaskResultSnapshot({
      nodes: [node],
      nodeOutputs: new Map(),
      nodeId: "video-1",
      taskId: "remote-video-task-1",
      result: {
        status: "success",
        videoUrl: "https://example.com/generated.mp4",
        error: "",
        rawStatus: "success",
      },
    });

    expect(result.nodes[0].data).toMatchObject({
      videoUrl: "https://example.com/generated.mp4",
      loading: false,
      status: "success",
      remoteVideoTaskId: "remote-video-task-1",
      remoteVideoTaskStatus: "success",
    });
    expect(result.nodeOutputs.get("video-1")?.get(0)).toBe("https://example.com/generated.mp4");
  });

  it("keeps pending remote video tasks loading", () => {
    const node: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      data: {
        loading: true,
        status: "loading",
        remoteVideoTaskId: "remote-video-task-1",
      },
    };

    const result = applyRemoteVideoTaskResultSnapshot({
      nodes: [node],
      nodeOutputs: new Map(),
      nodeId: "video-1",
      taskId: "remote-video-task-1",
      result: { status: "pending", videoUrl: "", error: "", rawStatus: "running" },
    });

    expect(result.nodes[0].data).toMatchObject({
      loading: true,
      status: "loading",
      remoteVideoTaskStatus: "running",
    });
    expect(result.nodeOutputs.has("video-1")).toBe(false);
  });
});

describe("collectLinkedMediaReferences", () => {
  it("collects oss ids from every linked image reference, including ossIds arrays", () => {
    const target = { ...makeTextNode("target"), type: "image_node" as const };
    const sourceA: GraphNode = {
      ...makeTextNode("image-a"),
      type: "image_node",
      data: { imageUrl: "https://example.com/a.png", ossId: "oss-a" },
    };
    const sourceB: GraphNode = {
      ...makeTextNode("image-b"),
      type: "image_node",
      data: { imageUrl: "https://example.com/b.png", ossIds: ["oss-b"] },
    };
    const sourceC: GraphNode = {
      ...makeTextNode("image-c"),
      type: "image_node",
      data: { imageUrl: "https://example.com/c.png" },
      properties: { ossId: "oss-c" },
    };

    const references = collectLinkedMediaReferences({
      nodeId: target.id,
      links: [
        {
          id: "l-a",
          fromNodeId: sourceA.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 1,
        },
        {
          id: "l-b",
          fromNodeId: sourceB.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 1,
        },
        {
          id: "l-c",
          fromNodeId: sourceC.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 1,
        },
      ],
      nodes: [target, sourceA, sourceB, sourceC],
      nodeOutputs: new Map(),
    });

    expect(references.ossIds).toEqual(["oss-a", "oss-b", "oss-c"]);
    expect(references.imageUrls).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
      "https://example.com/c.png",
    ]);
  });

  it("collects the oss id carried by an extracted frame image node", () => {
    const target = { ...makeTextNode("target"), type: "image_node" as const };
    const extractedFrame: GraphNode = {
      ...makeTextNode("frame-child"),
      type: "image_node",
      data: {
        imageUrl: "https://example.com/frame-12.png",
        imageUrls: ["https://example.com/frame-12.png"],
        ossId: "oss-frame-12",
        extractedFrameSourceNodeId: "frame-strip",
        extractedFrameIndex: 11,
      },
    };

    const references = collectLinkedMediaReferences({
      nodeId: target.id,
      links: [
        {
          id: "l-frame-child",
          fromNodeId: extractedFrame.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 1,
        },
      ],
      nodes: [target, extractedFrame],
      nodeOutputs: new Map([
        [extractedFrame.id, new Map([[0, "https://example.com/frame-12.png"]])],
      ]),
    });

    expect(references.imageUrls).toEqual(["https://example.com/frame-12.png"]);
    expect(references.ossIds).toEqual(["oss-frame-12"]);
  });

  it("collects oss ids from frame-grid image nodes produced by video analysis", () => {
    const target = { ...makeTextNode("target"), type: "video_node" as const };
    const frameGrid: GraphNode = {
      ...makeTextNode("frame-grid"),
      type: "image_node",
      data: {
        imageUrls: [
          "https://example.com/frame-1.png",
          "https://example.com/frame-2.png",
        ],
        frameImageOssIds: ["oss-frame-1", "oss-frame-2"],
        isFrameStrip: true,
      },
    };

    const references = collectLinkedMediaReferences({
      nodeId: target.id,
      links: [
        {
          id: "l-frame-grid",
          fromNodeId: frameGrid.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 0,
        },
      ],
      nodes: [target, frameGrid],
      nodeOutputs: new Map([
        [frameGrid.id, new Map([[0, frameGrid.data?.imageUrls]])],
      ]),
    });

    expect(references.imageUrls).toEqual([
      "https://example.com/frame-1.png",
      "https://example.com/frame-2.png",
    ]);
    expect(references.ossIds).toEqual(["oss-frame-1", "oss-frame-2"]);
  });

  it("does not treat plain output urls as oss ids", () => {
    const target = { ...makeTextNode("target"), type: "image_node" as const };
    const source: GraphNode = {
      ...makeTextNode("image-a"),
      type: "image_node",
      data: { imageUrl: "https://example.com/a.png" },
    };

    const references = collectLinkedMediaReferences({
      nodeId: target.id,
      links: [
        {
          id: "l-a",
          fromNodeId: source.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 1,
        },
      ],
      nodes: [target, source],
      nodeOutputs: new Map([[source.id, new Map([[0, "https://example.com/a.png"]])]]),
    });

    expect(references.imageUrls).toEqual(["https://example.com/a.png"]);
    expect(references.ossIds).toEqual([]);
  });
});

describe("addNodeToWorkflowSnapshot", () => {
  it("keeps grid-split child image nodes linkable", () => {
    const source: GraphNode = {
      id: "source-image",
      type: "image_node",
      title: "图片节点 12",
      x: 100,
      y: 100,
      inputs: [{ name: "source_image", type: "IMAGE" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: { imageUrl: "https://oss.example.com/source.png" },
      data: {
        imageUrl: "https://oss.example.com/source.png",
        imageUrls: ["https://oss.example.com/source.png"],
      },
    };

    const result = addNodeToWorkflowSnapshot({
      nodes: [source],
      links: [],
      type: "image_node",
      x: 480,
      y: 120,
      initialProps: buildGridSplitChildNodeInitialProps({
        cellIndex: 1,
        crop: { sw: 432, sh: 248 },
        dataUrl: "data:image/png;base64,child",
        gridCols: 2,
        gridRows: 2,
        sourceTitle: source.title,
      }),
      connectFromDraft: { fromNodeId: source.id, fromOutputIndex: 0, toInputIndex: 0 },
      makeId: (prefix) => (prefix === "node" ? "grid-child" : "grid-link"),
    });

    expect(result.warning).toBeUndefined();
    expect(result.node.title).toBe("宫格切分 2x2 #2");
    expect(result.node.inputs).toEqual([
      { name: "source_image", type: "IMAGE" },
      { name: "prompt", type: "STRING" },
      { name: "negative_prompt", type: "STRING" },
      { name: "aspect_ratio", type: "STRING" },
      { name: "source_audio", type: "AUDIO" },
      { name: "source_video", type: "VIDEO" },
    ]);
    expect(result.node.properties.isSourceNode).toBeUndefined();
    expect(result.node.data?.isSourceNode).toBeUndefined();
    expect(result.links).toEqual([
      {
        fromNodeId: "source-image",
        fromOutputIndex: 0,
        id: "grid-link",
        toInputIndex: 0,
        toNodeId: "grid-child",
      },
    ]);
  });

  it("can be chained from the latest snapshot without dropping uploaded file nodes", () => {
    const first = addNodeToWorkflowSnapshot({
      nodes: [],
      links: [],
      type: "image_node",
      x: 100,
      y: 120,
      initialProps: {
        imageUrl: "blob:first",
        __uploadedAssetKind: "image",
        __uploadedAssetUrl: "blob:first",
        __uploadedAssetName: "first.png",
      },
      makeId: (prefix) => `${prefix}-1`,
    });

    const second = addNodeToWorkflowSnapshot({
      nodes: first.nodes,
      links: first.links,
      type: "video_node",
      x: 160,
      y: 180,
      initialProps: {
        videoUrl: "blob:second",
        __uploadedAssetKind: "video",
        __uploadedAssetUrl: "blob:second",
        __uploadedAssetName: "second.mp4",
      },
      makeId: (prefix) => `${prefix}-2`,
    });

    expect(second.nodes).toHaveLength(2);
    expect(second.nodes.map((node) => node.type)).toEqual(["image_node", "video_node"]);
    expect(second.nodes[0].properties.imageUrl).toBe("blob:first");
    expect(second.nodes[1].properties.videoUrl).toBe("blob:second");
  });
});
