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
  applyBatchEditImagesTaskResultSnapshot,
  applyPendingBatchEditImagesTaskSnapshot,
  collectLinkedMediaReferences,
  collectPendingBatchEditImagesPollTargets,
  collectPendingRemoteVideoPollTargets,
  createBatchEditImagesResultRunSnapshot,
  interruptNonRecoverableRuntimeNode,
  isPersistablePendingRuntimeNode,
  shouldApplyRemoteWorkflowSnapshot,
  syncVideoBatchReplacementTargetsSnapshot,
} from "./useWorkflowState";
import type { RemoteCanvasProject } from "../features/workspace/remoteCanvas";
import type { GraphNode } from "../types";
import { buildGridSplitChildNodeInitialProps } from "../utils/imageGridSplit";
import { collectNodeInputReferences } from "../utils/textNodeReferences";

describe("useWorkflowState remote-only persistence", () => {
  it("does not keep local workspace storage fallback code", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("aicanvas_workspace_v2");
    expect(source).not.toContain("sanitizeWorkspaceForStorage");
  });

  it("does not block remote snapshots for resumable pending batch replacement tasks", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const persistEffectSource = source.slice(
      source.indexOf("const hasPendingRuntimeState = nodes.some"),
      source.indexOf("const persistableNodes = sanitizeNodesRuntimeState(nodes)")
    );

    expect(persistEffectSource).toContain("!isPersistablePendingRuntimeNode(node)");
  });

  it("exposes an immediate remote persist flush path for critical transitions", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

    expect(source).toContain("const flushRemotePersist = useCallback");
    expect(source).toContain('interruptNonRecoverableRuntimeNodes(activeNodes, "refresh")');
    expect(source).toContain('flushRemotePersist("add-node")');
    expect(source).toContain('flushRemotePersist("remove-node")');
    expect(source).toContain('flushRemotePersist("remove-nodes")');
    expect(source).toContain('flushRemotePersist("duplicate-node")');
    expect(source).toContain('flushRemotePersist("clear-canvas")');
    expect(source).toContain('flushRemotePersist("insert-nodes")');
    expect(source).toContain('flushRemotePersist("add-link")');
    expect(source).toContain('flushRemotePersist("add-links")');
    expect(source).toContain('flushRemotePersist("remove-link")');
    expect(source).toContain('flushRemotePersist("remove-input-reference")');
    expect(source).toContain('flushRemotePersist("run-node-start")');
    expect(source).toContain('flushRemotePersist("run-node-complete")');
    expect(source).toContain('flushRemotePersist("remote-video-task")');
    expect(source).toContain('flushRemotePersist("batch-result-run")');
  });

  it("keeps node output refs current before completion flushes", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const writeOutputBlock = source.slice(
      source.indexOf("const writeNodeOutput = useCallback"),
      source.indexOf("const collectTextNodeMediaReferences")
    );

    expect(writeOutputBlock).toContain("currentNodeOutputsRef.current = next");
  });

  it("registers unload protection for unsaved or non-recoverable work", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

    expect(source).toContain("getLeaveProtectionState");
    expect(source).toContain('window.addEventListener("beforeunload"');
    expect(source).toContain('window.addEventListener("pagehide"');
    expect(source).toContain('flushRemotePersist("pagehide")');
  });

  it("handles duplicate remote persist rejection without retrying the same payload", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const persistCatchSource = source.slice(
      source.indexOf(".catch((error) => {"),
      source.indexOf("console.warn(\"Failed to persist remote canvas\", error);")
    );

    expect(persistCatchSource).toContain("isDuplicateRemotePersistError(error)");
    expect(persistCatchSource).toContain("lastRemotePersistSignatureRef.current = persistKey");
    expect(persistCatchSource).toContain("pendingLocalPersistSignatureRef.current = \"\"");
    expect(persistCatchSource).not.toContain("setRemotePersistRetryTick");
  });

  it("syncs node group membership while resizing groups", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const resizeGroupBlock = source.slice(
      source.indexOf("const resizeGroup = useCallback"),
      source.indexOf("const writeNodeOutput = useCallback")
    );

    expect(resizeGroupBlock).toContain("syncNodeGroupMembership(activeNodes, nextGroups)");
    expect(resizeGroupBlock).toContain('markRemoteDirty(nodesChanged ? "structure" : "content")');
    expect(source).toContain("resizeGroup,");
  });

  it("keeps current node refs in sync when updating node properties before data", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const updatePropertyBlock = source.slice(
      source.indexOf("const updateNodeProperty ="),
      source.indexOf("const updateNodeData =")
    );

    expect(updatePropertyBlock).toContain("const activeNodes = currentNodesRef.current");
    expect(updatePropertyBlock).toContain("const next = updateNodePropertySnapshot");
    expect(updatePropertyBlock).toContain("currentNodesRef.current = next");
    expect(updatePropertyBlock).toContain("setNodes(next)");
    expect(updatePropertyBlock).not.toContain("setNodes((prev)");
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
    expect(frameAnalysisBlock).toContain("setSelectedNodeId(videoNodeId)");
    expect(frameAnalysisBlock).not.toContain(
      "setSelectedNodeId(snapshot.createdNodes[0]?.id ?? videoNodeId)"
    );
    expect(promptReverseBlock).toContain("nodes: currentNodesRef.current");
    expect(promptReverseBlock).toContain("links: currentLinksRef.current");
    expect(promptReverseBlock).toContain("nodeOutputs: currentNodeOutputsRef.current");
  });

  it("passes replacement frame oss ids into frame replacement snapshots", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");
    const replaceFrameBlock = source.slice(
      source.indexOf("const replaceFrameImageUrl = useCallback"),
      source.indexOf("const addVideoFrameAnalysis = useCallback")
    );

    expect(replaceFrameBlock).toContain("replacementOssId?: string");
    expect(replaceFrameBlock).toContain("replacementOssId,");
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

  it("classifies only resumable pending runtime nodes as persistable", () => {
    const pendingVideoNode: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      data: {
        loading: true,
        loadingOperation: "generate",
        remoteVideoTaskId: "remote-video-task-1",
        status: "loading",
      },
    };
    const pendingBatchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        batchReplacementTaskId: "bg_2066519705937645568",
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };
    const pendingBatchResultNode: GraphNode = {
      ...makeTextNode("batch-result-1"),
      type: "image_node",
      data: {
        batchReplacementRunId: "bg_2066519705937645568",
        batchReplacementSourceNodeId: "batch-1",
        batchReplacementResultCount: 3,
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };
    const uploadingNode: GraphNode = {
      ...makeTextNode("uploading-image"),
      type: "image_node",
      data: {
        uploadingAsset: true,
        status: "uploading",
      },
    };
    const frameAnalysisNode: GraphNode = {
      ...makeTextNode("frame-analysis"),
      type: "video_node",
      properties: { videoUrl: "https://example.com/source.mp4" },
      data: {
        loading: true,
        loadingOperation: "frame-analysis",
        status: "loading",
        videoUrl: "https://example.com/source.mp4",
      },
    };
    const promptReverseNode: GraphNode = {
      ...makeTextNode("prompt-reverse"),
      type: "video_node",
      properties: { videoUrl: "https://example.com/source.mp4" },
      data: {
        loading: true,
        loadingOperation: "video-prompt",
        status: "loading",
        videoUrl: "https://example.com/source.mp4",
      },
    };

    expect(isPersistablePendingRuntimeNode(pendingVideoNode)).toBe(true);
    expect(isPersistablePendingRuntimeNode(pendingBatchNode)).toBe(true);
    expect(isPersistablePendingRuntimeNode(pendingBatchResultNode)).toBe(true);
    expect(isPersistablePendingRuntimeNode(frameAnalysisNode)).toBe(true);
    expect(isPersistablePendingRuntimeNode(promptReverseNode)).toBe(true);
    expect(isPersistablePendingRuntimeNode(uploadingNode)).toBe(false);
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

  it("preserves pending batch replacement task loading state after refresh", () => {
    const pendingBatchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      properties: { status: "loading" },
      data: {
        loading: true,
        status: "loading",
        loadingOperation: "batch-replacement",
        batchReplacementTaskId: "bg_2066519705937645568",
        batchReplacementTaskStatus: "pending",
      },
    };

    const sanitized = sanitizeNodeRuntimeState(pendingBatchNode);

    expect(sanitized.properties.status).toBe("loading");
    expect(sanitized.data?.loading).toBe(true);
    expect(sanitized.data?.status).toBe("loading");
    expect(sanitized.data?.loadingOperation).toBe("batch-replacement");
    expect(sanitized.data?.batchReplacementTaskId).toBe("bg_2066519705937645568");
  });

  it("preserves a new pending batch replacement task even when the node has an old result", () => {
    const pendingBatchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      properties: { status: "loading" },
      data: {
        loading: true,
        status: "loading",
        loadingOperation: "batch-replacement",
        batchReplacementTaskId: "bg_2066523725712461824",
        batchReplacementTaskStatus: "pending",
        batchReplacementResult: [{ index: 0, video: "old-result.mp4", frame_images: [] }],
      },
    };

    const sanitized = sanitizeNodeRuntimeState(pendingBatchNode);

    expect(sanitized.properties.status).toBe("loading");
    expect(sanitized.data?.loading).toBe(true);
    expect(sanitized.data?.batchReplacementTaskId).toBe("bg_2066523725712461824");
  });

  it("preserves pending batch replacement result grids after refresh", () => {
    const pendingResultNode: GraphNode = {
      id: "batch-result-1",
      type: "image_node",
      title: "批量替换结果 1",
      x: 900,
      y: 120,
      inputs: [{ name: "input", type: "IMAGE" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: { status: "loading" },
      data: {
        batchReplacementRunId: "bg_2066531184648785920",
        batchReplacementSourceNodeId: "batch-1",
        batchReplacementResultCount: 3,
        imageUrls: [
          "__batch_replacement_frame_placeholder__",
          "__batch_replacement_frame_placeholder__",
          "__batch_replacement_frame_placeholder__",
        ],
        isFrameStrip: true,
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };

    const sanitized = sanitizeNodeRuntimeState(pendingResultNode);

    expect(sanitized.properties.status).toBe("loading");
    expect(sanitized.data?.loading).toBe(true);
    expect(sanitized.data?.status).toBe("loading");
    expect(sanitized.data?.loadingOperation).toBe("batch-replacement");
    expect(sanitized.data?.batchReplacementRunId).toBe("bg_2066531184648785920");
    expect(sanitized.data?.imageUrls).toEqual(pendingResultNode.data?.imageUrls);
  });

  it("preserves resumable video auxiliary loading state after refresh", () => {
    const pendingFrameAnalysisNode: GraphNode = {
      ...makeTextNode("video-frame-analysis"),
      type: "video_node",
      properties: { status: "loading", videoUrl: "https://example.com/source.mp4" },
      data: {
        loading: true,
        status: "loading",
        loadingOperation: "frame-analysis",
        videoUrl: "https://example.com/source.mp4",
      },
    };
    const pendingPromptReverseNode: GraphNode = {
      ...makeTextNode("video-prompt-reverse"),
      type: "video_node",
      properties: { status: "loading", videoUrl: "https://example.com/source.mp4" },
      data: {
        loading: true,
        status: "loading",
        loadingOperation: "video-prompt",
        videoUrl: "https://example.com/source.mp4",
      },
    };

    const sanitizedFrameAnalysis = sanitizeNodeRuntimeState(pendingFrameAnalysisNode);
    const sanitizedPromptReverse = sanitizeNodeRuntimeState(pendingPromptReverseNode);

    expect(sanitizedFrameAnalysis.data?.loading).toBe(true);
    expect(sanitizedFrameAnalysis.data?.loadingOperation).toBe("frame-analysis");
    expect(sanitizedPromptReverse.data?.loading).toBe(true);
    expect(sanitizedPromptReverse.data?.loadingOperation).toBe("video-prompt");
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

  it("converts non-recoverable text and image loading states to interrupted after refresh", () => {
    const textNode: GraphNode = {
      ...makeTextNode("text-loading"),
      type: "text_node",
      properties: { status: "loading", text: "写一段文案" },
      data: { loading: true, status: "loading", loadingOperation: "generate" },
    };
    const imageNode: GraphNode = {
      ...makeTextNode("image-loading"),
      type: "image_node",
      properties: { status: "loading", prompt: "a glass house" },
      data: { loading: true, status: "loading", loadingOperation: "generate" },
    };

    const interruptedText = interruptNonRecoverableRuntimeNode(textNode, "refresh", 1000);
    const interruptedImage = interruptNonRecoverableRuntimeNode(imageNode, "refresh", 1000);

    expect(interruptedText.data).toMatchObject({
      loading: false,
      status: "interrupted",
      interruptedReason: "refresh",
      interruptedAt: 1000,
    });
    expect(interruptedText.data?.loadingOperation).toBeUndefined();
    expect(interruptedText.properties.status).toBeUndefined();
    expect(interruptedText.properties.text).toBe("写一段文案");

    expect(interruptedImage.data).toMatchObject({
      loading: false,
      status: "interrupted",
      interruptedReason: "refresh",
      interruptedAt: 1000,
    });
    expect(interruptedImage.data?.loadingOperation).toBeUndefined();
    expect(interruptedImage.properties.status).toBeUndefined();
    expect(interruptedImage.properties.prompt).toBe("a glass house");
  });

  it("does not interrupt recoverable video pending nodes", () => {
    const pendingVideoNode: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      properties: { status: "loading" },
      data: {
        loading: true,
        loadingOperation: "generate",
        remoteVideoTaskId: "video-task-1",
        status: "loading",
      },
    };

    const result = interruptNonRecoverableRuntimeNode(pendingVideoNode, "refresh", 1000);

    expect(result).toBe(pendingVideoNode);
  });
});

describe("updateNodeDataSnapshot", () => {
  it("clears stale loading properties when a node receives a successful response", () => {
    const loadingNode: GraphNode = {
      ...makeTextNode("text-1"),
      properties: { status: "loading" },
      data: { loading: true, status: "loading" },
    };

    const nodes = updateNodeDataSnapshot([loadingNode], "text-1", {
      loading: false,
      response: "remote analysis",
      status: "success",
    });

    expect(nodes[0].data).toMatchObject({
      loading: false,
      response: "remote analysis",
      status: "success",
    });
    expect(nodes[0].properties.status).toBeUndefined();
  });
});

function makeVideoBatchReplacementNode(): GraphNode {
  return {
    id: "batch-1",
    type: "video_batch_replacement_node",
    title: "批量替换",
    x: 0,
    y: 0,
    inputs: [{ name: "source_video", type: "VIDEO" }],
    outputs: [{ name: "替换配置", type: "ANY" }],
    properties: {},
    data: {
      batchReplacementSlots: [
        {
          key: "front",
          title: "正面",
          placeholder: "请上传产品图正面",
          imageUrl: "https://example.com/front.png",
          prompt: "正面",
        },
        {
          key: "side",
          title: "侧面",
          placeholder: "请上传产品图侧面",
          imageUrl: "https://example.com/side.png",
          prompt: "侧面",
        },
        {
          key: "back",
          title: "背面",
          placeholder: "请上传产品图背面",
          imageUrl: "",
          prompt: "背面",
        },
      ],
    },
  };
}

function makeBatchTargetImageNode(): GraphNode {
  return {
    id: "image-target",
    type: "image_node",
    title: "图片节点 1",
    x: 0,
    y: 0,
    inputs: [{ name: "source_image", type: "IMAGE" }],
    outputs: [{ name: "图片", type: "IMAGE" }],
    properties: {},
    data: {},
  };
}

describe("video batch replacement downstream sync", () => {
  it("syncs filled batch replacement slots into linked image node thumbnails", () => {
    const batchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        ...makeVideoBatchReplacementNode().data,
        batchReplacementAspectRatio: "16:9",
      },
    };
    const imageNode = makeBatchTargetImageNode();
    const link = {
      id: "batch-link",
      fromNodeId: batchNode.id,
      fromOutputIndex: 0,
      toNodeId: imageNode.id,
      toInputIndex: 0,
    };

    const result = syncVideoBatchReplacementTargetsSnapshot({
      batchNodeId: batchNode.id,
      links: [link],
      nodeOutputs: new Map(),
      nodes: [batchNode, imageNode],
    });

    const syncedImageNode = result.nodes.find((node) => node.id === imageNode.id);
    expect(syncedImageNode?.data?.imageUrls).toEqual([
      "https://example.com/front.png",
      "https://example.com/side.png",
    ]);
    expect(syncedImageNode?.data?.imageUrl).toBe("https://example.com/front.png");
    expect(result.links).toEqual([link]);
  });

  it("keeps batch replacement slot data owned by the source node when rendering input thumbnails", () => {
    const batchNode = makeVideoBatchReplacementNode();
    const imageNode = makeBatchTargetImageNode();
    const link = {
      id: "batch-link",
      fromNodeId: batchNode.id,
      fromOutputIndex: 0,
      toNodeId: imageNode.id,
      toInputIndex: 0,
    };

    const references = collectNodeInputReferences({
      links: [link],
      nodeOutputs: new Map(),
      nodes: [batchNode, imageNode],
      targetNodeId: imageNode.id,
    });

    expect(references.map((reference) => reference.linkId)).toEqual([link.id, link.id]);
    expect(batchNode.data?.batchReplacementSlots?.map((slot) => slot.imageUrl)).toEqual([
      "https://example.com/front.png",
      "https://example.com/side.png",
      "",
    ]);
  });
});

describe("applyRemoteVideoTaskResultSnapshot", () => {
  it("uses a three second interval for remote video polling", () => {
    const source = readFileSync(new URL("./useWorkflowState.ts", import.meta.url), "utf8");

    expect(source).toContain("const REMOTE_VIDEO_POLL_INTERVAL_MS = 3_000;");
    expect(source).not.toContain("const REMOTE_VIDEO_POLL_INTERVAL_MS = 10_000;");
  });

  it("collects pending remote video poll targets even when an old video url exists", () => {
    const node: GraphNode = {
      ...makeTextNode("video-1"),
      type: "video_node",
      properties: {
        status: "loading",
        videoUrl: "https://example.com/old-result.mp4",
      },
      data: {
        loading: true,
        loadingOperation: "generate",
        status: "loading",
        videoUrl: "https://example.com/old-result.mp4",
        remoteVideoTaskId: "remote-video-task-2",
        remoteVideoTaskStatus: "pending",
      },
    };

    expect(collectPendingRemoteVideoPollTargets([node])).toEqual([
      {
        nodeId: "video-1",
        taskId: "remote-video-task-2",
      },
    ]);
  });

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
      generationStartedAt: expect.any(Number),
      generationFinishedAt: undefined,
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
      generationFinishedAt: expect.any(Number),
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

describe("applyBatchEditImagesTaskResultSnapshot", () => {
  it("collects pending batch replacement poll targets from result nodes after refresh", () => {
    const batchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };
    const resultNode: GraphNode = {
      ...makeTextNode("result-1"),
      type: "image_node",
      data: {
        batchReplacementRunId: "bg_2066531184648785920",
        batchReplacementSourceNodeId: "batch-1",
        batchReplacementResultCount: 3,
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };

    expect(collectPendingBatchEditImagesPollTargets([batchNode, resultNode])).toEqual([
      {
        batchNodeId: "batch-1",
        taskId: "bg_2066531184648785920",
      },
    ]);
  });

  it("deduplicates batch replacement poll targets when source and result nodes are both pending", () => {
    const batchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        batchReplacementTaskId: "bg_2066531184648785920",
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };
    const resultNode: GraphNode = {
      ...makeTextNode("result-1"),
      type: "image_node",
      data: {
        batchReplacementRunId: "bg_2066531184648785920",
        batchReplacementSourceNodeId: "batch-1",
        batchReplacementResultCount: 3,
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
      },
    };

    expect(collectPendingBatchEditImagesPollTargets([batchNode, resultNode])).toEqual([
      {
        batchNodeId: "batch-1",
        taskId: "bg_2066531184648785920",
      },
    ]);
  });

  it("creates an immediately persistable pending batch replacement task snapshot", () => {
    const node = makeVideoBatchReplacementNode();

    const nextNodes = applyPendingBatchEditImagesTaskSnapshot({
      nodes: [node],
      nodeId: "batch-1",
      patch: {
        batchReplacementTaskId: "bg_2066519705937645568",
        batchReplacementTaskStatus: "pending",
      },
    });

    expect(nextNodes[0].data).toMatchObject({
      loading: true,
      loadingOperation: "batch-replacement",
      status: "loading",
      batchReplacementTaskId: "bg_2066519705937645568",
      batchReplacementTaskStatus: "pending",
      batchReplacementStartedAt: expect.any(Number),
    });
    expect(nextNodes[0].properties.status).toBe("loading");
  });

  it("keeps pending batch replacement tasks loading", () => {
    const node: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        loading: true,
        status: "loading",
        batchReplacementTaskId: "bg_2066519705937645568",
      },
    };

    const result = applyBatchEditImagesTaskResultSnapshot({
      nodes: [node],
      nodeId: "batch-1",
      taskId: "bg_2066519705937645568",
      result: { status: "pending", items: [], error: "", rawStatus: "running" },
    });

    expect(result[0].data).toMatchObject({
      loading: true,
      status: "loading",
      loadingOperation: "batch-replacement",
      batchReplacementTaskStatus: "running",
    });
  });

  it("writes completed batch replacement tasks to the node", () => {
    const node: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        loading: true,
        status: "loading",
        batchReplacementTaskId: "bg_2066519705937645568",
      },
    };
    const items = [
      {
        index: 0,
        video: "https://example.com/result.mp4",
        frame_images: [{ url: "https://example.com/frame.png", ossId: "oss-1" }],
      },
    ];

    const result = applyBatchEditImagesTaskResultSnapshot({
      nodes: [node],
      nodeId: "batch-1",
      taskId: "bg_2066519705937645568",
      result: { status: "success", items, error: "", rawStatus: "success" },
    });

    expect(result[0].data).toMatchObject({
      loading: false,
      status: "success",
      batchReplacementTaskId: "bg_2066519705937645568",
      batchReplacementTaskStatus: "success",
      batchReplacementResult: items,
      batchReplacementFinishedAt: expect.any(Number),
    });
  });

  it("creates one result grid matching the source frame-analysis node before polling completes", () => {
    const batchNode = makeVideoBatchReplacementNode();
    const frameNode: GraphNode = {
      id: "frame-1",
      type: "image_node",
      title: "逐帧分析 1",
      x: 300,
      y: 120,
      inputs: [{ name: "source_video", type: "VIDEO" }],
      outputs: [{ name: "图片", type: "IMAGE" }],
      properties: {},
      data: {
        isFrameStrip: true,
        frameGridColumns: 3,
        frameGridRows: 1,
        frameTileHeight: 180,
        frameTileWidth: 300,
        imageDisplayHeight: 180,
        imageDisplayWidth: 900,
        imageNodeHeight: 210,
        imageNodeWidth: 900,
        imagePortCenterY: 105,
      },
    };
    let idIndex = 0;

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: frameNode.id,
      frameCount: 3,
      links: [],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: new Map(),
      nodes: [batchNode, frameNode],
      result: {
        status: "pending",
        items: [{ index: 0, url: "https://example.com/generated-1.png", ossId: "oss-1" }],
        error: "",
        rawStatus: "running",
      },
      runId: "bg_2066531184648785920",
    });

    const resultNodes = result.nodes.filter(
      (node) => node.data?.batchReplacementRunId === "bg_2066531184648785920"
    );
    expect(resultNodes).toHaveLength(1);
    expect(resultNodes[0].data).toMatchObject({
      isFrameStrip: true,
      frameGridColumns: 3,
      frameGridRows: 1,
      frameTileHeight: 180,
      frameTileWidth: 300,
      imageDisplayHeight: 180,
      imageDisplayWidth: 900,
      imageNodeHeight: 210,
      imageNodeWidth: 900,
      imagePortCenterY: 105,
      loading: true,
      loadingOperation: "batch-replacement",
      batchReplacementResultCount: 3,
    });
    expect(resultNodes[0].data?.imageUrls).toHaveLength(3);
    expect(resultNodes[0].data?.imageUrls?.[0]).toBe("https://example.com/generated-1.png");
    expect(resultNodes[0].data?.imageUrls?.[1]).toBe("__batch_replacement_frame_placeholder__");
    expect(result.links).toHaveLength(1);
    expect(result.nodeOutputs.get(resultNodes[0].id)?.get(0)).toBe(
      "https://example.com/generated-1.png"
    );
  });

  it("uses the source frame count and grid layout instead of hard-coding three placeholders", () => {
    const batchNode = makeVideoBatchReplacementNode();
    const frameNode: GraphNode = {
      id: "frame-4",
      type: "image_node",
      title: "frame analysis",
      x: 300,
      y: 120,
      inputs: [{ name: "source_video", type: "VIDEO" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        isFrameStrip: true,
        frameGridColumns: 2,
        frameGridRows: 2,
        frameTileHeight: 180,
        frameTileWidth: 300,
        imageDisplayHeight: 360,
        imageDisplayWidth: 600,
        imageNodeHeight: 390,
        imageNodeWidth: 600,
        imagePortCenterY: 195,
      },
    };
    let idIndex = 0;

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: frameNode.id,
      frameCount: 4,
      links: [],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: new Map(),
      nodes: [batchNode, frameNode],
      runId: "four-frame-run",
    });

    const resultNode = result.nodes.find(
      (node) => node.data?.batchReplacementRunId === "four-frame-run"
    );
    expect(resultNode?.data?.imageUrls).toEqual([
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
    ]);
    expect(resultNode?.data).toMatchObject({
      batchReplacementResultCount: 4,
      frameGridColumns: 2,
      frameGridRows: 2,
      imageDisplayHeight: 360,
      imageDisplayWidth: 600,
      imageNodeHeight: 390,
      imageNodeWidth: 600,
      imagePortCenterY: 195,
    });
  });

  it("clears loading placeholders when a successful batch replacement returns no result items", () => {
    const batchNode = makeVideoBatchReplacementNode();
    const frameNode: GraphNode = {
      id: "frame-empty-success",
      type: "image_node",
      title: "frame analysis",
      x: 300,
      y: 120,
      inputs: [{ name: "source_video", type: "VIDEO" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        isFrameStrip: true,
        frameGridColumns: 2,
        frameGridRows: 1,
        frameTileHeight: 180,
        frameTileWidth: 300,
        imageDisplayHeight: 180,
        imageDisplayWidth: 600,
        imageNodeHeight: 210,
        imageNodeWidth: 600,
        imagePortCenterY: 105,
      },
    };
    let idIndex = 0;

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: frameNode.id,
      frameCount: 2,
      links: [],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: new Map(),
      nodes: [batchNode, frameNode],
      result: { status: "success", items: [], error: "", rawStatus: "success" },
      runId: "empty-success-run",
    });

    const resultNode = result.nodes.find(
      (node) => node.data?.batchReplacementRunId === "empty-success-run"
    );
    expect(resultNode?.data).toMatchObject({
      imageUrls: [],
      loading: false,
      loadingOperation: undefined,
      status: "success",
    });
    expect(result.nodeOutputs.has(resultNode?.id ?? "")).toBe(false);
  });

  it("normalizes stale one-column frame metadata into one horizontal result row for three visible frames", () => {
    const batchNode = makeVideoBatchReplacementNode();
    const frameNode: GraphNode = {
      id: "frame-stale",
      type: "image_node",
      title: "逐帧分析 1",
      x: 300,
      y: 120,
      inputs: [{ name: "source_video", type: "VIDEO" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        isFrameStrip: true,
        imageUrls: [
          "https://example.com/frame-1.png",
          "https://example.com/frame-2.png",
          "https://example.com/frame-3.png",
        ],
        frameGridColumns: 1,
        frameGridRows: 3,
        frameTileHeight: 391,
        frameTileWidth: 220,
        imageDisplayHeight: 1173,
        imageDisplayWidth: 220,
        imageNodeHeight: 1203,
        imageNodeWidth: 220,
        imagePortCenterY: 602,
      },
    };
    let idIndex = 0;

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: frameNode.id,
      frameCount: 3,
      links: [],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: new Map(),
      nodes: [batchNode, frameNode],
      runId: "stale-three-frame-run",
    });

    const resultNode = result.nodes.find(
      (node) => node.data?.batchReplacementRunId === "stale-three-frame-run"
    );
    expect(resultNode?.data?.imageUrls).toEqual([
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
    ]);
    expect(resultNode?.data).toMatchObject({
      batchReplacementResultCount: 3,
      frameGridColumns: 3,
      frameGridRows: 1,
      frameTileHeight: 391,
      frameTileWidth: 220,
      imageDisplayHeight: 391,
      imageDisplayWidth: 660,
      imageNodeHeight: 421,
      imageNodeWidth: 660,
    });
  });

  it("keeps each grouped source image at full width in batch replacement result placeholders", () => {
    const batchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      data: {
        ...makeVideoBatchReplacementNode().data,
        groupBatchReplacementSourceNodeIds: ["group-image-1", "group-image-2"],
        groupBatchReplacementSourceOssIds: ["oss-1", "oss-2"],
      },
    };
    const firstGroupImage: GraphNode = {
      id: "group-image-1",
      type: "image_node",
      title: "图片 1",
      x: 300,
      y: 120,
      inputs: [],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        imageDisplayHeight: 391,
        imageDisplayWidth: 220,
        imageNodeHeight: 421,
        imageNodeWidth: 220,
        imagePortCenterY: 210,
      },
    };
    let idIndex = 0;

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: firstGroupImage.id,
      frameCount: 2,
      links: [],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: new Map(),
      nodes: [batchNode, firstGroupImage],
      runId: "group-two-image-run",
    });

    const resultNode = result.nodes.find(
      (node) => node.data?.batchReplacementRunId === "group-two-image-run"
    );
    expect(resultNode?.data).toMatchObject({
      batchReplacementResultCount: 2,
      frameGridColumns: 2,
      frameGridRows: 1,
      frameTileHeight: 391,
      frameTileWidth: 220,
      imageDisplayHeight: 391,
      imageDisplayWidth: 440,
      imageNodeHeight: 421,
      imageNodeWidth: 440,
    });
  });

  it("keeps group batch replacement result nodes inside the source group and expands the group", () => {
    const batchNode: GraphNode = {
      ...makeVideoBatchReplacementNode(),
      x: 640,
      y: 120,
      groupId: "group-1",
      data: {
        ...makeVideoBatchReplacementNode().data,
        groupBatchReplacementSourceNodeIds: ["group-image-1", "group-image-2"],
        groupBatchReplacementSourceOssIds: ["oss-1", "oss-2"],
      },
    };
    const firstGroupImage: GraphNode = {
      id: "group-image-1",
      type: "image_node",
      title: "图片 1",
      x: 120,
      y: 120,
      groupId: "group-1",
      inputs: [],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        imageDisplayHeight: 391,
        imageDisplayWidth: 220,
        imageNodeHeight: 421,
        imageNodeWidth: 220,
        imagePortCenterY: 210,
      },
    };
    let idIndex = 0;

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: firstGroupImage.id,
      frameCount: 2,
      groups: [{ id: "group-1", title: "分组1", x: 76, y: 76, width: 1388, height: 520 }],
      links: [],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: new Map(),
      nodes: [firstGroupImage, batchNode],
      runId: "group-result-run",
    });

    const resultNode = result.nodes.find(
      (node) => node.data?.batchReplacementRunId === "group-result-run"
    );
    expect(resultNode?.groupId).toBe("group-1");
    expect(result.groups.find((group) => group.id === "group-1")?.width).toBeGreaterThan(1388);
    expect(result.groups.find((group) => group.id === "group-1")?.x).toBe(76);
  });

  it("keeps previous batch replacement results and appends the new loading grid below", () => {
    const batchNode = makeVideoBatchReplacementNode();
    const frameNode: GraphNode = {
      id: "frame-1",
      type: "image_node",
      title: "frame analysis",
      x: 300,
      y: 120,
      inputs: [{ name: "source_video", type: "VIDEO" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        isFrameStrip: true,
        frameGridColumns: 3,
        frameGridRows: 1,
        frameTileHeight: 180,
        frameTileWidth: 300,
        imageDisplayHeight: 180,
        imageDisplayWidth: 900,
        imageNodeHeight: 210,
        imageNodeWidth: 900,
        imagePortCenterY: 105,
      },
    };
    const staleResultNode: GraphNode = {
      id: "stale-result",
      type: "image_node",
      title: "batch result 1",
      x: 900,
      y: 120,
      inputs: [{ name: "input", type: "IMAGE" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {
        batchReplacementRunId: "old-run",
        batchReplacementSourceNodeId: batchNode.id,
        batchReplacementResultCount: 3,
        imageDisplayHeight: 391,
        imageDisplayWidth: 220,
        imageNodeHeight: 421,
        imageNodeWidth: 220,
        imageUrls: [],
        loading: true,
        loadingOperation: "batch-replacement",
      },
    };
    let idIndex = 0;
    const oldOutputs = new Map<string, Map<number, unknown>>([
      ["stale-result", new Map([[0, "old-placeholder"]])],
    ]);

    const result = createBatchEditImagesResultRunSnapshot({
      batchNodeId: batchNode.id,
      frameAnalysisNodeId: frameNode.id,
      frameCount: 3,
      links: [
        {
          id: "old-link",
          fromNodeId: batchNode.id,
          fromOutputIndex: 0,
          toNodeId: staleResultNode.id,
          toInputIndex: 0,
        },
      ],
      makeId: (prefix) => `${prefix}-${(idIndex += 1)}`,
      nodeOutputs: oldOutputs,
      nodes: [batchNode, frameNode, staleResultNode],
      runId: "new-run",
    });

    expect(result.nodes.some((node) => node.id === "stale-result")).toBe(true);
    expect(result.links.some((link) => link.id === "old-link")).toBe(true);
    expect(result.nodeOutputs.has("stale-result")).toBe(true);

    const resultNodes = result.nodes.filter(
      (node) => node.data?.batchReplacementSourceNodeId === batchNode.id
    );
    expect(resultNodes).toHaveLength(2);
    const newResultNode = resultNodes.find(
      (node) => node.data?.batchReplacementRunId === "new-run"
    );
    expect(newResultNode?.title).toMatch(/2$/);
    expect(newResultNode?.y).toBeGreaterThan(staleResultNode.y);
    expect(newResultNode?.data?.imageUrls).toEqual([
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
      "__batch_replacement_frame_placeholder__",
    ]);
    expect(newResultNode?.data).toMatchObject({
      frameGridColumns: 3,
      frameGridRows: 1,
      imageDisplayHeight: 180,
      imageDisplayWidth: 900,
      imageNodeHeight: 210,
      imageNodeWidth: 900,
    });
  });
});

describe("collectLinkedMediaReferences", () => {
  it("collects current valid images from linked batch replacement nodes", () => {
    const target = { ...makeTextNode("target"), type: "image_node" as const };
    const batchNode = makeVideoBatchReplacementNode();

    const references = collectLinkedMediaReferences({
      nodeId: target.id,
      links: [
        {
          id: "l-batch",
          fromNodeId: batchNode.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 0,
        },
      ],
      nodes: [target, batchNode],
      nodeOutputs: new Map(),
    });

    expect(references.imageUrls).toEqual([
      "https://example.com/front.png",
      "https://example.com/side.png",
    ]);
  });

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
        imageUrls: ["https://example.com/frame-1.png", "https://example.com/frame-2.png"],
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
      nodeOutputs: new Map([[frameGrid.id, new Map([[0, frameGrid.data?.imageUrls]])]]),
    });

    expect(references.imageUrls).toEqual([
      "https://example.com/frame-1.png",
      "https://example.com/frame-2.png",
    ]);
    expect(references.ossIds).toEqual(["oss-frame-1", "oss-frame-2"]);
  });

  it("excludes hidden frame-grid oss ids when a thumbnail reference is removed", () => {
    const target = { ...makeTextNode("target"), type: "image_node" as const };
    const frameUrls = [
      "https://example.com/frame-1.png",
      "https://example.com/frame-2.png",
      "https://example.com/frame-3.png",
    ];
    const frameGrid: GraphNode = {
      ...makeTextNode("frame-grid"),
      type: "image_node",
      data: {
        imageUrls: frameUrls,
        frameImageOssIds: ["oss-frame-1", "oss-frame-2", "oss-frame-3"],
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
          excludedInputValues: [frameUrls[1]],
        },
      ],
      nodes: [target, frameGrid],
      nodeOutputs: new Map([[frameGrid.id, new Map([[0, frameUrls]])]]),
    });

    expect(references.imageUrls).toEqual([frameUrls[0], frameUrls[2]]);
    expect(references.ossIds).toEqual(["oss-frame-1", "oss-frame-3"]);
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
