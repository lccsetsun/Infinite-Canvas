import { describe, expect, it } from "vitest";
import {
  fitVideoSize,
  getVideoControlDisplayTime,
  getVideoDurationSliderPercent,
  getVideoFrameCaptureTime,
  getVideoFrameCaptureSourceUrl,
  getVideoNodePortTopStyle,
  getVideoProgressPercent,
  getVideoNodeInputReferences,
  normalizeVideoDurationSeconds,
  resolveEmptyVideoNodeSize,
  shouldShowVideoPreview,
  shouldUseEmptyVideoNodeSize,
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

describe("getVideoProgressPercent", () => {
  it("clamps playback progress for the custom video control track", () => {
    expect(getVideoProgressPercent({ currentTime: 2.5, duration: 5 })).toBe(50);
    expect(getVideoProgressPercent({ currentTime: -1, duration: 5 })).toBe(0);
    expect(getVideoProgressPercent({ currentTime: 9, duration: 5 })).toBe(100);
    expect(getVideoProgressPercent({ currentTime: 2, duration: 0 })).toBe(0);
  });
});

describe("getVideoControlDisplayTime", () => {
  it("shows the full duration when playback is effectively at the tail frame", () => {
    expect(getVideoControlDisplayTime({ currentTime: 4.95, duration: 5 })).toBe(5);
    expect(getVideoControlDisplayTime({ currentTime: 4.8, duration: 5 })).toBe(4.8);
  });
});

describe("getVideoFrameCaptureTime", () => {
  it("maps capture menu modes to stable video seconds", () => {
    expect(getVideoFrameCaptureTime({ mode: "first", currentTime: 4.8, duration: 8 })).toBe(0);
    expect(getVideoFrameCaptureTime({ mode: "current", currentTime: 4.8, duration: 8 })).toBe(4.8);
    expect(getVideoFrameCaptureTime({ mode: "last", currentTime: 4.8, duration: 8 })).toBe(7.95);
  });

  it("clamps capture seconds for very short or unknown videos", () => {
    expect(getVideoFrameCaptureTime({ mode: "first", currentTime: 0, duration: 0.6 })).toBe(0);
    expect(getVideoFrameCaptureTime({ mode: "last", currentTime: 0, duration: 0.6 })).toBe(0.55);
    expect(getVideoFrameCaptureTime({ mode: "current", currentTime: 99, duration: 5 })).toBe(4.95);
    expect(getVideoFrameCaptureTime({ mode: "first", currentTime: 0, duration: 0 })).toBe(0);
  });
});

describe("getVideoFrameCaptureSourceUrl", () => {
  it("routes cross-origin videos through the same-origin frame source proxy", () => {
    expect(
      getVideoFrameCaptureSourceUrl(
        "https://kwyai1.oss-cn-beijing.aliyuncs.com/pic/demo.mp4",
        "http://localhost:3000"
      )
    ).toBe(
      "/api/video-frame-source?url=https%3A%2F%2Fkwyai1.oss-cn-beijing.aliyuncs.com%2Fpic%2Fdemo.mp4"
    );
  });

  it("keeps same-origin and blob videos unchanged", () => {
    expect(getVideoFrameCaptureSourceUrl("/assets/demo.mp4", "http://localhost:3000")).toBe(
      "http://localhost:3000/assets/demo.mp4"
    );
    expect(
      getVideoFrameCaptureSourceUrl("blob:http://localhost:3000/video", "http://localhost:3000")
    ).toBe("blob:http://localhost:3000/video");
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

describe("shouldShowVideoPreview", () => {
  it("keeps an existing video preview visible during frame analysis", () => {
    expect(
      shouldShowVideoPreview({
        hasVideoUrl: true,
        isRunning: true,
        isUploadingAsset: false,
        loadingOperation: "frame-analysis",
      })
    ).toBe(true);
  });

  it("hides the preview for generate loading and uploads", () => {
    expect(
      shouldShowVideoPreview({
        hasVideoUrl: true,
        isRunning: true,
        isUploadingAsset: false,
        loadingOperation: "generate",
      })
    ).toBe(false);

    expect(
      shouldShowVideoPreview({
        hasVideoUrl: true,
        isRunning: false,
        isUploadingAsset: true,
      })
    ).toBe(false);
  });
});

describe("shouldUseEmptyVideoNodeSize", () => {
  it("keeps known uploaded video dimensions while the upload is still running", () => {
    expect(
      shouldUseEmptyVideoNodeSize({
        hasVideoUrl: false,
        isUploadingAsset: true,
        hasKnownVideoSize: true,
      })
    ).toBe(false);
  });

  it("uses the configured empty size when no video dimensions are known", () => {
    expect(
      shouldUseEmptyVideoNodeSize({
        hasVideoUrl: false,
        isUploadingAsset: true,
        hasKnownVideoSize: false,
      })
    ).toBe(true);
  });
});
