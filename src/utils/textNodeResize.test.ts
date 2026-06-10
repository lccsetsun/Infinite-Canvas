import { describe, expect, it } from "vitest";
import { calculateTextNodeResize } from "./textNodeResize";

const bounds = {
  minWidth: 360,
  minHeight: 250,
  maxWidth: 860,
  maxHeight: 760,
};

describe("calculateTextNodeResize", () => {
  it("resizes width and height together for diagonal drags", () => {
    expect(
      calculateTextNodeResize(
        {
          startClientX: 100,
          startClientY: 100,
          currentClientX: 220,
          currentClientY: 180,
          startWidth: 400,
          startHeight: 300,
          scale: 1,
        },
        bounds
      )
    ).toEqual({ width: 520, height: 380 });
  });

  it("converts screen movement through the current canvas scale", () => {
    expect(
      calculateTextNodeResize(
        {
          startClientX: 100,
          startClientY: 100,
          currentClientX: 220,
          currentClientY: 180,
          startWidth: 400,
          startHeight: 300,
          scale: 2,
        },
        bounds
      )
    ).toEqual({ width: 460, height: 340 });
  });

  it("clamps to configured bounds", () => {
    expect(
      calculateTextNodeResize(
        {
          startClientX: 100,
          startClientY: 100,
          currentClientX: -1000,
          currentClientY: 3000,
          startWidth: 400,
          startHeight: 300,
          scale: 1,
        },
        bounds
      )
    ).toEqual({ width: 360, height: 760 });
  });
});
