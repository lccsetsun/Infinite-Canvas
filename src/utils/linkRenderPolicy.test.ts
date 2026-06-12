import { describe, expect, it } from "vitest";
import {
  getDraftLinkRenderPolicy,
  getLinkInteractionRenderPolicy,
} from "./linkRenderPolicy";

describe("getLinkInteractionRenderPolicy", () => {
  it("keeps animated active links for normal link counts", () => {
    expect(getLinkInteractionRenderPolicy({ animationsPaused: false, linkCount: 20 })).toEqual({
      renderActiveAnimation: true,
      renderActiveStaticHighlight: true,
      renderGlowFilters: true,
    });
  });

  it("downgrades active links to static highlights when link density is high", () => {
    expect(getLinkInteractionRenderPolicy({ animationsPaused: false, linkCount: 160 })).toEqual({
      renderActiveAnimation: false,
      renderActiveStaticHighlight: true,
      renderGlowFilters: false,
    });
  });

  it("pauses active animations while canvas animations are paused", () => {
    expect(getLinkInteractionRenderPolicy({ animationsPaused: true, linkCount: 20 })).toEqual({
      renderActiveAnimation: false,
      renderActiveStaticHighlight: true,
      renderGlowFilters: false,
    });
  });
});

describe("getDraftLinkRenderPolicy", () => {
  it("keeps rich draft visuals for a small number of draft paths", () => {
    expect(getDraftLinkRenderPolicy({ draftPathCount: 2 })).toEqual({
      renderDraftAnimation: true,
      renderGlowFilters: true,
    });
  });

  it("removes pulse and glow filters for large batch draft linking", () => {
    expect(getDraftLinkRenderPolicy({ draftPathCount: 18 })).toEqual({
      renderDraftAnimation: false,
      renderGlowFilters: false,
    });
  });
});
