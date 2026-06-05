import { describe, expect, it } from "vitest";
import { formatGridCellLabel, getGridCellCrop, getGridChildNodePosition } from "./imageGridSplit";

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

  it("supports rectangular grids for crop calculations", () => {
    expect(getGridCellCrop({ width: 1200, height: 800 }, 2, 4, 3)).toEqual({
      sx: 400,
      sy: 400,
      sw: 400,
      sh: 400,
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

  it("positions rectangular-grid child nodes by row", () => {
    expect(getGridChildNodePosition({ x: 320, y: 180 }, 2, 4, 3)).toEqual({
      x: 700,
      y: 310,
    });
  });

  it("formats the selected cell label", () => {
    expect(formatGridCellLabel(2, 1)).toBe("第 2 格 (1行2列)");
  });

  it("formats rectangular-grid labels", () => {
    expect(formatGridCellLabel(2, 4, 3)).toBe("第 5 格 (2行2列)");
  });
});
