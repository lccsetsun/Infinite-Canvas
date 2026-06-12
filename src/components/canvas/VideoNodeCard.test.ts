import { describe, expect, it } from "vitest";
import {
  fitVideoSize,
  getVideoDurationSliderPercent,
  getVideoNodePortTopStyle,
  getVideoNodeInputReferences,
  normalizeVideoDurationSeconds,
  resolveEmptyVideoNodeSize,
  shouldShowVideoUploadButton,
} from "./VideoNodeCard";

describe("fitVideoSize", () => {
  it("fits portrait videos inside the media-node footprint", () => {
    expect(fitVideoSize({ width: 690, height: 1136 }, "9:16", 540, 540)).toEqual({
      width: 328,
      height: 540,
    });
  });
});

describe("resolveEmptyVideoNodeSize", () => {
  it("fits empty video nodes into the text-node footprint by aspect ratio", () => {
    expect(resolveEmptyVideoNodeSize({ resolution: "4K", aspectRatio: "16:9" })).toEqual({
      displayHeight: 304,
      displayWidth: 540,
      nodeHeight: 304,
      nodeWidth: 540,
      portCenterY: 152,
    });

    expect(resolveEmptyVideoNodeSize({ resolution: "1K", aspectRatio: "9:16" })).toEqual({
      displayHeight: 540,
      displayWidth: 304,
      nodeHeight: 540,
      nodeWidth: 304,
      portCenterY: 270,
    });
  });
});

describe("getVideoNodePortTopStyle", () => {
  it("uses the empty node center while the video preview is not visible", () => {
    expect(
      getVideoNodePortTopStyle({
        emptyVideoNodePortCenterY: 270,
        hasVideoPreview: false,
        videoPortCenterY: 180,
      })
    ).toBe(270);
  });

  it("uses the measured video preview center when the preview is visible", () => {
    expect(
      getVideoNodePortTopStyle({
        emptyVideoNodePortCenterY: 270,
        hasVideoPreview: true,
        videoPortCenterY: 180,
      })
    ).toBe(180);
  });
});

describe("getVideoNodeInputReferences", () => {
  it("collects image inputs as first-frame references", () => {
    expect(
      getVideoNodeInputReferences({
        image: "https://oss.example.com/first-frame.png",
        prompt: "Make the scene move",
        duration: 6,
      })
    ).toEqual([
      {
        key: "image",
        kind: "image",
        label: "Image",
        title: "First frame",
        value: "https://oss.example.com/first-frame.png",
      },
      {
        key: "prompt",
        kind: "text",
        label: "Text",
        title: "Prompt",
        value: "Make the scene move",
      },
    ]);
  });

  it("collects every image when one image input receives multiple links", () => {
    expect(
      getVideoNodeInputReferences({
        image: [
          "https://oss.example.com/first-frame.png",
          "https://oss.example.com/second-frame.png",
        ],
      }).map((reference) => reference.value)
    ).toEqual([
      "https://oss.example.com/first-frame.png",
      "https://oss.example.com/second-frame.png",
    ]);
  });

  it("flattens nested image groups when multiple image inputs are connected", () => {
    expect(
      getVideoNodeInputReferences({
        image: [["https://oss.example.com/a.png"], "https://oss.example.com/b.png"],
      }).map((reference) => reference.value)
    ).toEqual(["https://oss.example.com/a.png", "https://oss.example.com/b.png"]);
  });

  it("expands a frame-analysis image group into individual first-frame references", () => {
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );

    const references = getVideoNodeInputReferences({ image: frameImages });

    expect(references).toHaveLength(7);
    expect(references.map((reference) => reference.kind)).toEqual(Array(7).fill("image"));
    expect(references.map((reference) => reference.value)).toEqual(frameImages);
  });
});

describe("normalizeVideoDurationSeconds", () => {
  it("defaults to five seconds and clamps values to the slider range", () => {
    expect(normalizeVideoDurationSeconds(undefined)).toBe(5);
    expect(normalizeVideoDurationSeconds("12s")).toBe(12);
    expect(normalizeVideoDurationSeconds(0)).toBe(1);
    expect(normalizeVideoDurationSeconds("30s")).toBe(15);
  });
});

describe("getVideoDurationSliderPercent", () => {
  it("maps the 1-15 second range to a percentage", () => {
    expect(getVideoDurationSliderPercent(1)).toBe(0);
    expect(getVideoDurationSliderPercent(8)).toBe(50);
    expect(getVideoDurationSliderPercent(15)).toBe(100);
  });
});

describe("shouldShowVideoUploadButton", () => {
  it("hides the upload button while the node is running", () => {
    expect(
      shouldShowVideoUploadButton({
        isRunning: true,
        isUploadingAsset: false,
        isUploadingVideo: false,
      })
    ).toBe(false);
  });

  it("hides the upload button while a video upload is in progress", () => {
    expect(
      shouldShowVideoUploadButton({
        isRunning: false,
        isUploadingAsset: true,
        isUploadingVideo: false,
      })
    ).toBe(false);
    expect(
      shouldShowVideoUploadButton({
        isRunning: false,
        isUploadingAsset: false,
        isUploadingVideo: true,
      })
    ).toBe(false);
  });

  it("shows the upload button while the node is idle", () => {
    expect(
      shouldShowVideoUploadButton({
        isRunning: false,
        isUploadingAsset: false,
        isUploadingVideo: false,
      })
    ).toBe(true);
  });
});
