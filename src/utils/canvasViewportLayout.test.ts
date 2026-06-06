import { describe, expect, it } from "vitest";
import { getCanvasViewportClassName } from "./canvasViewportLayout";

describe("getCanvasViewportClassName", () => {
  it("keeps the canvas interaction layer full-screen under the floating header", () => {
    expect(getCanvasViewportClassName()).toContain("absolute");
    expect(getCanvasViewportClassName()).toContain("inset-0");
    expect(getCanvasViewportClassName()).not.toContain("h-[calc(100vh-4rem)]");
  });
});
