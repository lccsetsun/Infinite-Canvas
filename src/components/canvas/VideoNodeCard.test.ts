import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fitVideoSize,
  getVideoControlDisplayTime,
  getVideoDurationSliderPercent,
  getVideoGenerationElapsedLabel,
  getVideoFrameCaptureTime,
  getVideoFrameCaptureSourceUrl,
  getVideoNodePortTopStyle,
  getVideoProgressPercent,
  getVideoNodeInputReferences,
  normalizeVideoDurationSeconds,
  resolveEmptyVideoNodeSize,
  resolveVideoNodeSizePresetData,
  shouldShowVideoPreview,
  shouldShowVideoPromptComposer,
  shouldShowVideoCustomControls,
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

describe("resolveVideoNodeSizePresetData", () => {
  it("resolves node dimensions from the selected size preset for empty video nodes", () => {
    expect(
      resolveVideoNodeSizePresetData({
        resolution: "720p",
        aspectRatio: "9:16",
        hasVideoUrl: false,
      })
    ).toEqual({
      videoDisplayHeight: 540,
      videoDisplayWidth: 304,
      videoNodeHeight: 540,
      videoNodeWidth: 304,
      videoPortCenterY: 270,
    });
  });

  it("does not resize video nodes that already have media", () => {
    expect(
      resolveVideoNodeSizePresetData({
        resolution: "720p",
        aspectRatio: "1:1",
        hasVideoUrl: true,
      })
    ).toBeNull();
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

describe("shouldShowVideoCustomControls", () => {
  it("shows custom controls only while hovering a visible video preview", () => {
    expect(shouldShowVideoCustomControls({ hasVideoPreview: true, isHovered: true })).toBe(true);
    expect(shouldShowVideoCustomControls({ hasVideoPreview: true, isHovered: false })).toBe(false);
    expect(shouldShowVideoCustomControls({ hasVideoPreview: false, isHovered: true })).toBe(false);
  });
});

describe("shouldShowVideoPromptComposer", () => {
  it("shows the composer for selected non-upload video nodes even after a video URL exists", () => {
    expect(
      shouldShowVideoPromptComposer({
        isExternalUploadSourceVideoNode: false,
        isRunning: false,
        isSelected: true,
        isUploadingAsset: false,
      })
    ).toBe(true);
  });

  it("hides the composer only for external uploaded video source nodes", () => {
    expect(
      shouldShowVideoPromptComposer({
        isExternalUploadSourceVideoNode: true,
        isRunning: false,
        isSelected: true,
        isUploadingAsset: false,
      })
    ).toBe(false);
  });

  it("temporarily hides the composer while the video node is loading", () => {
    expect(
      shouldShowVideoPromptComposer({
        isExternalUploadSourceVideoNode: false,
        isRunning: true,
        isSelected: true,
        isUploadingAsset: false,
      })
    ).toBe(false);
  });

  it("does not show the composer from hover alone", () => {
    expect(
      shouldShowVideoPromptComposer({
        isExternalUploadSourceVideoNode: false,
        isRunning: false,
        isSelected: false,
        isUploadingAsset: false,
      })
    ).toBe(false);
  });
});

describe("VideoNodeCard preview branch", () => {
  it("shows video generation elapsed time centered above running and completed nodes", () => {
    expect(
      getVideoGenerationElapsedLabel({
        finishedAt: undefined,
        isGenerating: true,
        now: 1_400,
        startedAt: 1_000,
      })
    ).toBe("0s");
    expect(
      getVideoGenerationElapsedLabel({
        finishedAt: 66_000,
        isGenerating: false,
        now: 99_000,
        startedAt: 1_000,
      })
    ).toBe("1m");

    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("generationStartedAt");
    expect(source).toContain("generationFinishedAt");
    expect(source).toContain('data-video-generation-elapsed-badge="true"');
    expect(source).toContain("absolute -top-8 left-1/2");
    expect(source).toContain("formatVideoGenerationElapsedTime(0)");
    expect(source).toContain("getMediaNodeFloatingToolbarGap(canvasZoom)");
    expect(source).toContain('"--media-node-toolbar-gap"');
    expect(source).toContain("const elapsedBadgeStyle");
    expect(source).toContain("scale: promptComposerCanvasScale");
    expect(source).toContain("text-[15px] font-medium");
  });

  it("renders the prompt composer for completed video nodes as well as empty video nodes", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("const promptComposerNode = (");
    expect(source).toContain("{promptComposerNode}");
  });

  it("provides a temporary fullscreen prompt editor from the video prompt composer", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [expandedPromptEditorOpen, setExpandedPromptEditorOpen]");
    expect(source).toContain('aria-label="放大编辑"');
    expect(source).toContain('aria-label="关闭全屏编辑"');
    expect(source).toContain("onEscape={() => setExpandedPromptEditorOpen(false)}");
    expect(source).toContain("fixed inset-0 z-[220]");
    expect(source).toContain('panelLayerClassName="z-[240]"');
    expect(source).toContain("bg-violet-500/[0.16] text-violet-50");
    expect(source).toContain("overflow-y-auto pr-3 text-[16px] leading-8 custom-scrollbar");
    expect(source).toContain('panelTitle="Video Size"');
    expect(source).toContain("durationSliderPercent");
    expect(source).toContain('onUpdateProperty?.(node.id, "audio", !audioEnabled)');
  });

  it("allows video generation when linked input resources exist even before prompt text is typed", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("const canRunVideoPrompt = Boolean(");
    expect(source).toContain("inputReferences.length > 0");
    expect(source).toContain("disabled={isRunning || !canRunVideoPrompt}");
  });

  it("keeps prompt composer expand control out of the reference row layout", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("absolute right-4 top-4 z-20");
    expect(source).toContain("{inputReferences.length > 0 && (");
    expect(source).not.toContain('<div className="mb-3 flex items-start gap-3">');
    expect(source).not.toContain('<div className="ml-auto shrink-0">{expandPromptEditorButton}</div>');
  });

  it("keeps frame analysis and prompt reversal as independent auxiliary actions", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("if (!videoUrl || isAnalyzingFrames) return;");
    expect(source).toContain("if (!videoUrl || isReversingPrompt) return;");
    expect(source).toContain("disabled={isAnalyzingFrames}");
    expect(source).toContain("disabled={isReversingPrompt}");
    expect(source).not.toContain('loadingOperation: "frame-analysis"');
    expect(source).not.toContain('loadingOperation: "video-prompt"');
  });

  it("keeps batch replacement out of the source video toolbar", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("onCreateBatchReplacement?.(node)");
    expect(source).not.toContain("shouldShowBatchReplacementAction");
  });

  it("limits hover autoplay to the video frame without forcing the video to stay muted", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8").replace(
      /\r\n/g,
      "\n"
    );
    const hoverAutoplayBlock = source.slice(
      source.indexOf("React.useEffect(() => {\n    const video = videoRef.current;"),
      source.indexOf("React.useEffect(() => {\n    if (node.properties.model")
    );

    expect(source).toContain("const [isVideoFrameHovered, setIsVideoFrameHovered]");
    expect(source).toContain("onMouseEnter={() => setIsVideoFrameHovered(true)}");
    expect(source).toContain("onMouseLeave={() => setIsVideoFrameHovered(false)}");
    expect(hoverAutoplayBlock).toContain("if (!isVideoFrameHovered)");
    expect(source).toContain("hovered: isVideoFrameHovered");
    expect(source).toContain("const isVideoMuted = muted || !audioEnabled");
    expect(source).toContain("muted={isVideoMuted}");
    expect(source).toContain('title={isVideoMuted ? "打开声音" : "静音"}');
    expect(source).not.toContain("muted={isVideoFrameHovered || muted || !audioEnabled}");
    expect(hoverAutoplayBlock).not.toContain("video.muted = true;");
    expect(source).not.toContain("if (!isHovered) {");
  });

  it("rerenders when input reference thumbnails change", () => {
    const source = readFileSync(new URL("./VideoNodeCard.tsx", import.meta.url), "utf8");
    const memoSource = source.slice(source.indexOf("const VideoNodeCard = React.memo"));

    expect(memoSource).toContain("prev.references === next.references");
    expect(memoSource).toContain("prev.resolvedInputs === next.resolvedInputs");
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
