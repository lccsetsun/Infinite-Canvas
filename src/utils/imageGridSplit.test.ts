import { describe, expect, it } from "vitest";
import {
  buildGridSplitChildNodeInitialProps,
  formatGridCellLabel,
  getGridCellCrop,
  getGridChildNodePosition,
  getGridCellReplacementDrawPlan,
} from "./imageGridSplit";

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

  it("builds linked child image node props without marking the child as a source node", () => {
    const props = buildGridSplitChildNodeInitialProps({
      cellIndex: 1,
      crop: { sw: 432, sh: 248 },
      dataUrl: "data:image/png;base64,child",
      gridCols: 2,
      gridRows: 2,
      sourceTitle: "图片节点 12",
    });

    expect(props.__nodeTitle).toBe("宫格切分 2x2 #2");
    expect(props).not.toHaveProperty("__uploadedAssetKind");
    expect(props).not.toHaveProperty("__uploadedAssetUrl");
    expect(props.__nodeData).toEqual({
      activeImageIndex: 0,
      imageDisplayHeight: 310,
      imageDisplayWidth: 540,
      imageNaturalHeight: 248,
      imageNaturalWidth: 432,
      imageUrl: "data:image/png;base64,child",
      imageUrls: ["data:image/png;base64,child"],
      status: "success",
    });
    expect(props).toMatchObject({
      imageDisplayHeight: 310,
      imageDisplayWidth: 540,
      imageNaturalHeight: 248,
      imageNaturalWidth: 432,
    });
    expect(props.text).toBe("来自 图片节点 12 的 2x2 第 2 格 (432x248)");
  });

  it("plans a permanent grid-cell replacement without changing the source image size", () => {
    expect(
      getGridCellReplacementDrawPlan(
        { width: 1200, height: 800 },
        { width: 1600, height: 900 },
        3,
        4
      )
    ).toEqual({
      canvas: { width: 1200, height: 800 },
      cell: {
        sx: 400,
        sy: 266,
        sw: 400,
        sh: 267,
        row: 1,
        col: 1,
      },
      replacementSource: {
        sx: 126,
        sy: 0,
        sw: 1348,
        sh: 900,
      },
    });
  });
});
