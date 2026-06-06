import { describe, expect, it } from "vitest";
import { getHomeProjectMenuPosition } from "./homeProjectMenuPosition";

describe("getHomeProjectMenuPosition", () => {
  it("opens below the trigger when there is enough room", () => {
    expect(
      getHomeProjectMenuPosition(
        { top: 100, bottom: 136, right: 900 },
        { width: 192, height: 220 },
        { width: 1200, height: 900 }
      )
    ).toEqual({
      left: 708,
      top: 146,
    });
  });

  it("opens above the trigger when the bottom space is insufficient", () => {
    expect(
      getHomeProjectMenuPosition(
        { top: 760, bottom: 796, right: 900 },
        { width: 192, height: 220 },
        { width: 1200, height: 900 }
      )
    ).toEqual({
      left: 708,
      top: 530,
    });
  });

  it("clamps horizontally so the menu stays inside the viewport", () => {
    expect(
      getHomeProjectMenuPosition(
        { top: 100, bottom: 136, right: 1200 },
        { width: 192, height: 220 },
        { width: 1200, height: 900 }
      )
    ).toEqual({
      left: 996,
      top: 146,
    });
  });
});
