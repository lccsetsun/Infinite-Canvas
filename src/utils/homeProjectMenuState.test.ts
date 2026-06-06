import { describe, expect, it } from "vitest";
import { getHomeProjectMenuState } from "./homeProjectMenuState";

describe("getHomeProjectMenuState", () => {
  it("keeps the trigger visible even when the tile is idle", () => {
    expect(getHomeProjectMenuState("project-1", null, null)).toEqual({
      buttonVisible: true,
      menuVisible: false,
    });
  });

  it("shows the menu while the tile menu area is hovered", () => {
    expect(getHomeProjectMenuState("project-1", "project-1", null)).toEqual({
      buttonVisible: true,
      menuVisible: true,
    });
  });

  it("keeps the menu visible after click toggle even without hover", () => {
    expect(getHomeProjectMenuState("project-1", null, "project-1")).toEqual({
      buttonVisible: true,
      menuVisible: true,
    });
  });
});
