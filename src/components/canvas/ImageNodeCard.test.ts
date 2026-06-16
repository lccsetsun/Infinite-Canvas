import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getImageNodeInputReferences,
  getImagePreviewFrameClassName,
  getImagePreviewNodeWidth,
  getImageNodeDownloadVisibility,
  getFrameStripDownloadFilename,
  getImagePortHandleWrapperStyle,
  getImageNodePortTopStyle,
  getPrimaryImageNodeOssId,
  getFrameStripAdaptiveLayout,
  getSettledImageLoadStatus,
  getResultImageBounds,
  hasFrameExtractionDragStarted,
  resolveEmptyImageNodeSize,
  resolveImageNodeSizePresetData,
  resolveResultImageSize,
  shouldShowImageUploadButton,
  shouldShowImagePromptComposer,
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

describe("getPrimaryImageNodeOssId", () => {
  it("matches the displayed image url to the corresponding oss id", () => {
    expect(
      getPrimaryImageNodeOssId(
        {
          id: "image-1",
          type: "image_node",
          title: "图片",
          x: 0,
          y: 0,
          inputs: [],
          outputs: [],
          properties: {},
          data: {
            imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
            ossIds: ["oss-a", "oss-b"],
          },
        },
        "https://example.com/b.png"
      )
    ).toBe("oss-b");
  });
});

describe("ImageNodeCard prompt composer fullscreen editor", () => {
  it("provides a temporary fullscreen prompt editor with the same image controls", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [expandedPromptEditorOpen, setExpandedPromptEditorOpen]");
    expect(source).toContain('aria-label="放大编辑"');
    expect(source).toContain('aria-label="关闭全屏编辑"');
    expect(source).toContain("onEscape={() => setExpandedPromptEditorOpen(false)}");
    expect(source).toContain("fixed inset-0 z-[220]");
    expect(source).toContain("{expandedPromptEditorNode}");
    expect(source).toContain('panelLayerClassName="z-[240]"');
    expect(source).toContain("bg-violet-500/[0.16] text-violet-50");
    expect(source).toContain("overflow-y-auto pr-3 text-[16px] leading-8 custom-scrollbar");
    expect(source).toContain("Image Size");
    expect(source).toContain("QUANTITY_OPTIONS.map");
  });

  it("allows image generation when linked input resources exist before prompt text is typed", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("const canRunImagePrompt = Boolean(");
    expect(source).toContain("inputReferences.length > 0");
    expect(source).toContain("disabled={isRunning || !canRunImagePrompt}");
  });

  it("does not render check icons inside image model option rows", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");
    const firstModelMenu = source.indexOf("imageModelOptionGroups.builtIn");
    const nextControl = source.indexOf("ImageResolutionPicker", firstModelMenu);
    const modelMenuSource = source.slice(firstModelMenu, nextControl);

    expect(modelMenuSource).not.toContain("<Check");
  });

  it("syncs image node width from the rendered media frame instead of outer chrome", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain(
      "mediaFrameRef.current?.offsetWidth ?? previewNodeRef.current?.offsetWidth"
    );
  });

  it("rerenders when input reference thumbnails change", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");
    const memoSource = source.slice(source.indexOf("const ImageNodeCard = React.memo"));

    expect(memoSource).toContain("prev.references === next.references");
  });

  it("lets internal image drags highlight and drop into video batch replacement slots", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("[data-video-batch-slot-key]");
    expect(source).toContain("data-video-batch-hot");
    expect(source).toContain("onDropImageToVideoBatchReplacement");
    expect(source).toContain("data-video-batch-node-id");
    expect(source).toContain("getPrimaryImageNodeOssId(node, imageUrl)");
  });

  it("passes dragged image oss ids through when replacing a frame-analysis tile", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain(
      "onReplaceFrameImage?.(targetNodeId, targetFrameIndex, drag.url, drag.ossId)"
    );
  });

  it("places batch replacement creation in the frame-analysis image toolbar", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("onCreateBatchReplacement?.(node)");
    expect(source).toContain('Tooltip content="批量替换"');
    expect(source).toContain("isFrameStrip && (");
  });
  it("renders batch replacement result placeholders as separate loading frame cells", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("BATCH_REPLACEMENT_FRAME_PLACEHOLDER");
    expect(source).toContain("isBatchReplacementPlaceholder");
    expect(source).toContain("正在生成图片");
    expect(source).toContain("!isBatchReplacementPlaceholder &&");
    expect(source).toContain("batchReplacementResultCount");
    expect(source).toContain("isLegacyBatchReplacementResultTitle");
    expect(source).toContain('node.data?.loadingOperation === "batch-replacement"');
    expect(source).toContain("hasBatchReplacementResultCount");
    expect(source).toContain('data-batch-replacement-result-grid="true"');
    expect(source).toContain('data-batch-replacement-result-cell="true"');
    expect(source).toContain('url.startsWith("data:image/svg+xml")');
    expect(source).toContain("batchReplacementResultColumnCount");
    expect(source).toContain("Math.min(resolvedImageUrls.length || 1, frameGridColumns)");
    expect(source).not.toContain("Math.min(5, resolvedImageUrls.length || 1)");
    expect(source).toContain("maxColumns: isBatchReplacementResultNode");
    expect(source).toContain("gridTemplateColumns: `repeat(${batchReplacementResultColumnCount}");
  });

  it("uses frame oss id count as a fallback for pending batch replacement result placeholders", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("Array.isArray(node.data?.frameImageOssIds)");
    expect(source).toContain("node.data.frameImageOssIds.length");
  });

  it("renders batch replacement result grids while the result node is still running", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("(!isRunning || isBatchReplacementResultNode)");
  });

  it("does not let single-image bounds syncing resize batch replacement result grids", () => {
    const source = readFileSync(new URL("./ImageNodeCard.tsx", import.meta.url), "utf8").replace(
      /\r\n/g,
      "\n"
    );
    const syncBoundsBlock = source.slice(
      source.indexOf("React.useEffect(() => {\n    if (!imageUrl ||"),
      source.indexOf("React.useEffect(() => {\n    if (!isFrameStrip) return;")
    );

    expect(syncBoundsBlock).toContain(
      "if (!imageUrl || isBatchReplacementResultNode || !previewNodeRef.current) return;"
    );
  });
});

describe("getImagePreviewFrameClassName", () => {
  it("keeps image previews square without rounded corners", () => {
    expect(
      getImagePreviewFrameClassName({
        isImageLoaded: true,
        isSelected: false,
        isStarterPlaceholder: false,
      })
    ).not.toContain("rounded");
  });
});

describe("shouldShowImagePromptComposer", () => {
  it("shows the composer only for selected editable image nodes", () => {
    expect(
      shouldShowImagePromptComposer({
        isFrameStrip: false,
        isRunning: false,
        isSelected: true,
        isSourceAssetNode: false,
        isUploadingNodeAsset: false,
      })
    ).toBe(true);

    expect(
      shouldShowImagePromptComposer({
        isFrameStrip: false,
        isRunning: false,
        isSelected: false,
        isSourceAssetNode: false,
        isUploadingNodeAsset: false,
      })
    ).toBe(false);
  });
});

describe("getResultImageBounds", () => {
  it("uses compact bounds for image prompt starter placeholders", () => {
    expect(getResultImageBounds("16:9", true)).toEqual({
      maxWidth: 540,
      maxHeight: 540,
    });
  });

  it("uses regular image bounds for extracted frame child nodes", () => {
    expect(getResultImageBounds("16:9", false, true)).toEqual({
      maxWidth: 540,
      maxHeight: 540,
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
  it("uses uploaded image display dimensions while the upload preview is still loading", () => {
    expect(
      resolveEmptyImageNodeSize({
        aspectRatio: "16:9",
        displayHeight: 476,
        displayWidth: 220,
        isUploadPlaceholder: true,
        resolution: "1K",
      })
    ).toEqual({
      displayHeight: 476,
      displayWidth: 220,
      nodeHeight: 476,
      nodeWidth: 220,
      portCenterY: 238,
    });
  });

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

describe("resolveImageNodeSizePresetData", () => {
  it("resolves node dimensions from the selected size preset for empty image nodes", () => {
    expect(
      resolveImageNodeSizePresetData({
        aspectRatio: "9:16",
        hasImageUrl: false,
        isExtractedFrameNode: false,
        isFrameStrip: false,
        isUploadPlaceholder: false,
        resolution: "2K",
      })
    ).toEqual({
      imageDisplayHeight: 540,
      imageDisplayWidth: 304,
      imageNodeHeight: 540,
      imageNodeWidth: 304,
      imagePortCenterY: 270,
    });
  });

  it("does not resize image nodes that already have media", () => {
    expect(
      resolveImageNodeSizePresetData({
        aspectRatio: "1:1",
        hasImageUrl: true,
        isExtractedFrameNode: false,
        isFrameStrip: false,
        isUploadPlaceholder: false,
        resolution: "4K",
      })
    ).toBeNull();
  });

  it("does not resize frame-strip image grids from the size picker", () => {
    expect(
      resolveImageNodeSizePresetData({
        aspectRatio: "1:1",
        hasImageUrl: false,
        isExtractedFrameNode: false,
        isFrameStrip: true,
        isUploadPlaceholder: false,
        resolution: "4K",
      })
    ).toBeNull();
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

describe("getImageNodeDownloadVisibility", () => {
  it("hides the top toolbar download action for frame analysis strips", () => {
    expect(getImageNodeDownloadVisibility({ isFrameStrip: true })).toEqual({
      showFrameTileDownload: true,
      showTopToolbarDownload: false,
    });
  });

  it("keeps the top toolbar download action for regular image nodes", () => {
    expect(getImageNodeDownloadVisibility({ isFrameStrip: false })).toEqual({
      showFrameTileDownload: false,
      showTopToolbarDownload: true,
    });
  });
});

describe("getFrameStripDownloadFilename", () => {
  it("builds a stable per-frame image filename", () => {
    expect(
      getFrameStripDownloadFilename({
        frameIndex: 1,
        nodeTitle: "逐帧分析 1",
        timestamp: 1710000000000,
        url: "https://oss.example.com/frame-2.webp?x=1",
      })
    ).toBe("逐帧分析-1-frame-2-1710000000000.webp");
  });
});

describe("getFrameStripAdaptiveLayout", () => {
  it("can lock frame analysis tiles to the saved node size", () => {
    const layout = getFrameStripAdaptiveLayout({
      fallbackTileHeight: 432,
      fallbackTileWidth: 248,
      fixedTileSize: true,
      imageSizes: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [index, { width: 496, height: 864 }])
      ),
      imageUrls: Array.from({ length: 7 }, (_, index) => `frame-${index + 1}.png`),
      maxColumns: 5,
    });

    expect(layout.tiles).toHaveLength(7);
    expect(layout.tiles[0]).toEqual({ height: 432, width: 248 });
    expect(layout.width).toBe(5 * 248 + 4 + 20);
    expect(layout.height).toBe(2 * 432 + 1 + 20);
  });

  it("keeps five adaptive frames per row without fixed empty cells", () => {
    const layout = getFrameStripAdaptiveLayout({
      fallbackTileHeight: 160,
      fallbackTileWidth: 90,
      imageSizes: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [index, { width: 720, height: 1280 }])
      ),
      imageUrls: Array.from({ length: 7 }, (_, index) => `frame-${index + 1}.png`),
      maxColumns: 5,
    });

    expect(layout.tiles).toHaveLength(7);
    expect(layout.tiles[0]).toEqual({ height: 320, width: 180 });
    expect(layout.width).toBe(5 * 180 + 4 + 20);
    expect(layout.height).toBe(2 * 320 + 1 + 20);
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

  it("hides the upload button while the node is running", () => {
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: true,
        isImageLoadFailed: false,
        isRunning: true,
        isUploadingNodeAsset: false,
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
