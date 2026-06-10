import { describe, expect, it } from "vitest";
import { getFloatingMenuPosition } from "./floatingMenuPosition";

describe("getFloatingMenuPosition", () => {
  it("places the menu below the anchor when there is enough space", () => {
    expect(
      getFloatingMenuPosition({
        anchorRect: { left: 120, right: 420, top: 100, bottom: 140, width: 300 },
        viewportHeight: 800,
        viewportWidth: 1200,
      })
    ).toEqual({
      left: 120,
      maxHeight: 360,
      placement: "bottom",
      top: 150,
      width: 300,
    });
  });

  it("places the menu above the anchor near the bottom edge", () => {
    expect(
      getFloatingMenuPosition({
        anchorRect: { left: 120, right: 420, top: 720, bottom: 760, width: 300 },
        viewportHeight: 800,
        viewportWidth: 1200,
      })
    ).toEqual({
      bottom: 90,
      left: 120,
      maxHeight: 360,
      placement: "top",
      width: 300,
    });
  });

  it("keeps the menu inside the horizontal viewport", () => {
    expect(
      getFloatingMenuPosition({
        anchorRect: { left: 980, right: 1280, top: 120, bottom: 160, width: 300 },
        viewportHeight: 800,
        viewportWidth: 1100,
      }).left
    ).toBe(784);
  });
});
