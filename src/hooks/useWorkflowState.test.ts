import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IMAGE_PROMPT_PLACEHOLDER_URL,
  createTextNodeStarterFlowSnapshot,
  markUploadedAssetNodeAsSource,
  addNodeToWorkflowSnapshot,
  updateNodePropertySnapshot,
  isRemoteWorkflowEcho,
  serializeRemotePersistSnapshot,
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
});

describe("serializeRemotePersistSnapshot", () => {
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
    expect(result?.nodes.find((node) => node.id === "text-1")?.properties.system_prompt).toContain(
      "视频生成"
    );
    expect(result?.nodes.find((node) => node.id === "text-1")?.properties.text).toBeUndefined();
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

    expect(result?.nodes.find((node) => node.id === "text-1")?.properties.text).toBe("已有提示词");
    expect(result?.nodes.find((node) => node.id === "node-new")?.type).toBe("audio_node");
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
