import { describe, expect, it } from "vitest";
import {
  getImageLoadingMode,
  getCanvasMediaLoadAllowance,
  getStripThumbnailLoadingMode,
  getVideoPreloadMode,
} from "./mediaPreviewPolicy";

describe("mediaPreviewPolicy", () => {
  it("does not preload passive videos", () => {
    expect(getVideoPreloadMode({ hovered: false, playing: false, selected: false })).toBe("none");
  });

  it("loads video metadata only when the user is likely to interact", () => {
    expect(getVideoPreloadMode({ hovered: false, playing: false, selected: true })).toBe(
      "metadata"
    );
    expect(getVideoPreloadMode({ hovered: true, playing: false, selected: false })).toBe(
      "metadata"
    );
    expect(getVideoPreloadMode({ hovered: false, playing: true, selected: false })).toBe("auto");
  });

  it("lazy-loads passive images", () => {
    expect(getImageLoadingMode({ selected: false, visible: true })).toBe("lazy");
    expect(getImageLoadingMode({ selected: true, visible: true })).toBe("eager");
  });

  it("eager-loads the active strip thumbnail and lazy-loads distant thumbnails", () => {
    expect(getStripThumbnailLoadingMode({ activeIndex: 4, index: 4 })).toBe("eager");
    expect(getStripThumbnailLoadingMode({ activeIndex: 4, index: 5 })).toBe("eager");
    expect(getStripThumbnailLoadingMode({ activeIndex: 4, index: 7 })).toBe("lazy");
  });

  it("allows every current viewport media node while keeping active nodes allowed", () => {
    const allowed = getCanvasMediaLoadAllowance({
      activeNodeIds: ["selected"],
      mediaNodeIds: ["a", "b", "selected", "c", "d", "e", "f", "g", "h"],
    });

    expect(allowed).toEqual(new Set(["selected", "a", "b", "c", "d", "e", "f", "g", "h"]));
  });

  it("keeps previously allowed media nodes allowed after viewport changes", () => {
    expect(
      getCanvasMediaLoadAllowance({
        activeNodeIds: ["selected"],
        mediaNodeIds: ["a", "b", "c"],
        retainedNodeIds: ["old-a", "old-b"],
      })
    ).toEqual(new Set(["old-a", "old-b", "selected", "a", "b", "c"]));
  });
});
