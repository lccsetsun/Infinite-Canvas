import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import { applyNodePositionUpdates } from "./nodePositionUpdates";

function node(id: string, x: number, y: number): GraphNode {
  return {
    id,
    inputs: [],
    outputs: [],
    properties: {},
    title: id,
    type: "text_node",
    x,
    y,
  };
}

describe("applyNodePositionUpdates", () => {
  it("updates multiple node positions in one pass", () => {
    const a = node("a", 0, 0);
    const b = node("b", 20, 30);
    const c = node("c", 80, 90);

    const result = applyNodePositionUpdates([a, b, c], [
      { nodeId: "a", x: 12, y: 24 },
      { nodeId: "c", x: 120, y: 144 },
    ]);

    expect(result).toEqual([
      { ...a, x: 12, y: 24 },
      b,
      { ...c, x: 120, y: 144 },
    ]);
    expect(result[1]).toBe(b);
  });

  it("returns the original array when no positions change", () => {
    const nodes = [node("a", 12, 24), node("b", 48, 96)];

    const result = applyNodePositionUpdates(nodes, [
      { nodeId: "a", x: 12, y: 24 },
      { nodeId: "missing", x: 1, y: 2 },
    ]);

    expect(result).toBe(nodes);
  });
});
