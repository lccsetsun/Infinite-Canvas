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
  collectLinkedMediaReferences,
  shouldApplyRemoteWorkflowSnapshot,
} from "./useWorkflowState";
import type { RemoteCanvasProject } from "../features/workspace/remoteCanvas";
import type { GraphNode } from "../types";

describe("useWorkflowState remote-only persistence", () => {
  it("does not keep local workspace storage fallback code", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("aicanvas_workspace_v2");
    expect(source).not.toContain("sanitizeWorkspaceForStorage");
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

  it("creates uploading canvas file nodes as inputless source nodes before OSS returns", () => {
    const result = addNodeToWorkflowSnapshot({
      nodes: [],
      links: [],
      type: "image_node",
      x: 0,
      y: 0,
      initialProps: {
        __uploadedAssetKind: "image",
        __nodeData: {
          isSourceNode: true,
          uploadingAsset: true,
          uploadedAssetName: "pasted-image.png",
        },
      },
      makeId: () => "image-source",
    });

    expect(result.node.inputs).toEqual([]);
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
        { id: "l-a", fromNodeId: sourceA.id, fromOutputIndex: 0, toNodeId: target.id, toInputIndex: 1 },
        { id: "l-b", fromNodeId: sourceB.id, fromOutputIndex: 0, toNodeId: target.id, toInputIndex: 1 },
        { id: "l-c", fromNodeId: sourceC.id, fromOutputIndex: 0, toNodeId: target.id, toInputIndex: 1 },
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
        { id: "l-a", fromNodeId: source.id, fromOutputIndex: 0, toNodeId: target.id, toInputIndex: 1 },
      ],
      nodes: [target, source],
      nodeOutputs: new Map([[source.id, new Map([[0, "https://example.com/a.png"]])]]),
    });

    expect(references.imageUrls).toEqual(["https://example.com/a.png"]);
    expect(references.ossIds).toEqual([]);
  });
});

describe("addNodeToWorkflowSnapshot", () => {
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
