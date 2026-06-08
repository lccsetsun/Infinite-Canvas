import { describe, expect, it } from "vitest";
import {
  buildCropAssetProxyUrl,
  getCropAspectRatio,
  getCroppedImageDimensions,
  getInitialCropRect,
  type CropRatioPreset,
} from "./imageCrop";

describe("image crop helpers", () => {
  it("uses the original image ratio when requested", () => {
    expect(getCropAspectRatio("original", { width: 1200, height: 800 })).toBe(1.5);
  });

  it("creates a centered crop rectangle that respects a fixed ratio", () => {
    expect(getInitialCropRect({ width: 400, height: 300 }, 1)).toEqual({
      x: 60,
      y: 10,
      width: 280,
      height: 280,
    });
  });

  it("translates display-space crop coordinates into natural image dimensions", () => {
    expect(
      getCroppedImageDimensions(
        { x: 50, y: 20, width: 200, height: 120 },
        { width: 400, height: 300 },
        { width: 1600, height: 1200 }
      )
    ).toEqual({
      sx: 200,
      sy: 80,
      sw: 800,
      sh: 480,
    });
  });

  it("builds the same-origin asset proxy url for remote crop sources", () => {
    expect(buildCropAssetProxyUrl("https://oss.example.com/cat.png?x=1")).toBe(
      "/api/download-asset?url=https%3A%2F%2Foss.example.com%2Fcat.png%3Fx%3D1&filename=crop-source.png"
    );
  });

  it.each<[CropRatioPreset, number]>([
    ["1:1", 1],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ])("parses the %s crop ratio", (preset, expected) => {
    expect(getCropAspectRatio(preset, { width: 1200, height: 800 })).toBeCloseTo(expected, 4);
  });
});
