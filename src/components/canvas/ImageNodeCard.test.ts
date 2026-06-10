import { describe, expect, it } from "vitest";
import {
  getImageNodeInputReferences,
  getImagePreviewFrameClassName,
  getImageNodePortTopStyle,
  getSettledImageLoadStatus,
  getResultImageBounds,
  hasFrameExtractionDragStarted,
  resolveResultImageSize,
  shouldShowImageUploadButton,
} from "./ImageNodeCard";

describe("getImageNodeInputReferences", () => {
  it("collects text and media inputs for the prompt composer", () => {
    expect(
      getImageNodeInputReferences({
        prompt: "一只猫和一只狗坐在公园里",
        source_image: "https://oss.example.com/reference.png",
        source_audio: "https://oss.example.com/mood.mp3",
        source_video: "https://oss.example.com/motion.mp4",
        aspect_ratio: "16:9",
      })
    ).toEqual([
      {
        key: "prompt",
        kind: "text",
        label: "文本",
        title: "文本",
        value: "一只猫和一只狗坐在公园里",
      },
      {
        key: "source_image",
        kind: "image",
        label: "图片",
        title: "图片",
        value: "https://oss.example.com/reference.png",
      },
      {
        key: "source_audio",
        kind: "audio",
        label: "音频",
        title: "音频",
        value: "https://oss.example.com/mood.mp3",
      },
      {
        key: "source_video",
        kind: "video",
        label: "视频",
        title: "视频",
        value: "https://oss.example.com/motion.mp4",
      },
    ]);
  });

  it("ignores generation settings and empty values", () => {
    expect(
      getImageNodeInputReferences({
        prompt: "  ",
        negative_prompt: "low quality",
        aspect_ratio: "16:9",
        quantity: 1,
      })
    ).toEqual([]);
  });

  it("collects every media item when one input receives multiple links", () => {
    expect(
      getImageNodeInputReferences({
        source_image: [
          "https://oss.example.com/reference-a.png",
          "https://oss.example.com/reference-b.png",
        ],
      }).map((reference) => reference.value)
    ).toEqual([
      "https://oss.example.com/reference-a.png",
      "https://oss.example.com/reference-b.png",
    ]);
  });

  it("expands a frame-analysis image group into individual references", () => {
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );

    const references = getImageNodeInputReferences({ source_image: frameImages });

    expect(references).toHaveLength(7);
    expect(references.map((reference) => reference.kind)).toEqual(Array(7).fill("image"));
    expect(references.map((reference) => reference.value)).toEqual(frameImages);
  });
});

describe("getResultImageBounds", () => {
  it("uses compact bounds for image prompt starter placeholders", () => {
    expect(getResultImageBounds("16:9", true)).toEqual({
      maxWidth: 520,
      maxHeight: 390,
    });
  });

  it("uses compact bounds for extracted frame child nodes", () => {
    expect(getResultImageBounds("16:9", false, true)).toEqual({
      maxWidth: 360,
      maxHeight: 270,
    });
  });

  it("keeps large bounds for regular non-square image nodes", () => {
    expect(getResultImageBounds("16:9")).toEqual({
      maxWidth: 780,
      maxHeight: 585,
    });
  });

  it("reuses saved display dimensions when natural size is missing", () => {
    expect(
      resolveResultImageSize(
        {
          imageDisplayWidth: 260,
          imageDisplayHeight: 469,
        },
        "16:9"
      )
    ).toEqual({
      width: 260,
      height: 469,
    });
  });
});

describe("getImagePreviewFrameClassName", () => {
  it("uses a dark loading surface instead of a white frame before images load", () => {
    const className = getImagePreviewFrameClassName({
      isImageLoaded: false,
      isSelected: false,
      isStarterPlaceholder: false,
    });

    expect(className).toContain("bg-[#111827]");
    expect(className).not.toContain("bg-white");
  });
});

describe("getImageNodePortTopStyle", () => {
  it("centers ports on the main image card while the image node has no generated image", () => {
    expect(getImageNodePortTopStyle({ hasImageUrl: false })).toBe(145);
  });

  it("uses the measured image media center after an image is loaded", () => {
    expect(getImageNodePortTopStyle({ hasImageUrl: true, imagePortCenterY: 220 })).toBe(220);
  });
});

describe("shouldShowImageUploadButton", () => {
  it("hides the upload button while the image is still loading", () => {
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: false,
        isImageLoadFailed: false,
        isUploadingNodeAsset: false,
      })
    ).toBe(false);
  });

  it("shows the upload button after the image settles", () => {
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: true,
        isImageLoadFailed: false,
        isUploadingNodeAsset: false,
      })
    ).toBe(true);
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: false,
        isImageLoadFailed: true,
        isUploadingNodeAsset: false,
      })
    ).toBe(true);
  });

  it("hides the upload button while a node asset upload is in progress", () => {
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: true,
        isImageLoadFailed: false,
        isUploadingNodeAsset: true,
      })
    ).toBe(false);
  });
});

describe("hasFrameExtractionDragStarted", () => {
  it("waits until the pointer has moved past the drag threshold", () => {
    expect(
      hasFrameExtractionDragStarted({
        startClientX: 100,
        startClientY: 100,
        clientX: 104,
        clientY: 105,
      })
    ).toBe(false);
    expect(
      hasFrameExtractionDragStarted({
        startClientX: 100,
        startClientY: 100,
        clientX: 108,
        clientY: 100,
      })
    ).toBe(true);
  });
});

describe("getSettledImageLoadStatus", () => {
  it("treats a completed image with natural dimensions as loaded", () => {
    expect(getSettledImageLoadStatus({ complete: true, naturalWidth: 640 })).toBe("loaded");
  });

  it("treats a completed image without natural dimensions as failed", () => {
    expect(getSettledImageLoadStatus({ complete: true, naturalWidth: 0 })).toBe("error");
  });

  it("keeps incomplete images idle", () => {
    expect(getSettledImageLoadStatus({ complete: false, naturalWidth: 0 })).toBe("idle");
  });
});
