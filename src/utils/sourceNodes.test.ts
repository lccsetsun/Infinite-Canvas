import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import {
  duplicateNodeAsSource,
  isSourceNode,
  markNodeAsSource,
  normalizeSourceNode,
} from "./sourceNodes";
import { getLinkDraftIssueDetail } from "./linking";

function makeNode(overrides: Partial<GraphNode> & Pick<GraphNode, "id" | "type">): GraphNode {
  return {
    id: overrides.id,
    type: overrides.type,
    title: overrides.title ?? overrides.id,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    inputs: overrides.inputs ?? [{ name: "prompt", type: "STRING" }],
    outputs: overrides.outputs ?? [{ name: "out", type: "STRING" }],
    properties: overrides.properties ?? {},
    data: overrides.data,
  };
}

describe("source node semantics", () => {
  it("marks uploaded media nodes as source nodes without inputs", () => {
    const node = makeNode({
      id: "image-1",
      type: "image_node",
      outputs: [{ name: "image", type: "IMAGE" }],
    });

    const source = markNodeAsSource(node, { imageUrl: "https://oss.example.com/a.png" });

    expect(source.inputs).toEqual([]);
    expect(source.properties.isSourceNode).toBe(true);
    expect(source.data?.isSourceNode).toBe(true);
    expect(source.properties.imageUrl).toBe("https://oss.example.com/a.png");
    expect(source.data?.imageUrl).toBe("https://oss.example.com/a.png");
    expect(isSourceNode(source)).toBe(true);
  });

  it("keeps persisted source nodes inputless during normalization", () => {
    const source = makeNode({
      id: "video-source",
      type: "video_node",
      inputs: [{ name: "prompt", type: "STRING" }],
      properties: { isSourceNode: true, videoUrl: "https://oss.example.com/v.mp4" },
    });

    expect(normalizeSourceNode(source).inputs).toEqual([]);
  });

  it("duplicates text and media nodes as source nodes", () => {
    const source = makeNode({
      id: "text-1",
      type: "text_node",
      inputs: [{ name: "user_prompt", type: "ANY" }],
      properties: { text: "source text" },
    });

    const clone = duplicateNodeAsSource(source, "text-2", "文本节点 2");

    expect(clone.id).toBe("text-2");
    expect(clone.inputs).toEqual([]);
    expect(clone.properties.isSourceNode).toBe(true);
    expect(clone.properties.textMode).toBe("plain");
  });

  it("does not allow links into source nodes even if legacy data still has inputs", () => {
    const from = makeNode({
      id: "from",
      type: "text_node",
      inputs: [],
      outputs: [{ name: "text", type: "STRING" }],
    });
    const to = makeNode({
      id: "to",
      type: "text_node",
      inputs: [{ name: "user_prompt", type: "ANY" }],
      properties: { isSourceNode: true, textMode: "plain" },
    });

    expect(
      getLinkDraftIssueDetail({
        fromNodeId: "from",
        toNodeId: "to",
        fromOutputIndex: 0,
        toInputIndex: 0,
        nodes: [from, to],
        links: [],
      })?.code
    ).toBe("SOURCE_NODE_TARGET");
  });
});
