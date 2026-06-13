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
      isSourceNode: true,
      imageNaturalWidth: 1000,
      imageNaturalHeight: 500,
      imageDisplayWidth: 540,
      imageDisplayHeight: 270,
      imageNodeWidth: 540,
      imageNodeHeight: 270,
      imagePortCenterY: 135,
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
        videoNaturalWidth: 800,
        videoNaturalHeight: 600,
      })
    ).toMatchObject({
      isSourceNode: true,
      videoNaturalWidth: 800,
      videoNaturalHeight: 600,
      videoDisplayWidth: 540,
      videoDisplayHeight: 405,
      videoNodeWidth: 540,
      videoNodeHeight: 405,
      videoPortCenterY: 203,
      externalUploadSource: true,
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
