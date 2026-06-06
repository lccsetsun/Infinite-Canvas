import { describe, expect, it } from "vitest";
import { resolveProjectEdit } from "./resolveProjectEdit";

describe("resolveProjectEdit", () => {
  it("falls back to the current name when the draft name is blank", () => {
    expect(resolveProjectEdit("   ", "  https://example.com/cover.png  ", "Current Name", "")).toEqual({
      nextName: "Current Name",
      nextCoverUrl: "https://example.com/cover.png",
      shouldRename: false,
      shouldUpdateCover: true,
    });
  });

  it("detects both name and cover changes after trimming", () => {
    expect(
      resolveProjectEdit("  Updated Name  ", " https://example.com/next.png ", "Current Name", "https://example.com/old.png")
    ).toEqual({
      nextName: "Updated Name",
      nextCoverUrl: "https://example.com/next.png",
      shouldRename: true,
      shouldUpdateCover: true,
    });
  });

  it("keeps the project untouched when neither field changes", () => {
    expect(
      resolveProjectEdit("Current Name", "https://example.com/cover.png", "Current Name", "https://example.com/cover.png")
    ).toEqual({
      nextName: "Current Name",
      nextCoverUrl: "https://example.com/cover.png",
      shouldRename: false,
      shouldUpdateCover: false,
    });
  });
});
