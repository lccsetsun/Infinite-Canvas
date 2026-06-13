import { describe, expect, it } from "vitest";
import { getPointerAlignedNodePosition } from "./dropAlignedNodePosition";

describe("getPointerAlignedNodePosition", () => {
  it("uses the pointer world point as the generated node top-left", () => {
    expect(getPointerAlignedNodePosition({ x: 420.5, y: -18.25 })).toEqual({
      x: 420.5,
      y: -18.25,
    });
  });
});
