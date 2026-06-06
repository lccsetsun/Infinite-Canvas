import { describe, expect, it } from "vitest";
import { getSearchMenuPosition } from "./searchMenuPosition";

describe("getSearchMenuPosition", () => {
  it("keeps a context menu inside the viewport when opened near the bottom-right corner", () => {
    expect(
      getSearchMenuPosition(
        { x: 760, y: 420 },
        { width: 280, height: 520 },
        { width: 780, height: 439 }
      )
    ).toEqual({
      left: 488,
      top: 12,
    });
  });

  it("uses the original point when there is enough room", () => {
    expect(
      getSearchMenuPosition(
        { x: 120, y: 96 },
        { width: 280, height: 320 },
        { width: 780, height: 439 }
      )
    ).toEqual({
      left: 120,
      top: 96,
    });
  });

  it("reserves extra bottom room for desktop overlays when requested", () => {
    expect(
      getSearchMenuPosition(
        { x: 680, y: 760 },
        { width: 420, height: 640 },
        { width: 1124, height: 900 },
        { bottomMargin: 120 }
      )
    ).toEqual({
      left: 680,
      top: 140,
    });
  });
});
