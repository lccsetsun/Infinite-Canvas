import { describe, expect, it } from "vitest";
import { buildInitialCanvasFileNodeData } from "./canvasFileUpload";

describe("buildInitialCanvasFileNodeData", () => {
  it("precomputes image display dimensions before the node is created", () => {
    expect(
      buildInitialCanvasFileNodeData("image", "imageUrl", "blob:image", "image.png", {
        imageNaturalWidth: 1000,
        imageNaturalHeight: 500,
      })
    ).toMatchObject({
      imageUrl: "blob:image",
      imageNaturalWidth: 1000,
      imageNaturalHeight: 500,
      imageDisplayWidth: 780,
      imageDisplayHeight: 390,
      imageUrls: ["blob:image"],
      activeImageIndex: 0,
      uploadingAsset: true,
    });
  });

  it("precomputes video display dimensions before the node is created", () => {
    expect(
      buildInitialCanvasFileNodeData("video", "videoUrl", "blob:video", "video.mp4", {
        videoNaturalWidth: 1000,
        videoNaturalHeight: 500,
      })
    ).toMatchObject({
      videoUrl: "blob:video",
      videoNaturalWidth: 1000,
      videoNaturalHeight: 500,
      videoDisplayWidth: 520,
      videoDisplayHeight: 260,
      uploadingAsset: true,
    });
  });
});
