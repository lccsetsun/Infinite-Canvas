import { describe, expect, it } from "vitest";
import { GraphLink, GraphNode } from "../types";
import { resolveAutoConnectTarget } from "./autoConnectTarget";
import { createNodeFromType } from "../features/nodes/nodeFactory";

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

  it("auto-connects any upstream node into a text node user prompt input", () => {
    const imageSource = mockNode({
      id: "imageSource",
      title: "图片节点",
      type: "image_node",
      outputs: [{ name: "图片", type: "IMAGE" }],
    });
    const textNode = createNodeFromType("text_node", "textTarget", 0, 0);

    expect(
      resolveAutoConnectTarget({
        candidateNodeId: "textTarget",
        fromNodeId: "imageSource",
        fromOutputIndex: 0,
        links,
        nodes: [imageSource, textNode],
      })
    ).toEqual({ nodeId: "textTarget", inputIndex: 1 });
  });
});
