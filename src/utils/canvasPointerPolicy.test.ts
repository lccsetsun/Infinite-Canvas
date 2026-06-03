import { describe, expect, it } from "vitest";
import { shouldFinishCanvasLinkOnCanvasPointerUp } from "./canvasPointerPolicy";

describe("shouldFinishCanvasLinkOnCanvasPointerUp", () => {
  it("keeps active link drafts alive for final port hit testing", () => {
    expect(shouldFinishCanvasLinkOnCanvasPointerUp(true)).toBe(false);
  });

  it("does not affect normal canvas pointer up handling", () => {
    expect(shouldFinishCanvasLinkOnCanvasPointerUp(false)).toBe(false);
  });
});
