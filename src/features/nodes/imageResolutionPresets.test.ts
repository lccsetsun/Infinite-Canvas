import { describe, expect, it } from "vitest";
import {
  IMAGE_RESOLUTION_PRESET_GROUPS,
  IMAGE_RESOLUTION_PRESETS,
  formatImageResolutionPreset,
  formatImageResolutionPresetOption,
  getImageResolutionPreset,
} from "./imageResolutionPresets";

describe("image resolution presets", () => {
  it("contains every requested resolution and aspect ratio combination", () => {
    expect(IMAGE_RESOLUTION_PRESETS).toHaveLength(32);
    expect(IMAGE_RESOLUTION_PRESET_GROUPS.map((group) => group.resolution)).toEqual([
      "1K",
      "2K",
      "3K",
      "4K",
    ]);

    expect(getImageResolutionPreset("1K", "1:1")).toMatchObject({
      width: 1024,
      height: 1024,
    });
    expect(getImageResolutionPreset("1K", "21:9")).toMatchObject({
      width: 1568,
      height: 672,
    });
    expect(getImageResolutionPreset("2K", "16:9")).toMatchObject({
      width: 2848,
      height: 1600,
    });
    expect(getImageResolutionPreset("3K", "2:3")).toMatchObject({
      width: 2496,
      height: 3744,
    });
    expect(getImageResolutionPreset("4K", "9:16")).toMatchObject({
      width: 3040,
      height: 5504,
    });
  });

  it("formats presets for compact node controls", () => {
    expect(formatImageResolutionPreset("1K", "16:9")).toBe("16:9 · 1408×792");
    expect(formatImageResolutionPreset("3K", "1:1")).toBe("1:1 · 3072×3072");
    expect(formatImageResolutionPresetOption("2K", "9:16")).toBe("2K 9:16 · 1600×2848");
  });
});
