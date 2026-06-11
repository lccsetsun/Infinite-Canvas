import { describe, expect, it } from "vitest";
import {
  getImageNodeInputReferences,
  getImagePreviewFrameClassName,
  getImagePreviewNodeWidth,
  getImagePortHandleWrapperStyle,
  getImageNodePortTopStyle,
  getSettledImageLoadStatus,
  getResultImageBounds,
  hasFrameExtractionDragStarted,
  resolveEmptyImageNodeSize,
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

  it("flattens nested media groups when multiple image inputs are connected", () => {
    expect(
      getImageNodeInputReferences({
        source_image: [["https://oss.example.com/duck.png"], "https://oss.example.com/cat-dog.png"],
      }).map((reference) => reference.value)
    ).toEqual(["https://oss.example.com/duck.png", "https://oss.example.com/cat-dog.png"]);
  });

  it("extracts image references from object-shaped upstream outputs", () => {
    expect(
      getImageNodeInputReferences({
        source_image: {
          imageUrls: ["https://oss.example.com/a.png", "https://oss.example.com/b.png"],
        },
      }).map((reference) => reference.value)
    ).toEqual(["https://oss.example.com/a.png", "https://oss.example.com/b.png"]);
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
      maxWidth: 540,
      maxHeight: 540,
    });
  });

  it("uses compact bounds for extracted frame child nodes", () => {
    expect(getResultImageBounds("16:9", false, true)).toEqual({
      maxWidth: 360,
      maxHeight: 270,
    });
  });

  it("uses media-node footprint bounds for regular image nodes", () => {
    expect(getResultImageBounds("16:9")).toEqual({
      maxWidth: 540,
      maxHeight: 540,
    });
  });

  it("uses media-node footprint bounds for square image nodes", () => {
    expect(getResultImageBounds("1:1")).toEqual({
      maxWidth: 540,
      maxHeight: 540,
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

  it("uses the current empty node center while the image node has no generated image", () => {
    expect(getImageNodePortTopStyle({ hasImageUrl: false, emptyImageNodePortCenterY: 292 })).toBe(
      292
    );
  });

  it("uses the measured image media center after an image is loaded", () => {
    expect(getImageNodePortTopStyle({ hasImageUrl: true, imagePortCenterY: 220 })).toBe(220);
  });
});

describe("resolveEmptyImageNodeSize", () => {
  it("fits empty image nodes into the text-node footprint by aspect ratio", () => {
    expect(resolveEmptyImageNodeSize({ resolution: "1K", aspectRatio: "16:9" })).toEqual({
      displayHeight: 304,
      displayWidth: 540,
      nodeHeight: 304,
      nodeWidth: 540,
      portCenterY: 152,
    });

    expect(resolveEmptyImageNodeSize({ resolution: "4K", aspectRatio: "1:1" })).toEqual({
      displayHeight: 540,
      displayWidth: 540,
      nodeHeight: 540,
      nodeWidth: 540,
      portCenterY: 270,
    });

    expect(resolveEmptyImageNodeSize({ resolution: "1K", aspectRatio: "9:16" })).toEqual({
      displayHeight: 540,
      displayWidth: 304,
      nodeHeight: 540,
      nodeWidth: 304,
      portCenterY: 270,
    });
  });

  it("fits very wide empty nodes into the same text-node footprint", () => {
    expect(resolveEmptyImageNodeSize({ resolution: "1K", aspectRatio: "21:9" })).toEqual({
      displayHeight: 231,
      displayWidth: 540,
      nodeHeight: 231,
      nodeWidth: 540,
      portCenterY: 116,
    });
  });
});

describe("getImagePreviewNodeWidth", () => {
  it("uses the frame-strip width for frame analysis previews", () => {
    expect(
      getImagePreviewNodeWidth({
        frameStripWidth: 1006,
        isFrameStrip: true,
        resultImageWidth: 780,
      })
    ).toBe(1006);
  });

  it("keeps regular image previews on the resolved image width", () => {
    expect(
      getImagePreviewNodeWidth({
        frameStripWidth: 1006,
        isFrameStrip: false,
        resultImageWidth: 780,
      })
    ).toBe(780);
  });
});

describe("getImagePortHandleWrapperStyle", () => {
  it("centers the plus handle on the image-height center without relying on transform", () => {
    expect(getImagePortHandleWrapperStyle(220)).toEqual({ top: 220, marginTop: -18 });
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
