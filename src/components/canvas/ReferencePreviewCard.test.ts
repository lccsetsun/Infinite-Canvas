import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getReferencePreviewCardIconFrameClassName,
  getReferencePreviewCardLayout,
} from "./ReferencePreviewCard";

describe("ReferencePreviewCard", () => {
  it("uses the same compact square layout for text and image references", () => {
    expect(getReferencePreviewCardLayout("image").containerClassName).toContain("h-14 w-14");
    expect(getReferencePreviewCardLayout("text").containerClassName).toContain("h-14 w-14");
  });

  it("does not use expanded text-card sizing for non-image references", () => {
    expect(getReferencePreviewCardLayout("text").containerClassName).not.toContain("min-w");
    expect(getReferencePreviewCardLayout("video").containerClassName).not.toContain("min-w");
    expect(getReferencePreviewCardLayout("audio").containerClassName).not.toContain("min-w");
  });

  it("does not draw a second inner frame for icon-only references", () => {
    expect(getReferencePreviewCardIconFrameClassName("text")).not.toContain("border");
    expect(getReferencePreviewCardIconFrameClassName("video")).not.toContain("border");
    expect(getReferencePreviewCardIconFrameClassName("audio")).not.toContain("border");
    expect(getReferencePreviewCardIconFrameClassName("text")).not.toContain("bg-white");
  });

  it("shows typed hover previews and swaps the index badge to a close icon on hover", () => {
    const source = readFileSync(new URL("./ReferencePreviewCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("group/reference");
    expect(source).toContain("cursor-pointer");
    expect(source).toContain("group-hover/reference:block");
    expect(source).toContain("reference preview");
    expect(source).toContain("<video");
    expect(source).toContain("autoPlay");
    expect(source).toContain("loop");
    expect(source).toContain('reference.kind === "text"');
    expect(source).toContain("hidden h-[210px] w-[360px]");
    expect(source).toContain("max-w-none");
    expect(source).toContain("group-hover/reference:hidden");
    expect(source).toContain("hidden group-hover/reference:block");
  });
});
