import { describe, expect, it } from "vitest";
import {
  hasCanvasPointerDragExceededClickThreshold,
  shouldFinishCanvasLinkOnCanvasPointerUp,
} from "./canvasPointerPolicy";

describe("shouldFinishCanvasLinkOnCanvasPointerUp", () => {
  it("keeps active link drafts alive for final port hit testing", () => {
    expect(shouldFinishCanvasLinkOnCanvasPointerUp(true)).toBe(false);
  });

  it("does not affect normal canvas pointer up handling", () => {
    expect(shouldFinishCanvasLinkOnCanvasPointerUp(false)).toBe(false);
  });
});

describe("hasCanvasPointerDragExceededClickThreshold", () => {
  it("allows tiny pointer jitter to remain a click", () => {
    expect(
      hasCanvasPointerDragExceededClickThreshold({
        startX: 100,
        startY: 100,
        endX: 102,
        endY: 101,
      })
    ).toBe(false);
  });

  it("treats node movement past the threshold as a drag instead of a click", () => {
    expect(
      hasCanvasPointerDragExceededClickThreshold({
        startX: 100,
        startY: 100,
        endX: 108,
        endY: 100,
      })
    ).toBe(true);
  });
});
