import { describe, expect, it } from "vitest";
import { getGridCellCrop, getGridChildNodePosition } from "./imageGridSplit";

describe("image grid split helpers", () => {
  it("calculates the crop rectangle for a selected grid cell", () => {
    expect(getGridCellCrop({ width: 1200, height: 800 }, 3, 4)).toEqual({
      sx: 400,
      sy: 266,
      sw: 400,
      sh: 267,
      row: 1,
      col: 1,
    });
  });

  it("positions a generated child node to the right of the source node", () => {
    expect(getGridChildNodePosition({ x: 320, y: 180 }, 2, 3)).toEqual({
      x: 700,
      y: 310,
    });
  });
});
