import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App group dragging source", () => {
  it("starts group dragging from blank canvas hits without taking node drags", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).toContain("findTopGroupAtPoint(groups, world)");
    expect(source).toContain('target?.closest("[data-canvas-node-id]")');
    expect(source).toContain("applyCanvasSelection(selectCanvasGroup(group.id))");
    expect(source).toContain("setIsGroupDragging(true)");
    expect(source).toContain("setIsGroupDragging(false)");
    expect(source).toContain("setHoveredGroupId(group.id)");
    expect(source).toContain("updateHoveredGroupCursor(e)");
    expect(source).toContain('isGroupDragging ? "cursor-grabbing" : hoveredGroupId ? "cursor-grab" : ""');
    expect(source).toContain("isGroupDragging={isGroupDragging}");
    expect(source).toContain("onResizeGroup={resizeGroup}");
    expect(source).toContain("getMovedGroupMemberPositions({ dx, dy, nodeStarts: drag.nodeStarts })");
    expect(source).toContain("if (handleGroupPointerDown(e)) return;");
    expect(source).toContain("if (handleGroupPointerMove(e)) return;");
    expect(source).toContain("if (handleGroupPointerUp(e)) return;");
  });
});
