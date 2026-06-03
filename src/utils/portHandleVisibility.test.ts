import { describe, expect, it } from "vitest";
import { shouldShowInlinePortHandles } from "./portHandleVisibility";

describe("shouldShowInlinePortHandles", () => {
  it("shows handles while canvas linking is active so target ports can be hit-tested", () => {
    expect(shouldShowInlinePortHandles({ isHovered: false, isLinkingOnCanvas: true, selected: false })).toBe(true);
  });

  it("keeps existing hover and selected behavior", () => {
    expect(shouldShowInlinePortHandles({ isHovered: true, isLinkingOnCanvas: false, selected: false })).toBe(true);
    expect(shouldShowInlinePortHandles({ isHovered: false, isLinkingOnCanvas: false, selected: true })).toBe(true);
    expect(shouldShowInlinePortHandles({ isHovered: false, isLinkingOnCanvas: false, selected: false })).toBe(false);
  });
});
