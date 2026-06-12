import { describe, expect, it } from "vitest";
import {
  clearCanvasSelection,
  getLegacySelectionState,
  selectCanvasGroup,
  selectCanvasLink,
  selectCanvasNode,
  selectCanvasNodes,
  toggleCanvasNodeSelection,
} from "./canvasSelection";

describe("canvasSelection", () => {
  it("represents single node selection as one active node id", () => {
    expect(getLegacySelectionState(selectCanvasNode("node-a"))).toEqual({
      selectedGroupId: null,
      selectedLinkAnchor: null,
      selectedLinkId: null,
      selectedNodeId: "node-a",
      selectedNodeIds: ["node-a"],
    });
  });

  it("represents multi-node selection without activating an individual node", () => {
    expect(getLegacySelectionState(selectCanvasNodes(["node-a", "node-b"]))).toEqual({
      selectedGroupId: null,
      selectedLinkAnchor: null,
      selectedLinkId: null,
      selectedNodeId: null,
      selectedNodeIds: ["node-a", "node-b"],
    });
  });

  it("collapses a one-item node list to single node mode", () => {
    expect(selectCanvasNodes(["node-a"])).toEqual({ mode: "node", nodeId: "node-a" });
  });

  it("keeps group and link selections mutually exclusive with nodes", () => {
    expect(getLegacySelectionState(selectCanvasGroup("group-a")).selectedNodeIds).toEqual([]);
    expect(
      getLegacySelectionState(selectCanvasLink("link-a", { x: 10, y: 20 }))
    ).toMatchObject({
      selectedGroupId: null,
      selectedLinkAnchor: { x: 10, y: 20 },
      selectedLinkId: "link-a",
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  });

  it("toggles shift selection into and out of multi-node mode", () => {
    const first = toggleCanvasNodeSelection(clearCanvasSelection(), "node-a");
    const second = toggleCanvasNodeSelection(first, "node-b");
    const third = toggleCanvasNodeSelection(second, "node-a");

    expect(first).toEqual({ mode: "node", nodeId: "node-a" });
    expect(second).toEqual({ mode: "nodes", nodeIds: ["node-a", "node-b"] });
    expect(third).toEqual({ mode: "node", nodeId: "node-b" });
  });
});
