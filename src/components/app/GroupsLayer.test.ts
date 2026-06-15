import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GroupsLayer source", () => {
  it("renders group labels, fixed color picker, raised dragging layer, and selected controls", () => {
    const source = readFileSync(new URL("./GroupsLayer.tsx", import.meta.url), "utf8");

    expect(source).toContain("{group.title}");
    expect(source).toContain("{memberCount}");
    expect(source).toContain("absolute -top-12 left-0");
    expect(source).toContain("cursor-grab active:cursor-grabbing pointer-events-auto");
    expect(source).not.toContain("bg-[#0d1117]");
    expect(source).toContain("GROUP_COLOR_SWATCHES");
    expect(source).toContain("onChangeGroupColor?.(group.id");
    expect(source).toContain("w-[276px]");
    expect(source).toContain('drag || resize || isGroupDragging ? "z-[44]" : "z-[24]"');
    expect(source).toContain("MIN_GROUP_WIDTH");
    expect(source).toContain("MIN_GROUP_HEIGHT");
    expect(source).toContain("getResizedGroupRect");
    expect(source).toContain('(["nw", "ne", "sw", "se"] as const)');
    expect(source).toContain("onResizeGroup?.(resize.groupId");
    expect(source).toContain("cursor-nwse-resize");
    expect(source).toContain("cursor-nesw-resize");
    expect(source).toContain("h-2.5 w-2.5 rounded-[2px] bg-slate-100/90");
    expect(source).not.toContain("Maximize2");
    expect(source).toContain("mediaNodeFloatingToolbarClass");
    expect(source).toContain("mediaNodeToolbarDividerClass");
    expect(source).toContain("onUngroup?.(group.id)");
    expect(source).not.toContain("border-dashed");
    expect(source).not.toContain("strokeDasharray");
  });
});
