import { describe, expect, it } from "vitest";
import { resolveInlineProjectRename } from "./inlineProjectRename";

describe("resolveInlineProjectRename", () => {
  it("persists when the trimmed name changed", () => {
    expect(resolveInlineProjectRename("  新项目名称  ", "旧项目名称")).toEqual({
      nextName: "新项目名称",
      shouldPersist: true,
    });
  });

  it("does not persist when the trimmed name is unchanged", () => {
    expect(resolveInlineProjectRename("  旧项目名称 ", "旧项目名称")).toEqual({
      nextName: "旧项目名称",
      shouldPersist: false,
    });
  });

  it("falls back to the current name when the draft is empty", () => {
    expect(resolveInlineProjectRename("   ", "旧项目名称")).toEqual({
      nextName: "旧项目名称",
      shouldPersist: false,
    });
  });
});
