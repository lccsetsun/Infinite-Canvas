import { describe, expect, it } from "vitest";
import type { GraphNode, GroupBox } from "../types";
import {
  findTopGroupAtPoint,
  getGroupBoundsForNodes,
  getMovedGroupMemberPositions,
  getNextGroupTitle,
  expandGroupBoundsToIncludeNodes,
  syncNodeGroupMembership,
} from "./canvasGroups";

function makeNode(id: string, x: number, y: number, groupId?: string | null): GraphNode {
  return {
    id,
    type: "image_node",
    title: id,
    x,
    y,
    groupId,
    inputs: [],
    outputs: [],
    properties: {},
    data: { imageNodeWidth: 100, imageNodeHeight: 100 },
  };
}

function makeGroup(id: string, x: number, y: number, width: number, height: number): GroupBox {
  return { id, title: "分组1", x, y, width, height };
}

describe("canvas group helpers", () => {
  it("names new groups with the next numeric label", () => {
    expect(getNextGroupTitle([])).toBe("分组1");
    expect(getNextGroupTitle([makeGroup("group-1", 0, 0, 100, 100)])).toBe("分组2");
  });

  it("builds group bounds around selected nodes with padding", () => {
    expect(getGroupBoundsForNodes([makeNode("a", 10, 20), makeNode("b", 180, 120)], 20)).toEqual({
      x: -10,
      y: 0,
      width: 310,
      height: 240,
    });
  });

  it("extends an existing group to include newly created member nodes", () => {
    const group = makeGroup("group-1", 0, 0, 200, 180);
    const newNode = makeNode("result", 260, 40, "group-1");

    expect(expandGroupBoundsToIncludeNodes(group, [newNode], 20)).toEqual({
      ...group,
      width: 380,
    });
  });

  it("adds outside nodes to a group when their center enters the group box", () => {
    const nodes = [makeNode("a", 20, 20), makeNode("b", 250, 20)];
    const groups = [makeGroup("group-1", 0, 0, 160, 160)];

    expect(syncNodeGroupMembership(nodes, groups).map((node) => node.groupId ?? null)).toEqual([
      "group-1",
      null,
    ]);
  });

  it("removes grouped nodes when their center leaves the group box", () => {
    const nodes = [makeNode("a", 250, 20, "group-1")];
    const groups = [makeGroup("group-1", 0, 0, 160, 160)];

    expect(syncNodeGroupMembership(nodes, groups)[0].groupId).toBeNull();
  });

  it("finds the topmost group at a world point", () => {
    const lowerGroup = makeGroup("lower", 0, 0, 200, 200);
    const topGroup = makeGroup("top", 50, 50, 200, 200);

    expect(findTopGroupAtPoint([lowerGroup, topGroup], { x: 80, y: 80 })?.id).toBe("top");
    expect(findTopGroupAtPoint([lowerGroup, topGroup], { x: 240, y: 240 })?.id).toBe("top");
    expect(findTopGroupAtPoint([lowerGroup, topGroup], { x: 320, y: 320 })).toBeNull();
  });

  it("moves all group members from their drag-start positions", () => {
    expect(
      getMovedGroupMemberPositions({
        dx: 24,
        dy: -12,
        nodeStarts: [
          { nodeId: "a", x: 10, y: 20 },
          { nodeId: "b", x: 100, y: 120 },
        ],
      })
    ).toEqual([
      { nodeId: "a", x: 34, y: 8 },
      { nodeId: "b", x: 124, y: 108 },
    ]);
  });
});
