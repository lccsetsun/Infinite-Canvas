import { describe, expect, it } from "vitest";
import { getMentionMenuLayout } from "./InputResourceMentionMenu";

describe("getMentionMenuLayout", () => {
  it("opens upward when the menu would be clipped below the input panel", () => {
    expect(
      getMentionMenuLayout({
        anchorTop: 760,
        anchorBottom: 840,
        viewportHeight: 900,
        menuHeight: 260,
      }).placement
    ).toBe("above");
  });

  it("opens downward when there is enough room below", () => {
    expect(
      getMentionMenuLayout({
        anchorTop: 300,
        anchorBottom: 380,
        viewportHeight: 900,
        menuHeight: 260,
      }).placement
    ).toBe("below");
  });

  it("caps the menu height to the available side of the viewport", () => {
    expect(
      getMentionMenuLayout({
        anchorTop: 760,
        anchorBottom: 840,
        viewportHeight: 900,
        menuHeight: 640,
        maxMenuHeight: 360,
      }).maxHeight
    ).toBeLessThanOrEqual(360);
  });

  it("keeps the compact default menu inside the viewport horizontally", () => {
    expect(
      getMentionMenuLayout({
        anchorTop: 120,
        anchorBottom: 148,
        anchorLeft: 760,
        viewportHeight: 640,
        viewportWidth: 800,
        menuHeight: 220,
      }).left
    ).toBe(600);
  });
});
