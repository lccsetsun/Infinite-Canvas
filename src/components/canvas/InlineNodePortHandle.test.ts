import { describe, expect, it } from "vitest";
import { getInlineNodePortHandleClassName } from "./InlineNodePortHandle";

describe("getInlineNodePortHandleClassName", () => {
  it("keeps input and output port identity classes separate", () => {
    expect(getInlineNodePortHandleClassName("input", false)).toContain("canvas-port-input");
    expect(getInlineNodePortHandleClassName("input", false)).not.toContain("canvas-port-output");

    expect(getInlineNodePortHandleClassName("output", false)).toContain("canvas-port-output");
    expect(getInlineNodePortHandleClassName("output", false)).not.toContain("canvas-port-input");
  });

  it("marks active ports with the matching visual state", () => {
    expect(getInlineNodePortHandleClassName("input", true)).toContain("canvas-port-hot");
    expect(getInlineNodePortHandleClassName("output", true)).toContain("canvas-port-active");
  });

  it("preserves caller classes for node-specific positioning tweaks", () => {
    expect(getInlineNodePortHandleClassName("output", false, "extra-class")).toContain(
      "extra-class"
    );
  });
});
