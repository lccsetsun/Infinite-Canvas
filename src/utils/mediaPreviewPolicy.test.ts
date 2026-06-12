import { describe, expect, it } from "vitest";
import {
  getImageLoadingMode,
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
});
