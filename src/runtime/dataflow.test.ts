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
});
