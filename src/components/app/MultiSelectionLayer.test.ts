import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MultiSelectionLayer source", () => {
  it("shows a centered toolbar-style create group action above multi-selection bounds", () => {
    const source = readFileSync(new URL("./MultiSelectionLayer.tsx", import.meta.url), "utf8");

    expect(source).toContain("canCreateGroup");
    expect(source).toContain("onCreateGroup");
    expect(source).toContain("mediaNodeFloatingToolbarClass");
    expect(source).toContain("mediaNodeToolbarButtonClass");
    expect(source).toContain("打组");
    expect(source).not.toContain("absolute left-0 top-0 flex h-8");
    expect(source).not.toContain("批量拖拽连线");
  });
});
