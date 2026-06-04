import { describe, expect, it } from "vitest";
import { GraphLink, GraphNode } from "../types";
import { resolveAutoConnectTarget } from "./autoConnectTarget";

function mockNode(partial: Partial<GraphNode> & Pick<GraphNode, "id" | "title" | "type">): GraphNode {
  return {
    id: partial.id,
    title: partial.title,
    type: partial.type,
    x: 0,
    y: 0,
    inputs: partial.inputs ?? [],
    outputs: partial.outputs ?? [],
    properties: partial.properties ?? {},
    data: {},
  };
}

describe("resolveAutoConnectTarget", () => {
  const text = mockNode({
    id: "text",
    title: "Text",
    type: "text_node",
    outputs: [{ name: "文本", type: "STRING" }],
  });
  const image = mockNode({
    id: "image",
    title: "Image",
    type: "image_node",
    inputs: [
      { name: "source_image", type: "IMAGE" },
      { name: "prompt", type: "STRING" },
    ],
  });
  const links: GraphLink[] = [];

  it("picks a compatible input when dragging over any part of a node", () => {
    expect(
      resolveAutoConnectTarget({
        candidateNodeId: "image",
        fromNodeId: "text",
        fromOutputIndex: 0,
        links,
        nodes: [text, image],
      })
    ).toEqual({ nodeId: "image", inputIndex: 1 });
  });

  it("rejects same-node auto connections", () => {
    expect(
      resolveAutoConnectTarget({
        candidateNodeId: "text",
        fromNodeId: "text",
        fromOutputIndex: 0,
        links,
        nodes: [text, image],
      })
    ).toBeNull();
  });
});
