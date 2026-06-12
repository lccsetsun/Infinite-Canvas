import { describe, expect, it } from "vitest";
import type { GraphLink, GraphNode } from "../types";
import {
  createMultiNodeClipboardPayload,
  getMultiNodeLayoutUpdates,
  pasteMultiNodeClipboardPayload,
} from "./multiSelectionOperations";

function node(partial: Partial<GraphNode> & Pick<GraphNode, "id" | "x" | "y">): GraphNode {
  return {
    data: partial.data,
    id: partial.id,
    inputs: partial.inputs ?? [{ name: "in", type: "IMAGE" }],
    outputs: partial.outputs ?? [{ name: "out", type: "IMAGE" }],
    properties: partial.properties ?? {},
    title: partial.title ?? partial.id,
    type: partial.type ?? "image_node",
    x: partial.x,
    y: partial.y,
  };
}

function link(partial: Partial<GraphLink> & Pick<GraphLink, "id" | "fromNodeId" | "toNodeId">) {
  return {
    fromNodeId: partial.fromNodeId,
    fromOutputIndex: partial.fromOutputIndex ?? 0,
    id: partial.id,
    toInputIndex: partial.toInputIndex ?? 0,
    toNodeId: partial.toNodeId,
  };
}

describe("multi selection operations", () => {
  it("copies selected nodes and only their internal links", () => {
    const nodes = [
      node({ id: "a", x: 100, y: 100 }),
      node({ id: "b", x: 320, y: 140 }),
      node({ id: "c", x: 640, y: 140 }),
    ];
    const links = [
      link({ id: "internal", fromNodeId: "a", toNodeId: "b" }),
      link({ id: "incoming", fromNodeId: "c", toNodeId: "a" }),
      link({ id: "outgoing", fromNodeId: "b", toNodeId: "c" }),
    ];

    const payload = createMultiNodeClipboardPayload(nodes, links, ["a", "b"]);

    expect(payload.nodes.map((candidate) => candidate.id)).toEqual(["a", "b"]);
    expect(payload.links.map((candidate) => candidate.id)).toEqual(["internal"]);
  });

  it("pastes nodes with relative positions and remapped internal links", () => {
    const payload = createMultiNodeClipboardPayload(
      [node({ id: "a", x: 100, y: 100 }), node({ id: "b", x: 320, y: 140 })],
      [link({ id: "l1", fromNodeId: "a", toNodeId: "b" })],
      ["a", "b"]
    );

    const pasted = pasteMultiNodeClipboardPayload(payload, {
      anchor: { x: 500, y: 600 },
      idFactory: (() => {
        let nodeIndex = 0;
        return (prefix) => (prefix === "node" ? `node-${++nodeIndex}` : "link-copy");
      })(),
    });

    expect(pasted.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "node-1", x: 500, y: 600 },
      { id: "node-2", x: 720, y: 640 },
    ]);
    expect(pasted.links).toEqual([
      {
        fromNodeId: "node-1",
        fromOutputIndex: 0,
        id: "link-copy",
        toInputIndex: 0,
        toNodeId: "node-2",
      },
    ]);
  });

  it("renames pasted numbered text nodes after the existing canvas sequence", () => {
    const payload = createMultiNodeClipboardPayload(
      [
        node({ id: "a", title: "文本节点 1", type: "text_node", x: 100, y: 100 }),
        node({ id: "b", title: "文本节点 2", type: "text_node", x: 320, y: 140 }),
      ],
      [],
      ["a", "b"]
    );

    const pasted = pasteMultiNodeClipboardPayload(payload, {
      existingNodes: [
        node({ id: "existing-a", title: "文本节点 1", type: "text_node", x: 0, y: 0 }),
        node({ id: "existing-b", title: "文本节点 2", type: "text_node", x: 0, y: 0 }),
      ],
      idFactory: (() => {
        let nodeIndex = 0;
        return (prefix) => (prefix === "node" ? `node-${++nodeIndex}` : "link-copy");
      })(),
    });

    expect(pasted.nodes.map((candidate) => candidate.title)).toEqual(["文本节点 3", "文本节点 4"]);
  });

  it("aligns selected nodes by their visual bounds", () => {
    expect(
      getMultiNodeLayoutUpdates(
        [
          node({ id: "a", x: 100, y: 80, data: { imageNodeWidth: 120, imageNodeHeight: 80 } }),
          node({ id: "b", x: 300, y: 160, data: { imageNodeWidth: 80, imageNodeHeight: 160 } }),
        ],
        "align-right"
      )
    ).toEqual([
      { nodeId: "a", x: 260, y: 80 },
      { nodeId: "b", x: 300, y: 160 },
    ]);
  });

  it("keeps rendered bounds aligned when a node visual frame is offset from node coordinates", () => {
    const nodes = [
      node({ id: "a", x: 100, y: 80, data: { imageNodeWidth: 120, imageNodeHeight: 80 } }),
      node({ id: "b", x: 300, y: 160, data: { imageNodeWidth: 80, imageNodeHeight: 160 } }),
    ];
    const visualRects = new Map([
      ["a", { height: 80, width: 120, x: 112, y: 80 }],
      ["b", { height: 160, width: 80, x: 300, y: 160 }],
    ]);

    expect(getMultiNodeLayoutUpdates(nodes, "align-left", visualRects)).toEqual([
      { nodeId: "a", x: 100, y: 80 },
      { nodeId: "b", x: 112, y: 160 },
    ]);
  });

  it("distributes selected nodes across their current bounding range", () => {
    expect(
      getMultiNodeLayoutUpdates(
        [
          node({ id: "a", x: 100, y: 0, data: { imageNodeWidth: 100, imageNodeHeight: 80 } }),
          node({ id: "b", x: 260, y: 0, data: { imageNodeWidth: 100, imageNodeHeight: 80 } }),
          node({ id: "c", x: 500, y: 0, data: { imageNodeWidth: 100, imageNodeHeight: 80 } }),
        ],
        "distribute-horizontal"
      )
    ).toEqual([
      { nodeId: "a", x: 100, y: 0 },
      { nodeId: "b", x: 300, y: 0 },
      { nodeId: "c", x: 500, y: 0 },
    ]);
  });
});
