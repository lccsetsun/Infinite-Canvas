import { describe, expect, it } from "vitest";
import { buildInitialCanvasFileNodeData } from "./canvasFileUpload";

describe("buildInitialCanvasFileNodeData", () => {
  it("precomputes image dimensions without exposing the local preview before OSS upload finishes", () => {
    expect(
      buildInitialCanvasFileNodeData("image", "imageUrl", "blob:image", "image.png", {
        imageNaturalWidth: 1000,
        imageNaturalHeight: 500,
      })
    ).toMatchObject({
      imageNaturalWidth: 1000,
      imageNaturalHeight: 500,
      imageDisplayWidth: 780,
      imageDisplayHeight: 390,
      activeImageIndex: 0,
      uploadingAsset: true,
    });
    expect(
      buildInitialCanvasFileNodeData("image", "imageUrl", "blob:image", "image.png", {
        imageNaturalWidth: 1000,
        imageNaturalHeight: 500,
      })
    ).not.toHaveProperty("imageUrl");
  });

  it("precomputes video dimensions without exposing the local preview before OSS upload finishes", () => {
    expect(
      buildInitialCanvasFileNodeData("video", "videoUrl", "blob:video", "video.mp4", {
        videoNaturalWidth: 1000,
        videoNaturalHeight: 500,
      })
    ).toMatchObject({
      videoNaturalWidth: 1000,
      videoNaturalHeight: 500,
      videoDisplayWidth: 520,
      videoDisplayHeight: 260,
      uploadingAsset: true,
    });
    expect(
      buildInitialCanvasFileNodeData("video", "videoUrl", "blob:video", "video.mp4", {
        videoNaturalWidth: 1000,
        videoNaturalHeight: 500,
      })
    ).not.toHaveProperty("videoUrl");
  });
});
