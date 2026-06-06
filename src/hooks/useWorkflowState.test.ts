import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IMAGE_PROMPT_PLACEHOLDER_URL, isRemoteWorkflowEcho, serializeRemotePersistSnapshot } from "./useWorkflowState";
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

    const decoded = decodeURIComponent(IMAGE_PROMPT_PLACEHOLDER_URL.replace("data:image/svg+xml,", ""));
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
