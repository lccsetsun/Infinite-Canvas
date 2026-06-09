import { describe, expect, it } from "vitest";
import {
  getReferencePreviewCardIconFrameClassName,
  getReferencePreviewCardLayout,
} from "./ReferencePreviewCard";

describe("getReferencePreviewCardLayout", () => {
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
});
