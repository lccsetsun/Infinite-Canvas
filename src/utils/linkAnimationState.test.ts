import { describe, expect, it } from "vitest";
import { isLinkConnectedToNode } from "./linkAnimationState";

describe("link animation state", () => {
  it("keeps ordinary connected links static when no node is active", () => {
    expect(isLinkConnectedToNode({ fromNodeId: "a", toNodeId: "b" }, null)).toBe(false);
  });

  it("animates both input and output links for the active node", () => {
    expect(isLinkConnectedToNode({ fromNodeId: "a", toNodeId: "b" }, "a")).toBe(true);
    expect(isLinkConnectedToNode({ fromNodeId: "a", toNodeId: "b" }, "b")).toBe(true);
  });
});
