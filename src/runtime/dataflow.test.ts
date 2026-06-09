import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import { resolveNodeInputs } from "./dataflow";

function makeTextNode(id: string, text: string, inputs: GraphNode["inputs"] = []): GraphNode {
  return {
    id,
    type: "text_node",
    title: id,
    x: 0,
    y: 0,
    inputs,
    outputs: [{ name: "text", type: "STRING" }],
    properties: { text, textMode: "plain" },
    data: {},
  };
}

function makeImageNode(id: string, imageUrl: string): GraphNode {
  return {
    id,
    type: "image_node",
    title: id,
    x: 0,
    y: 0,
    inputs: [],
    outputs: [{ name: "image", type: "IMAGE" }],
    properties: { imageUrl },
    data: {},
  };
}

describe("resolveNodeInputs", () => {
  it("falls back to source text node properties when the source has not been executed", () => {
    const source = makeTextNode("source", "Cats, dogs, and pigs");
    const target = makeTextNode("target", "Summarize source", [
      { name: "system_prompt", type: "STRING" },
      { name: "user_prompt", type: "ANY" },
    ]);

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-1",
          fromNodeId: "source",
          fromOutputIndex: 0,
          toNodeId: "target",
          toInputIndex: 1,
        },
      ],
      new Map(),
      [source, target]
    );

    expect(inputs.user_prompt).toBe("Cats, dogs, and pigs");
  });

  it("treats legacy text-node input port zero as the user prompt", () => {
    const source = makeTextNode("source", "Legacy linked source");
    const target = makeTextNode("target", "", [
      { name: "system_prompt", type: "STRING" },
      { name: "user_prompt", type: "ANY" },
    ]);

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-legacy",
          fromNodeId: "source",
          fromOutputIndex: 0,
          toNodeId: "target",
          toInputIndex: 0,
        },
      ],
      new Map(),
      [source, target]
    );

    expect(inputs).toEqual({ user_prompt: "Legacy linked source" });
  });

  it("collects multiple links into the same input as an ordered array", () => {
    const imageA = makeImageNode("image-a", "https://oss.example.com/a.png");
    const imageB = makeImageNode("image-b", "https://oss.example.com/b.png");
    const target: GraphNode = {
      id: "video",
      type: "video_node",
      title: "video",
      x: 0,
      y: 0,
      inputs: [{ name: "image", type: "IMAGE" }],
      outputs: [{ name: "video", type: "VIDEO" }],
      properties: {},
      data: {},
    };

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-a",
          fromNodeId: "image-a",
          fromOutputIndex: 0,
          toNodeId: "video",
          toInputIndex: 0,
        },
        {
          id: "link-b",
          fromNodeId: "image-b",
          fromOutputIndex: 0,
          toNodeId: "video",
          toInputIndex: 0,
        },
      ],
      new Map(),
      [imageA, imageB, target]
    );

    expect(inputs.image).toEqual([
      "https://oss.example.com/a.png",
      "https://oss.example.com/b.png",
    ]);
  });
});
