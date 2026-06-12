import { describe, expect, it } from "vitest";
import type { GraphLink, GraphNode } from "../types";
import {
  buildCanvasGraphIndex,
  getGraphLinkKey,
  hasGraphLink,
} from "./canvasGraphIndex";

function node(id: string): GraphNode {
  return {
    id,
    inputs: [],
    outputs: [],
    properties: {},
    title: id,
    type: "text_node",
    x: 0,
    y: 0,
  };
}

const links: GraphLink[] = [
  { id: "l1", fromNodeId: "a", fromOutputIndex: 0, toNodeId: "b", toInputIndex: 0 },
  { id: "l2", fromNodeId: "a", fromOutputIndex: 0, toNodeId: "c", toInputIndex: 1 },
  { id: "l3", fromNodeId: "b", fromOutputIndex: 1, toNodeId: "c", toInputIndex: 0 },
];

describe("canvasGraphIndex", () => {
  it("indexes nodes and links by common lookup keys", () => {
    const index = buildCanvasGraphIndex([node("a"), node("b"), node("c")], links);

    expect(index.nodeById.get("b")?.id).toBe("b");
    expect(index.linksBySourceNodeId.get("a")?.map((link) => link.id)).toEqual(["l1", "l2"]);
    expect(index.linksByTargetNodeId.get("c")?.map((link) => link.id)).toEqual(["l2", "l3"]);
    expect(index.linkKeySet.has(getGraphLinkKey(links[0]))).toBe(true);
  });

  it("checks duplicate link existence without scanning links", () => {
    const index = buildCanvasGraphIndex([node("a"), node("b")], links);

    expect(
      hasGraphLink(index.linkKeySet, {
        fromNodeId: "a",
        fromOutputIndex: 0,
        toNodeId: "b",
        toInputIndex: 0,
      })
    ).toBe(true);
    expect(
      hasGraphLink(index.linkKeySet, {
        fromNodeId: "b",
        fromOutputIndex: 0,
        toNodeId: "a",
        toInputIndex: 0,
      })
    ).toBe(false);
  });
});
