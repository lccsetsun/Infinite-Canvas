import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  Grid3X3,
  Image as ImageIcon,
  Loader2,
  Plus,
  Undo2,
  Upload,
  Wand2,
} from "lucide-react";
import { GraphNode } from "../../types";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { isSourceNode } from "../../utils/sourceNodes";
import { Tooltip } from "../common/Tooltip";
import { downloadMediaAsset, extensionFromAssetUrl } from "../../utils/mediaAssets";
import { uploadFileToOss } from "../../features/resource/ossApi";
import { ReferencePreviewCard } from "./ReferencePreviewCard";
import { getMediaNodeLoadingLabel, isMediaNodeRunning } from "../../utils/mediaNodeLoadingState";
import { ImageResolutionPicker } from "./ImageResolutionPicker";
import { PromptTokenEditor } from "./PromptTokenEditor";
import {
  AI_MODEL_TYPES,
  getModelOptionGroups,
  type AiModelsByType,
} from "../../features/api/aiModelCatalog";
import {
  getFloatingMenuPosition,
  type FloatingMenuPosition,
} from "../../utils/floatingMenuPosition";
import { stringifyInputReferenceValues } from "../../utils/inputReferenceValues";

interface ImageNodeCardProps {
  node: GraphNode;
  selected: boolean;
  apiConfig?: {
    remoteModelsByType?: AiModelsByType;
  };
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: unknown) => void;
  onUpdateData?: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onSetPrimaryImageResult?: (nodeId: string, imageUrl: string, imageIndex: number) => void;
  onExtractFrameImage?: (
    nodeId: string,
    frameIndex: number,
    clientPoint?: { clientX: number; clientY: number }
  ) => void;
  onReplaceExtractedFrame?: (nodeId: string) => void;
  onReplaceFrameImage?: (nodeId: string, frameIndex: number, replacementUrl: string) => void;
  onSyncImagePromptStarterLayout?: (nodeId: string, imageNodeWidth: number) => void;
  onSplitImageGrid?: (
    nodeId: string,
    imageUrl: string,
    gridRows: number,
    gridCols: number,
    cellIndices: number[]
  ) => void;
  onPreview?: (
    content: string,
    title?: string,
    nodeId?: string,
    items?: string[],
    currentIndex?: number
  ) => void;
  resolvedInputs?: Record<string, unknown>;
  onRun?: (nodeId: string) => void;
  onNotice?: (message: string) => void;
  isLinkingOnCanvas?: boolean;
  linkFromNodeId?: string | null;
  linkFromOutputIndex?: number | null;
  linkToNodeId?: string | null;
  linkToInputIndex?: number | null;
  onBeginCanvasLink?: (
    nodeId: string,
    outputIndex: number,
    clientX: number,
    clientY: number
  ) => void;
  onFinishCanvasLink?: (nodeId?: string, inputIndex?: number) => void;
  onHoverCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  onLeaveCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  getCanvasLinkTargetIssue?: (nodeId: string, inputIndex: number) => string | null;
}

const MEDIA_NODE_FOOTPRINT_WIDTH = 540;
const MEDIA_NODE_FOOTPRINT_HEIGHT = 540;
const EXTRACTED_FRAME_IMAGE_MAX_WIDTH = MEDIA_NODE_FOOTPRINT_WIDTH;
const EXTRACTED_FRAME_IMAGE_MAX_HEIGHT = MEDIA_NODE_FOOTPRINT_HEIGHT;
const EMPTY_NODE_FOOTPRINT_WIDTH = 540;
const EMPTY_NODE_FOOTPRINT_HEIGHT = 540;
const FRAME_STRIP_TILE_MIN_WIDTH = 168;
const FRAME_STRIP_TILE_MIN_HEIGHT = 96;
const FRAME_STRIP_TILE_GAP = 1;
const FRAME_STRIP_TILE_SCALE = 2;
const FRAME_STRIP_PADDING = 10;
const IMAGE_FRAME_DROP_LONG_PRESS_MS = 450;
const QUANTITY_OPTIONS = ["1张", "2张", "3张", "4张"];
const VISIBLE_THUMBNAIL_COUNT = 3;
const GRID_SPLIT_PRESETS = [
  { label: "4宫格 (2×2)", rows: 2, cols: 2 },
  { label: "9宫格 (3×3)", rows: 3, cols: 3 },
  { label: "16宫格 (4×4)", rows: 4, cols: 4 },
  { label: "25宫格 (5×5)", rows: 5, cols: 5 },
] as const;
const CUSTOM_GRID_MAX_ROWS = 5;
const CUSTOM_GRID_MAX_COLS = 5;
const EMPTY_IMAGE_NODE_MAIN_CARD_CENTER_Y = 145;
const IMAGE_PORT_HANDLE_SIZE = 36;
const FRAME_EXTRACTION_DRAG_THRESHOLD_PX = 8;
const IMAGE_NODE_REFERENCE_IGNORED_KEYS = new Set([
  "negative_prompt",
  "aspect_ratio",
  "quantity",
  "n",
  "prompt_optimizer",
  "model",
]);
const IMAGE_NODE_TEXT_INPUT_KEYS = new Set([
  "prompt",
  "text",
  "原始提示词",
  "用户提示词",
  "user_prompt",
]);
function getImageModelLabel(model: string) {
  return model;
}

export function getImagePreviewFrameClassName({
  isImageLoaded,
  isSelected,
  isStarterPlaceholder,
}: {
  isImageLoaded: boolean;
  isSelected: boolean;
  isStarterPlaceholder: boolean;
}) {
  const surfaceClassName = isStarterPlaceholder
    ? "bg-transparent"
    : isImageLoaded
      ? "bg-white"
      : "border border-slate-500/14 bg-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]";
  const selectedClassName = isSelected
    ? "shadow-[0_0_0_1.5px_rgba(192,132,252,0.58),0_0_0_6px_rgba(139,92,246,0.14),0_0_38px_rgba(109,40,217,0.18)]"
    : "";

  return `mx-auto overflow-hidden rounded-[8px] ${surfaceClassName} ${selectedClassName}`;
}

export function shouldShowImageUploadButton({
  hasImageUrl,
  isImageLoaded,
  isImageLoadFailed,
  isRunning = false,
  isUploadingNodeAsset = false,
}: {
  hasImageUrl: boolean;
  isImageLoaded: boolean;
  isImageLoadFailed: boolean;
  isRunning?: boolean;
  isUploadingNodeAsset?: boolean;
}) {
  if (isRunning) return false;
  if (isUploadingNodeAsset) return false;
  return !hasImageUrl || isImageLoaded || isImageLoadFailed;
}

export function hasFrameExtractionDragStarted({
  clientX,
  clientY,
  startClientX,
  startClientY,
  threshold = FRAME_EXTRACTION_DRAG_THRESHOLD_PX,
}: {
  clientX: number;
  clientY: number;
  startClientX: number;
  startClientY: number;
  threshold?: number;
}) {
  return Math.hypot(clientX - startClientX, clientY - startClientY) >= threshold;
}

export function getImageNodePortTopStyle({
  emptyImageNodePortCenterY,
  hasImageUrl,
  imagePortCenterY,
}: {
  emptyImageNodePortCenterY?: number;
  hasImageUrl: boolean;
  imagePortCenterY?: number;
}) {
  if (!hasImageUrl) return emptyImageNodePortCenterY ?? EMPTY_IMAGE_NODE_MAIN_CARD_CENTER_Y;
  return imagePortCenterY ?? "50%";
}

export function getImagePortHandleWrapperStyle(top: number | string): React.CSSProperties {
  return {
    top,
    marginTop: -(IMAGE_PORT_HANDLE_SIZE / 2),
  };
}

export function getImagePreviewNodeWidth({
  frameStripWidth,
  isFrameStrip,
  resultImageWidth,
}: {
  frameStripWidth: number;
  isFrameStrip: boolean;
  resultImageWidth: number;
}) {
  return isFrameStrip ? frameStripWidth : resultImageWidth;
}

export function getFrameStripAdaptiveLayout({
  fallbackTileHeight,
  fallbackTileWidth,
  imageSizes,
  imageUrls,
  maxColumns,
}: {
  fallbackTileHeight: number;
  fallbackTileWidth: number;
  imageSizes?: Record<number, { width: number; height: number }>;
  imageUrls: string[];
  maxColumns: number;
}) {
  const safeFallbackWidth = Math.max(1, fallbackTileWidth);
  const safeFallbackHeight = Math.max(1, fallbackTileHeight);
  const safeMaxColumns = Math.max(1, maxColumns);
  const targetHeight = safeFallbackHeight * FRAME_STRIP_TILE_SCALE;
  const fallbackRatio = safeFallbackWidth / safeFallbackHeight;
  const tiles = imageUrls.map((_, index) => {
    const size = imageSizes?.[index];
    const ratio =
      size && size.width > 0 && size.height > 0 ? size.width / size.height : fallbackRatio;
    return {
      height: targetHeight,
      width: Math.max(1, Math.round(targetHeight * ratio)),
    };
  });

  const rowCount = Math.max(1, Math.ceil(Math.max(1, tiles.length) / safeMaxColumns));
  let layoutWidth = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowTiles = tiles.slice(rowIndex * safeMaxColumns, (rowIndex + 1) * safeMaxColumns);
    const rowWidth =
      rowTiles.reduce((sum, tile) => sum + tile.width, 0) +
      Math.max(0, rowTiles.length - 1) * FRAME_STRIP_TILE_GAP;
    if (rowWidth > layoutWidth) {
      layoutWidth = rowWidth;
    }
  }
  layoutWidth = Math.max(layoutWidth, safeFallbackWidth);

  return {
    height: Math.max(
      safeFallbackHeight,
      rowCount * targetHeight +
        Math.max(0, rowCount - 1) * FRAME_STRIP_TILE_GAP +
        FRAME_STRIP_PADDING * 2
    ),
    tiles,
    width: layoutWidth + FRAME_STRIP_PADDING * 2,
  };
}

export function getSettledImageLoadStatus({
  complete,
  naturalWidth,
}: {
  complete: boolean;
  naturalWidth: number;
}): "idle" | "loaded" | "error" {
  if (!complete) return "idle";
  return naturalWidth > 0 ? "loaded" : "error";
}

export type ImageNodeInputReferenceKind = "text" | "image" | "audio" | "video";

export interface ImageNodeInputReference {
  key: string;
  kind: ImageNodeInputReferenceKind;
  label: string;
  title: string;
  value: string;
}

function inferImageNodeInputReferenceKind(
  key: string,
  value: string
): ImageNodeInputReferenceKind | null {
  const normalizedKey = key.toLowerCase();
  const normalizedValue = value.toLowerCase();
  if (
    normalizedKey.includes("image") ||
    normalizedValue.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(normalizedValue)
  ) {
    return "image";
  }
  if (
    normalizedKey.includes("audio") ||
    /\.(mp3|wav|m4a|aac|flac|ogg)(\?.*)?$/.test(normalizedValue)
  ) {
    return "audio";
  }
  if (normalizedKey.includes("video") || /\.(mp4|mov|webm|m4v|avi)(\?.*)?$/.test(normalizedValue)) {
    return "video";
  }
  if (IMAGE_NODE_TEXT_INPUT_KEYS.has(key) || normalizedKey.includes("prompt")) return "text";
  return null;
}

function getInputReferenceLabel(kind: ImageNodeInputReferenceKind) {
  if (kind === "image") return "图片";
  if (kind === "audio") return "音频";
  if (kind === "video") return "视频";
  return "文本";
}

export function getImageNodeInputReferences(
  resolvedInputs: Record<string, unknown> | undefined
): ImageNodeInputReference[] {
  if (!resolvedInputs) return [];
  return Object.entries(resolvedInputs).reduce<ImageNodeInputReference[]>(
    (references, [key, rawValue]) => {
      if (IMAGE_NODE_REFERENCE_IGNORED_KEYS.has(key)) return references;
      stringifyInputReferenceValues(rawValue).forEach((value) => {
        const kind = inferImageNodeInputReferenceKind(key, value);
        if (!kind) return;
        references.push({
          key,
          kind,
          label: getInputReferenceLabel(kind),
          title: getInputReferenceLabel(kind),
          value,
        });
      });
      return references;
    },
    []
  );
}

function parseAspectRatio(ratio: string): number {
  const [w, h] = ratio.split(":").map((value) => Number.parseFloat(value));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return 16 / 9;
  return w / h;
}

function fitImageSize(
  naturalSize: { width: number; height: number } | null,
  aspectRatio: string,
  maxWidth: number,
  maxHeight: number
) {
  if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
    const scale = Math.min(maxWidth / naturalSize.width, maxHeight / naturalSize.height);
    return {
      width: Math.round(naturalSize.width * scale),
      height: Math.round(naturalSize.height * scale),
    };
  }

  const ratio = parseAspectRatio(aspectRatio);
  if (ratio >= maxWidth / maxHeight)
    return { width: maxWidth, height: Math.round(maxWidth / ratio) };
  return { width: Math.round(maxHeight * ratio), height: maxHeight };
}

function fitMediaNodePreviewSize(naturalSize: { width: number; height: number }) {
  return fitImageSize(naturalSize, "16:9", MEDIA_NODE_FOOTPRINT_WIDTH, MEDIA_NODE_FOOTPRINT_HEIGHT);
}

export function resolveEmptyImageNodeSize({
  aspectRatio,
  displayHeight,
  displayWidth,
  isExtractedFrameNode = false,
  isUploadPlaceholder = false,
  resolution,
}: {
  aspectRatio: string;
  displayHeight?: number;
  displayWidth?: number;
  isExtractedFrameNode?: boolean;
  isUploadPlaceholder?: boolean;
  resolution: string;
}) {
  void resolution;
  void isUploadPlaceholder;
  void isExtractedFrameNode;
  if (isFinitePositiveNumber(displayWidth) && isFinitePositiveNumber(displayHeight)) {
    const width = Math.min(Math.round(displayWidth), EMPTY_NODE_FOOTPRINT_WIDTH);
    const height = Math.min(Math.round(displayHeight), EMPTY_NODE_FOOTPRINT_HEIGHT);
    return {
      displayHeight: height,
      displayWidth: width,
      nodeHeight: height,
      nodeWidth: width,
      portCenterY: Math.round(height / 2),
    };
  }

  const displaySize = fitImageSize(
    null,
    aspectRatio,
    EMPTY_NODE_FOOTPRINT_WIDTH,
    EMPTY_NODE_FOOTPRINT_HEIGHT
  );

  return {
    displayHeight: displaySize.height,
    displayWidth: displaySize.width,
    nodeHeight: displaySize.height,
    nodeWidth: displaySize.width,
    portCenterY: Math.round(displaySize.height / 2),
  };
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function getResultImageBounds(
  aspectRatio: string,
  isUploadPlaceholder = false,
  isExtractedFrameNode = false
) {
  if (isExtractedFrameNode) {
    return {
      maxWidth: EXTRACTED_FRAME_IMAGE_MAX_WIDTH,
      maxHeight: EXTRACTED_FRAME_IMAGE_MAX_HEIGHT,
    };
  }

  if (isUploadPlaceholder) {
    return {
      maxWidth: MEDIA_NODE_FOOTPRINT_WIDTH,
      maxHeight: MEDIA_NODE_FOOTPRINT_HEIGHT,
    };
  }

  if (aspectRatio === "1:1") {
    return {
      maxWidth: MEDIA_NODE_FOOTPRINT_WIDTH,
      maxHeight: MEDIA_NODE_FOOTPRINT_HEIGHT,
    };
  }

  return {
    maxWidth: MEDIA_NODE_FOOTPRINT_WIDTH,
    maxHeight: MEDIA_NODE_FOOTPRINT_HEIGHT,
  };
}

export function resolveResultImageSize(
  dimensions: {
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
    imageDisplayWidth?: number;
    imageDisplayHeight?: number;
  },
  aspectRatio: string,
  isUploadPlaceholder = false,
  isExtractedFrameNode = false
) {
  const bounds = getResultImageBounds(aspectRatio, isUploadPlaceholder, isExtractedFrameNode);
  if (
    isFinitePositiveNumber(dimensions.imageNaturalWidth) &&
    isFinitePositiveNumber(dimensions.imageNaturalHeight)
  ) {
    return fitImageSize(
      {
        width: dimensions.imageNaturalWidth,
        height: dimensions.imageNaturalHeight,
      },
      aspectRatio,
      bounds.maxWidth,
      bounds.maxHeight
    );
  }

  if (
    isFinitePositiveNumber(dimensions.imageDisplayWidth) &&
    isFinitePositiveNumber(dimensions.imageDisplayHeight)
  ) {
    return {
      width: Math.min(Math.round(dimensions.imageDisplayWidth), bounds.maxWidth),
      height: Math.min(Math.round(dimensions.imageDisplayHeight), bounds.maxHeight),
    };
  }

  return fitImageSize(null, aspectRatio, bounds.maxWidth, bounds.maxHeight);
}

function ImageNodeCardImpl({
  node,
  selected,
  apiConfig,
  onSelect,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
  onDragStart,
  onUpdateProperty,
  onUpdateData,
  onSetPrimaryImageResult,
  onExtractFrameImage,
  onReplaceExtractedFrame: _onReplaceExtractedFrame,
  onReplaceFrameImage,
  onSyncImagePromptStarterLayout,
  onSplitImageGrid,
  onPreview,
  resolvedInputs,
  onRun,
  onNotice,
  isLinkingOnCanvas,
  linkFromNodeId,
  linkFromOutputIndex,
  linkToNodeId,
  linkToInputIndex,
  onBeginCanvasLink,
  onFinishCanvasLink,
  onHoverCanvasLinkTarget,
  onLeaveCanvasLinkTarget,
  getCanvasLinkTargetIssue,
}: ImageNodeCardProps) {
  const isRunning = isMediaNodeRunning({
    data: node.data,
    properties: node.properties,
  });
  const [isHovered, setIsHovered] = React.useState(false);
  const [openSelect, setOpenSelect] = React.useState<"quantity" | null>(null);
  const [gridMenuOpen, setGridMenuOpen] = React.useState(false);
  const [customGridOpen, setCustomGridOpen] = React.useState(false);
  const [hoverCustomGrid, setHoverCustomGrid] = React.useState<{
    rows: number;
    cols: number;
  } | null>(null);
  const [activeGridSelection, setActiveGridSelection] = React.useState<{
    rows: number;
    cols: number;
  } | null>(null);
  const [selectedGridCells, setSelectedGridCells] = React.useState<number[]>([]);
  const [hoveredGridCell, setHoveredGridCell] = React.useState<number | null>(null);
  const controlsRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuPortalRef = React.useRef<HTMLDivElement | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [modelMenuPosition, setModelMenuPosition] = React.useState<FloatingMenuPosition | null>(
    null
  );
  const gridMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [activeImageIndex, setActiveImageIndex] = React.useState(() => {
    const index = node.data?.activeImageIndex;
    return typeof index === "number" && index >= 0 ? index : 0;
  });
  const [naturalImageSize, setNaturalImageSize] = React.useState<{
    width: number;
    height: number;
  } | null>(() => {
    const width = node.data?.imageNaturalWidth;
    const height = node.data?.imageNaturalHeight;
    return typeof width === "number" && typeof height === "number" ? { width, height } : null;
  });
  const [frameImageSizes, setFrameImageSizes] = React.useState<
    Record<number, { width: number; height: number }>
  >({});
  const previewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const mediaFrameRef = React.useRef<HTMLDivElement | null>(null);
  const imageElementRef = React.useRef<HTMLImageElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const frameExtractionDragRef = React.useRef<{
    element: HTMLElement;
    frameIndex: number;
    originClientX: number;
    originClientY: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    thumbHeight: number;
    thumbWidth: number;
    url: string;
    dragging: boolean;
  } | null>(null);
  const frameExtractionDragCleanupRef = React.useRef<(() => void) | null>(null);
  const frameExtractionOverlayRef = React.useRef<{
    line: SVGLineElement;
    origin: SVGCircleElement;
    root: HTMLDivElement;
    thumb: HTMLDivElement;
  } | null>(null);
  const frameExtractionLongPressTimerRef = React.useRef<number | null>(null);
  const imageFrameDropDragRef = React.useRef<{
    dragging: boolean;
    element: HTMLElement;
    originClientX: number;
    originClientY: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    thumbHeight: number;
    thumbWidth: number;
    url: string;
  } | null>(null);
  const imageFrameDropCleanupRef = React.useRef<(() => void) | null>(null);
  const imageFrameDropOverlayRef = React.useRef<{
    line: SVGLineElement;
    root: HTMLDivElement;
    thumb: HTMLDivElement;
  } | null>(null);
  const imageFrameDropHotTargetRef = React.useRef<HTMLElement | null>(null);
  const imageFrameDropLongPressTimerRef = React.useRef<number | null>(null);
  const [isUploadingAsset, setIsUploadingAsset] = React.useState(false);
  const isUploadingNodeAsset = node.data?.uploadingAsset === true || isUploadingAsset;
  const [imageLoadState, setImageLoadState] = React.useState<{
    status: "idle" | "loaded" | "error";
    url: string;
  }>({ status: "idle", url: "" });

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, [
    "prompt",
    "text",
    "原始提示词",
    "用户提示词",
  ]);
  const inputReferences = React.useMemo(
    () => getImageNodeInputReferences(resolvedInputs),
    [resolvedInputs]
  );
  const hasNonTextInputReferences = inputReferences.some((reference) => reference.kind !== "text");
  const promptText = (node.properties.text as string) || "";
  const imageUrls =
    Array.isArray(node.data?.imageUrls) && node.data?.imageUrls.length
      ? node.data.imageUrls.filter((url): url is string => typeof url === "string" && Boolean(url))
      : [];
  const fallbackImageUrl =
    (node.data?.imageUrl as string) || (node.properties.imageUrl as string) || "";
  const resolvedImageUrls = imageUrls.length
    ? imageUrls
    : fallbackImageUrl
      ? [fallbackImageUrl]
      : [];
  const imageUrl = resolvedImageUrls[activeImageIndex] || resolvedImageUrls[0] || "";
  const isSourceAssetNode = isSourceNode(node);
  const isFrameStrip = node.data?.isFrameStrip === true;
  const isExtractedFrameNode =
    typeof node.data?.extractedFrameSourceNodeId === "string" &&
    typeof node.data?.extractedFrameIndex === "number";
  const frameGridColumns = Math.max(1, Math.min(8, Math.round(node.data?.frameGridColumns ?? 5)));
  const frameGridRows = Math.max(
    1,
    Math.ceil(Math.max(1, resolvedImageUrls.length) / frameGridColumns)
  );
  const frameTileWidth =
    typeof node.data?.frameTileWidth === "number" && node.data.frameTileWidth > 0
      ? Math.round(node.data.frameTileWidth)
      : FRAME_STRIP_TILE_MIN_WIDTH;
  const frameTileHeight =
    typeof node.data?.frameTileHeight === "number" && node.data.frameTileHeight > 0
      ? Math.round(node.data.frameTileHeight)
      : FRAME_STRIP_TILE_MIN_HEIGHT;
  const cleanupFrameExtractionDragListeners = React.useCallback(() => {
    frameExtractionDragCleanupRef.current?.();
    frameExtractionDragCleanupRef.current = null;
    if (frameExtractionLongPressTimerRef.current !== null) {
      window.clearTimeout(frameExtractionLongPressTimerRef.current);
      frameExtractionLongPressTimerRef.current = null;
    }
  }, []);
  const destroyFrameExtractionOverlay = React.useCallback(() => {
    frameExtractionOverlayRef.current?.root.remove();
    frameExtractionOverlayRef.current = null;
  }, []);
  const createFrameExtractionOverlay = React.useCallback(
    (
      drag: NonNullable<typeof frameExtractionDragRef.current>,
      clientX: number,
      clientY: number
    ) => {
      destroyFrameExtractionOverlay();

      const root = document.createElement("div");
      root.setAttribute("data-frame-drag-overlay", "true");
      Object.assign(root.style, {
        inset: "0",
        pointerEvents: "none",
        position: "fixed",
        zIndex: "2147483647",
      });

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      Object.assign(svg.style, {
        height: "100vh",
        inset: "0",
        overflow: "visible",
        position: "fixed",
        width: "100vw",
      });
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
      filter.setAttribute("id", `frame-drag-native-glow-${node.id}`);
      filter.setAttribute("x", "-40%");
      filter.setAttribute("y", "-40%");
      filter.setAttribute("width", "180%");
      filter.setAttribute("height", "180%");
      const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
      blur.setAttribute("stdDeviation", "3.2");
      blur.setAttribute("result", "blur");
      const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
      const blurNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
      blurNode.setAttribute("in", "blur");
      const sourceNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
      sourceNode.setAttribute("in", "SourceGraphic");
      merge.append(blurNode, sourceNode);
      filter.append(blur, merge);
      defs.append(filter);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(drag.originClientX));
      line.setAttribute("y1", String(drag.originClientY));
      line.setAttribute("x2", String(clientX));
      line.setAttribute("y2", String(clientY));
      line.setAttribute("stroke", "rgba(165,180,252,0.96)");
      line.setAttribute("stroke-width", "2.5");
      line.setAttribute("stroke-dasharray", "8 8");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("filter", `url(#frame-drag-native-glow-${node.id})`);
      const origin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      origin.setAttribute("cx", String(drag.originClientX));
      origin.setAttribute("cy", String(drag.originClientY));
      origin.setAttribute("r", "4.5");
      origin.setAttribute("fill", "rgba(103,232,249,0.98)");
      origin.setAttribute("filter", `url(#frame-drag-native-glow-${node.id})`);
      svg.append(defs, line, origin);

      const thumb = document.createElement("div");
      thumb.setAttribute("data-frame-drag-thumb", "true");
      Object.assign(thumb.style, {
        background: "rgba(13,20,33,0.9)",
        border: "1px solid rgba(207,250,254,0.28)",
        borderRadius: "12px",
        boxShadow: "0 16px 34px -18px rgba(0,0,0,0.95), 0 0 24px rgba(129,140,248,0.2)",
        height: `${drag.thumbHeight}px`,
        left: `${clientX - drag.thumbWidth / 2}px`,
        overflow: "hidden",
        position: "fixed",
        top: `${clientY - drag.thumbHeight / 2}px`,
        width: `${drag.thumbWidth}px`,
      });
      const thumbImage = document.createElement("img");
      thumbImage.src = drag.url;
      thumbImage.alt = "";
      thumbImage.draggable = false;
      Object.assign(thumbImage.style, {
        display: "block",
        height: "100%",
        objectFit: "contain",
        width: "100%",
      });
      thumb.append(thumbImage);

      root.append(svg, thumb);
      document.body.appendChild(root);
      frameExtractionOverlayRef.current = { line, origin, root, thumb };
    },
    [destroyFrameExtractionOverlay, node.id]
  );
  const updateFrameExtractionOverlay = React.useCallback((clientX: number, clientY: number) => {
    const overlay = frameExtractionOverlayRef.current;
    if (!overlay) return;
    overlay.line.setAttribute("x2", String(clientX));
    overlay.line.setAttribute("y2", String(clientY));
    const drag = frameExtractionDragRef.current;
    const thumbWidth = drag?.thumbWidth ?? overlay.thumb.offsetWidth;
    const thumbHeight = drag?.thumbHeight ?? overlay.thumb.offsetHeight;
    overlay.thumb.style.left = `${clientX - thumbWidth / 2}px`;
    overlay.thumb.style.top = `${clientY - thumbHeight / 2}px`;
  }, []);
  const updateFrameExtractionDragPreview = React.useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const drag = frameExtractionDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      if (!drag.dragging) return;
      if (!frameExtractionOverlayRef.current) {
        createFrameExtractionOverlay(drag, clientX, clientY);
        return;
      }
      updateFrameExtractionOverlay(clientX, clientY);
    },
    [createFrameExtractionOverlay, updateFrameExtractionOverlay]
  );
  const finishFrameExtractionDrag = React.useCallback(
    (pointerId: number, clientX: number, clientY: number, canceled = false) => {
      const drag = frameExtractionDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      cleanupFrameExtractionDragListeners();
      if (drag.element.hasPointerCapture(pointerId)) {
        drag.element.releasePointerCapture(pointerId);
      }
      frameExtractionDragRef.current = null;
      destroyFrameExtractionOverlay();
      if (canceled) return;
      if (drag.dragging) {
        onExtractFrameImage?.(node.id, drag.frameIndex, {
          clientX,
          clientY,
        });
        return;
      }
      setActiveImageIndex(drag.frameIndex);
      onSetPrimaryImageResult?.(node.id, drag.url, drag.frameIndex);
    },
    [
      cleanupFrameExtractionDragListeners,
      destroyFrameExtractionOverlay,
      node.id,
      onExtractFrameImage,
      onSetPrimaryImageResult,
    ]
  );
  const beginFrameExtractionDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, frameIndex: number, url: string) => {
      if (!onExtractFrameImage || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupFrameExtractionDragListeners();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      frameExtractionDragRef.current = {
        element: event.currentTarget,
        frameIndex,
        originClientX: rect.left + rect.width / 2,
        originClientY: rect.top + rect.height / 2,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        thumbHeight: Math.max(1, Math.round(rect.height / 2)),
        thumbWidth: Math.max(1, Math.round(rect.width / 2)),
        url,
        dragging: false,
      };
      let lastClientX = event.clientX;
      let lastClientY = event.clientY;
      frameExtractionLongPressTimerRef.current = window.setTimeout(() => {
        const drag = frameExtractionDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.dragging = true;
        frameExtractionLongPressTimerRef.current = null;
        updateFrameExtractionDragPreview(event.pointerId, lastClientX, lastClientY);
      }, IMAGE_FRAME_DROP_LONG_PRESS_MS);

      const handleWindowPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        lastClientX = moveEvent.clientX;
        lastClientY = moveEvent.clientY;
        const drag = frameExtractionDragRef.current;
        if (
          drag &&
          !drag.dragging &&
          hasFrameExtractionDragStarted({
            clientX: moveEvent.clientX,
            clientY: moveEvent.clientY,
            startClientX: drag.startClientX,
            startClientY: drag.startClientY,
          })
        ) {
          if (drag.element.hasPointerCapture(moveEvent.pointerId)) {
            drag.element.releasePointerCapture(moveEvent.pointerId);
          }
          cleanupFrameExtractionDragListeners();
          frameExtractionDragRef.current = null;
          destroyFrameExtractionOverlay();
          return;
        }
        updateFrameExtractionDragPreview(moveEvent.pointerId, moveEvent.clientX, moveEvent.clientY);
      };
      const handleWindowPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== event.pointerId) return;
        upEvent.preventDefault();
        upEvent.stopPropagation();
        finishFrameExtractionDrag(upEvent.pointerId, upEvent.clientX, upEvent.clientY);
      };
      const handleWindowPointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== event.pointerId) return;
        cancelEvent.preventDefault();
        cancelEvent.stopPropagation();
        finishFrameExtractionDrag(
          cancelEvent.pointerId,
          cancelEvent.clientX,
          cancelEvent.clientY,
          true
        );
      };

      window.addEventListener("pointermove", handleWindowPointerMove, true);
      window.addEventListener("pointerup", handleWindowPointerUp, true);
      window.addEventListener("pointercancel", handleWindowPointerCancel, true);
      frameExtractionDragCleanupRef.current = () => {
        window.removeEventListener("pointermove", handleWindowPointerMove, true);
        window.removeEventListener("pointerup", handleWindowPointerUp, true);
        window.removeEventListener("pointercancel", handleWindowPointerCancel, true);
      };
    },
    [
      cleanupFrameExtractionDragListeners,
      finishFrameExtractionDrag,
      onExtractFrameImage,
      updateFrameExtractionDragPreview,
    ]
  );
  const moveFrameExtractionDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = frameExtractionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      updateFrameExtractionDragPreview(event.pointerId, event.clientX, event.clientY);
    },
    [updateFrameExtractionDragPreview]
  );
  const endFrameExtractionDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, fallbackFrameIndex: number, fallbackUrl: string) => {
      const drag = frameExtractionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        setActiveImageIndex(fallbackFrameIndex);
        onSetPrimaryImageResult?.(node.id, fallbackUrl, fallbackFrameIndex);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      finishFrameExtractionDrag(event.pointerId, event.clientX, event.clientY);
    },
    [finishFrameExtractionDrag, node.id, onSetPrimaryImageResult]
  );
  const cancelFrameExtractionDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = frameExtractionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      finishFrameExtractionDrag(event.pointerId, event.clientX, event.clientY, true);
    },
    [finishFrameExtractionDrag]
  );
  React.useEffect(
    () => () => {
      cleanupFrameExtractionDragListeners();
      destroyFrameExtractionOverlay();
    },
    [cleanupFrameExtractionDragListeners, destroyFrameExtractionOverlay]
  );
  const cleanupImageFrameDropListeners = React.useCallback(() => {
    imageFrameDropCleanupRef.current?.();
    imageFrameDropCleanupRef.current = null;
    if (imageFrameDropLongPressTimerRef.current !== null) {
      window.clearTimeout(imageFrameDropLongPressTimerRef.current);
      imageFrameDropLongPressTimerRef.current = null;
    }
  }, []);
  const clearImageFrameDropHotTarget = React.useCallback(() => {
    const target = imageFrameDropHotTargetRef.current;
    if (!target) return;
    target.removeAttribute("data-frame-drop-hot");
    target.style.outline = "";
    target.style.outlineOffset = "";
    target.style.boxShadow = "";
    target.style.filter = "";
    imageFrameDropHotTargetRef.current = null;
  }, []);
  const destroyImageFrameDropOverlay = React.useCallback(() => {
    imageFrameDropOverlayRef.current?.root.remove();
    imageFrameDropOverlayRef.current = null;
    clearImageFrameDropHotTarget();
  }, [clearImageFrameDropHotTarget]);
  const createImageFrameDropOverlay = React.useCallback(
    (drag: NonNullable<typeof imageFrameDropDragRef.current>, clientX: number, clientY: number) => {
      destroyImageFrameDropOverlay();
      const root = document.createElement("div");
      root.setAttribute("data-image-frame-drop-overlay", "true");
      Object.assign(root.style, {
        inset: "0",
        pointerEvents: "none",
        position: "fixed",
        zIndex: "2147483647",
      });

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      Object.assign(svg.style, {
        height: "100vh",
        inset: "0",
        overflow: "visible",
        position: "fixed",
        width: "100vw",
      });
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(drag.originClientX));
      line.setAttribute("y1", String(drag.originClientY));
      line.setAttribute("x2", String(clientX));
      line.setAttribute("y2", String(clientY));
      line.setAttribute("stroke", "rgba(165,180,252,0.96)");
      line.setAttribute("stroke-width", "2.5");
      line.setAttribute("stroke-dasharray", "8 8");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);

      const thumb = document.createElement("div");
      thumb.setAttribute("data-image-frame-drop-thumb", "true");
      Object.assign(thumb.style, {
        background: "rgba(13,20,33,0.9)",
        border: "1px solid rgba(207,250,254,0.28)",
        borderRadius: "12px",
        boxShadow: "0 16px 34px -18px rgba(0,0,0,0.95), 0 0 24px rgba(129,140,248,0.2)",
        height: `${drag.thumbHeight}px`,
        left: `${clientX - drag.thumbWidth / 2}px`,
        overflow: "hidden",
        position: "fixed",
        top: `${clientY - drag.thumbHeight / 2}px`,
        width: `${drag.thumbWidth}px`,
      });
      const thumbImage = document.createElement("img");
      thumbImage.src = drag.url;
      thumbImage.alt = "";
      thumbImage.draggable = false;
      Object.assign(thumbImage.style, {
        display: "block",
        height: "100%",
        objectFit: "contain",
        width: "100%",
      });
      thumb.appendChild(thumbImage);
      root.append(svg, thumb);
      document.body.appendChild(root);
      imageFrameDropOverlayRef.current = { line, root, thumb };
    },
    [destroyImageFrameDropOverlay]
  );
  const setImageFrameDropHotTarget = React.useCallback(
    (target: HTMLElement | null) => {
      if (imageFrameDropHotTargetRef.current === target) return;
      clearImageFrameDropHotTarget();
      if (!target) return;
      target.setAttribute("data-frame-drop-hot", "true");
      target.style.outline = "2px solid rgba(125, 211, 252, 0.96)";
      target.style.outlineOffset = "-2px";
      target.style.boxShadow =
        "0 0 0 2px rgba(125,211,252,0.52), 0 0 34px rgba(103,232,249,0.36), inset 0 0 0 1px rgba(236,254,255,0.38)";
      target.style.filter = "brightness(1.12) saturate(1.1)";
      imageFrameDropHotTargetRef.current = target;
    },
    [clearImageFrameDropHotTarget]
  );
  const updateImageFrameDropOverlay = React.useCallback(
    (clientX: number, clientY: number) => {
      const overlay = imageFrameDropOverlayRef.current;
      if (!overlay) return;
      overlay.line.setAttribute("x2", String(clientX));
      overlay.line.setAttribute("y2", String(clientY));
      const drag = imageFrameDropDragRef.current;
      const thumbWidth = drag?.thumbWidth ?? overlay.thumb.offsetWidth;
      const thumbHeight = drag?.thumbHeight ?? overlay.thumb.offsetHeight;
      overlay.thumb.style.left = `${clientX - thumbWidth / 2}px`;
      overlay.thumb.style.top = `${clientY - thumbHeight / 2}px`;

      const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const target = element?.closest("[data-frame-strip-cell='true']") as HTMLElement | null;
      setImageFrameDropHotTarget(target);
    },
    [setImageFrameDropHotTarget]
  );
  const updateImageFrameDropDrag = React.useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const drag = imageFrameDropDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      if (
        !drag.dragging &&
        hasFrameExtractionDragStarted({
          clientX,
          clientY,
          startClientX: drag.startClientX,
          startClientY: drag.startClientY,
        })
      ) {
        drag.dragging = true;
      }
      if (!imageFrameDropOverlayRef.current) {
        createImageFrameDropOverlay(drag, clientX, clientY);
        return;
      }
      updateImageFrameDropOverlay(clientX, clientY);
    },
    [createImageFrameDropOverlay, updateImageFrameDropOverlay]
  );
  const finishImageFrameDropDrag = React.useCallback(
    (pointerId: number, canceled = false) => {
      const drag = imageFrameDropDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      const hotTarget = imageFrameDropHotTargetRef.current;
      cleanupImageFrameDropListeners();
      if (drag.element.hasPointerCapture(pointerId)) {
        drag.element.releasePointerCapture(pointerId);
      }
      imageFrameDropDragRef.current = null;
      destroyImageFrameDropOverlay();
      if (canceled || !drag.dragging || !hotTarget) return;
      const targetNodeId = hotTarget.getAttribute("data-frame-node-id") || "";
      const targetFrameIndex = Number.parseInt(
        hotTarget.getAttribute("data-frame-index") || "-1",
        10
      );
      if (targetNodeId && Number.isInteger(targetFrameIndex) && targetFrameIndex >= 0) {
        onReplaceFrameImage?.(targetNodeId, targetFrameIndex, drag.url);
      }
    },
    [cleanupImageFrameDropListeners, destroyImageFrameDropOverlay, onReplaceFrameImage]
  );
  const beginImageFrameDropDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!onReplaceFrameImage || isFrameStrip || !imageUrl || event.button !== 0)
        return;
      cleanupImageFrameDropListeners();
      const rect = event.currentTarget.getBoundingClientRect();
      const element = event.currentTarget;
      const pointerId = event.pointerId;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      let lastClientX = event.clientX;
      let lastClientY = event.clientY;
      let activated = false;

      imageFrameDropLongPressTimerRef.current = window.setTimeout(() => {
        activated = true;
        imageFrameDropLongPressTimerRef.current = null;
        imageFrameDropDragRef.current = {
          dragging: true,
          element,
          originClientX: rect.left + rect.width / 2,
          originClientY: rect.top + rect.height / 2,
          pointerId,
          startClientX,
          startClientY,
          thumbHeight: Math.max(1, Math.round(rect.height / 4)),
          thumbWidth: Math.max(1, Math.round(rect.width / 4)),
          url: imageUrl,
        };
        updateImageFrameDropDrag(pointerId, lastClientX, lastClientY);
      }, IMAGE_FRAME_DROP_LONG_PRESS_MS);

      const handleWindowPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        lastClientX = moveEvent.clientX;
        lastClientY = moveEvent.clientY;
        if (!activated) {
          if (
            hasFrameExtractionDragStarted({
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
              startClientX,
              startClientY,
            })
          ) {
            cleanupImageFrameDropListeners();
          }
          return;
        }
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        updateImageFrameDropDrag(moveEvent.pointerId, moveEvent.clientX, moveEvent.clientY);
      };
      const handleWindowPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        if (!activated) {
          cleanupImageFrameDropListeners();
          return;
        }
        finishImageFrameDropDrag(upEvent.pointerId);
      };
      const handleWindowPointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        finishImageFrameDropDrag(cancelEvent.pointerId, true);
      };

      window.addEventListener("pointermove", handleWindowPointerMove, true);
      window.addEventListener("pointerup", handleWindowPointerUp, true);
      window.addEventListener("pointercancel", handleWindowPointerCancel, true);
      imageFrameDropCleanupRef.current = () => {
        window.removeEventListener("pointermove", handleWindowPointerMove, true);
        window.removeEventListener("pointerup", handleWindowPointerUp, true);
        window.removeEventListener("pointercancel", handleWindowPointerCancel, true);
      };
    },
    [
      cleanupImageFrameDropListeners,
      finishImageFrameDropDrag,
      imageUrl,
      isFrameStrip,
      onReplaceFrameImage,
      updateImageFrameDropDrag,
    ]
  );
  React.useEffect(
    () => () => {
      cleanupImageFrameDropListeners();
      destroyImageFrameDropOverlay();
    },
    [cleanupImageFrameDropListeners, destroyImageFrameDropOverlay]
  );
  const isImageLoaded = Boolean(
    imageUrl && imageLoadState.url === imageUrl && imageLoadState.status === "loaded"
  );
  const isImageLoadFailed = Boolean(
    imageUrl && imageLoadState.url === imageUrl && imageLoadState.status === "error"
  );
  const aspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const resolution = (node.properties.resolution as string) || "1K";
  const quantity = (node.properties.quantity as string) || "1张";
  const imageModelOptionGroups = React.useMemo(
    () =>
      getModelOptionGroups(
        [],
        apiConfig?.remoteModelsByType?.[AI_MODEL_TYPES[1]] ?? []
      ),
    [apiConfig?.remoteModelsByType]
  );
  const imageModelOptions = React.useMemo(
    () => [...imageModelOptionGroups.builtIn, ...imageModelOptionGroups.remote],
    [imageModelOptionGroups]
  );
  const preferredImageModel = imageModelOptions[0] || "";
  const selectedImageModel =
    typeof node.properties.model === "string" && node.properties.model.trim()
      ? node.properties.model.trim()
      : "";
  const currentModel = selectedImageModel || preferredImageModel;
  const isStarterPlaceholder = node.data?.isUploadPlaceholder === true;
  const nodeBadgeTitle =
    node.title === "图片节点" || node.title === "图片" ? "图片节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const resultImageBounds = getResultImageBounds(
    aspectRatio,
    node.data?.isUploadPlaceholder === true,
    isExtractedFrameNode
  );
  const resultImageSize = React.useMemo(
    () =>
      resolveResultImageSize(
        {
          imageNaturalWidth: naturalImageSize?.width,
          imageNaturalHeight: naturalImageSize?.height,
          imageDisplayWidth: node.data?.imageDisplayWidth,
          imageDisplayHeight: node.data?.imageDisplayHeight,
        },
        aspectRatio,
        node.data?.isUploadPlaceholder === true,
        isExtractedFrameNode
      ),
    [
      aspectRatio,
      naturalImageSize?.height,
      naturalImageSize?.width,
      node.data?.imageDisplayHeight,
      node.data?.imageDisplayWidth,
      node.data?.isUploadPlaceholder,
      isExtractedFrameNode,
    ]
  );
  const emptyImageNodeSize = React.useMemo(
    () =>
      resolveEmptyImageNodeSize({
        aspectRatio,
        displayHeight: isUploadingNodeAsset ? node.data?.imageDisplayHeight : undefined,
        displayWidth: isUploadingNodeAsset ? node.data?.imageDisplayWidth : undefined,
        isExtractedFrameNode,
        isUploadPlaceholder: node.data?.isUploadPlaceholder === true,
        resolution,
      }),
    [
      aspectRatio,
      isExtractedFrameNode,
      isUploadingNodeAsset,
      node.data?.imageDisplayHeight,
      node.data?.imageDisplayWidth,
      node.data?.isUploadPlaceholder,
      resolution,
    ]
  );
  const frameStripLayout = React.useMemo(
    () =>
      getFrameStripAdaptiveLayout({
        fallbackTileHeight: frameTileHeight,
        fallbackTileWidth: frameTileWidth,
        imageSizes: frameImageSizes,
        imageUrls: resolvedImageUrls,
        maxColumns: frameGridColumns,
      }),
    [frameGridColumns, frameImageSizes, frameTileHeight, frameTileWidth, resolvedImageUrls]
  );
  const frameStripSize = {
    width: frameStripLayout.width,
    height: frameStripLayout.height,
  };
  const frameStripRows = React.useMemo(
    () =>
      Array.from(
        { length: Math.max(1, Math.ceil(Math.max(1, resolvedImageUrls.length) / frameGridColumns)) },
        (_, rowIndex) =>
          resolvedImageUrls
            .slice(rowIndex * frameGridColumns, (rowIndex + 1) * frameGridColumns)
            .map((url, offset) => {
              const index = rowIndex * frameGridColumns + offset;
              return {
                index,
                tileSize: frameStripLayout.tiles[index] ?? {
                  height: frameTileHeight,
                  width: frameTileWidth,
                },
                url,
              };
            })
      ),
    [
      frameGridColumns,
      frameStripLayout.tiles,
      frameTileHeight,
      frameTileWidth,
      resolvedImageUrls,
    ]
  );
  const mediaFrameSize = isFrameStrip ? frameStripSize : resultImageSize;
  const previewNodeWidth = getImagePreviewNodeWidth({
    frameStripWidth: frameStripSize.width,
    isFrameStrip,
    resultImageWidth: resultImageSize.width,
  });
  const imageSetKey = React.useMemo(() => resolvedImageUrls.join("||"), [resolvedImageUrls]);
  const naturalSizeLabel = isFrameStrip
    ? `${resolvedImageUrls.length} \u5e27`
    : naturalImageSize && naturalImageSize.width > 0 && naturalImageSize.height > 0
      ? `${naturalImageSize.width} \u00d7 ${naturalImageSize.height}`
      : `${resultImageSize.width} \u00d7 ${resultImageSize.height}`;
  const shouldShowUploadButton = shouldShowImageUploadButton({
    hasImageUrl: Boolean(imageUrl),
    isImageLoaded,
    isImageLoadFailed,
    isRunning,
    isUploadingNodeAsset,
  });
  React.useEffect(() => {
    const width = node.data?.imageNaturalWidth;
    const height = node.data?.imageNaturalHeight;
    setNaturalImageSize(
      typeof width === "number" && typeof height === "number" ? { width, height } : null
    );
  }, [node.data?.imageNaturalHeight, node.data?.imageNaturalWidth, imageUrl]);

  React.useEffect(() => {
    setImageLoadState({ status: "idle", url: imageUrl });
  }, [imageUrl]);

  React.useEffect(() => {
    if (!imageUrl || isStarterPlaceholder) return;
    const imageElement = imageElementRef.current;
    if (!imageElement) return;
    const settledStatus = getSettledImageLoadStatus({
      complete: imageElement.complete,
      naturalWidth: imageElement.naturalWidth,
    });
    if (settledStatus === "idle") return;
    setImageLoadState({ status: settledStatus, url: imageUrl });
  }, [imageUrl, isStarterPlaceholder]);

  React.useEffect(() => {
    if (!imageUrl || !previewNodeRef.current) return;

    const syncNodeBounds = () => {
      const nextWidth = Math.round(previewNodeRef.current?.offsetWidth ?? 0);
      const nextHeight = Math.round(previewNodeRef.current?.offsetHeight ?? 0);
      const nextPortCenterY = Math.round(
        (mediaFrameRef.current?.offsetTop ?? 0) + (mediaFrameRef.current?.offsetHeight ?? 0) / 2
      );
      if (
        nextWidth > 0 &&
        nextHeight > 0 &&
        (node.data?.imageNodeWidth !== nextWidth ||
          node.data?.imageNodeHeight !== nextHeight ||
          node.data?.imagePortCenterY !== nextPortCenterY)
      ) {
        onUpdateData?.(node.id, {
          imageNodeWidth: nextWidth,
          imageNodeHeight: nextHeight,
          imagePortCenterY: nextPortCenterY,
        });
      }
    };

    syncNodeBounds();
    const frame = window.requestAnimationFrame(syncNodeBounds);
    return () => window.cancelAnimationFrame(frame);
  }, [
    imageUrl,
    node.data?.imageNodeHeight,
    node.data?.imageNodeWidth,
    node.data?.imagePortCenterY,
    node.id,
    onUpdateData,
    resolvedImageUrls.length,
    mediaFrameSize.height,
    mediaFrameSize.width,
  ]);

  React.useEffect(() => {
    if (imageUrl || isFrameStrip) return;
    if (
      node.data?.imageDisplayWidth === emptyImageNodeSize.displayWidth &&
      node.data?.imageDisplayHeight === emptyImageNodeSize.displayHeight &&
      node.data?.imageNodeWidth === emptyImageNodeSize.nodeWidth &&
      node.data?.imageNodeHeight === emptyImageNodeSize.nodeHeight &&
      node.data?.imagePortCenterY === emptyImageNodeSize.portCenterY
    ) {
      return;
    }

    onUpdateData?.(node.id, {
      imageDisplayHeight: emptyImageNodeSize.displayHeight,
      imageDisplayWidth: emptyImageNodeSize.displayWidth,
      imageNodeHeight: emptyImageNodeSize.nodeHeight,
      imageNodeWidth: emptyImageNodeSize.nodeWidth,
      imagePortCenterY: emptyImageNodeSize.portCenterY,
    });
  }, [
    emptyImageNodeSize.displayHeight,
    emptyImageNodeSize.displayWidth,
    emptyImageNodeSize.nodeHeight,
    emptyImageNodeSize.nodeWidth,
    emptyImageNodeSize.portCenterY,
    imageUrl,
    isFrameStrip,
    node.data?.imageDisplayHeight,
    node.data?.imageDisplayWidth,
    node.data?.imageNodeHeight,
    node.data?.imageNodeWidth,
    node.data?.imagePortCenterY,
    node.id,
    onUpdateData,
  ]);

  React.useEffect(() => {
    const nextIndex =
      typeof node.data?.activeImageIndex === "number" && node.data.activeImageIndex >= 0
        ? Math.min(node.data.activeImageIndex, Math.max(0, resolvedImageUrls.length - 1))
        : 0;
    setActiveImageIndex(nextIndex);
    setNaturalImageSize(null);
  }, [imageSetKey, node.data?.activeImageIndex, resolvedImageUrls.length]);

  React.useEffect(() => {
    const nextIndex = node.data?.activeImageIndex;
    if (typeof nextIndex === "number" && nextIndex >= 0 && nextIndex !== activeImageIndex) {
      setActiveImageIndex(Math.min(nextIndex, Math.max(0, resolvedImageUrls.length - 1)));
    }
  }, [activeImageIndex, node.data?.activeImageIndex, resolvedImageUrls.length]);

  React.useEffect(() => {
    if (!openSelect) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setOpenSelect(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openSelect]);

  React.useEffect(() => {
    if (!gridMenuOpen && !customGridOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(event.target as Node)) {
        setGridMenuOpen(false);
        setCustomGridOpen(false);
        setHoverCustomGrid(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [customGridOpen, gridMenuOpen]);

  React.useEffect(() => {
    if (!activeGridSelection || !previewNodeRef.current) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (previewNodeRef.current && !previewNodeRef.current.contains(event.target as Node)) {
        setActiveGridSelection(null);
        setSelectedGridCells([]);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGridSelection(null);
        setSelectedGridCells([]);
      }
      if (event.key === "Enter" && selectedGridCells.length > 0) {
        event.preventDefault();
        onSplitImageGrid?.(
          node.id,
          imageUrl,
          activeGridSelection.rows,
          activeGridSelection.cols,
          selectedGridCells
        );
        setSelectedGridCells([]);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeGridSelection, imageUrl, node.id, onSplitImageGrid, selectedGridCells]);

  React.useEffect(() => {
    if (node.properties.model !== currentModel) {
      onUpdateProperty?.(node.id, "model", currentModel);
    }
  }, [currentModel, node.id, node.properties.model, onUpdateProperty]);

  React.useEffect(() => {
    if (!modelMenuOpen) return;
    const updateModelMenuPosition = () => {
      const rect = modelMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setModelMenuPosition(
        getFloatingMenuPosition({
          anchorRect: rect,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        })
      );
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        modelMenuRef.current &&
        !modelMenuRef.current.contains(target) &&
        !modelMenuPortalRef.current?.contains(target)
      ) {
        setModelMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelMenuOpen(false);
    };
    updateModelMenuPosition();
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateModelMenuPosition);
    window.addEventListener("scroll", updateModelMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateModelMenuPosition);
      window.removeEventListener("scroll", updateModelMenuPosition, true);
    };
  }, [modelMenuOpen]);

  React.useEffect(() => {
    if (!selected) {
      setOpenSelect(null);
      setModelMenuOpen(false);
      setGridMenuOpen(false);
      setCustomGridOpen(false);
      setHoverCustomGrid(null);
      setActiveGridSelection(null);
      setSelectedGridCells([]);
      setHoveredGridCell(null);
    }
  }, [selected]);

  const handleRun = () => {
    if (isRunning) return;
    setOpenSelect(null);
    setModelMenuOpen(false);
    onRun?.(node.id);
  };

  const handlePromptChange = (value: string) => {
    onUpdateProperty?.(node.id, "text", value);
  };

  const downloadImage = async () => {
    if (!imageUrl) return;
    const filename = `${nodeBadgeTitle.replace(/\s+/g, "-") || "image-node"}-${Date.now()}.${extensionFromAssetUrl(imageUrl, "png")}`;
    await downloadMediaAsset(imageUrl, filename);
  };

  const handleUploadClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    uploadInputRef.current?.click();
  }, []);

  const handleImageUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;

      setIsUploadingAsset(true);
      onUpdateData?.(node.id, {
        uploadingAsset: true,
        uploadedAssetName: file.name,
        status: "uploading",
        error: undefined,
      });
      try {
        const asset = await uploadFileToOss(file);
        const uploadedUrl = asset.url;
        const uploadedImage = new window.Image();
        uploadedImage.onload = () => {
          const naturalSize = {
            width: uploadedImage.naturalWidth || resultImageSize.width,
            height: uploadedImage.naturalHeight || resultImageSize.height,
          };
          const displaySize = fitMediaNodePreviewSize(naturalSize);
          setActiveImageIndex(0);
          setNaturalImageSize(naturalSize);
          onUpdateProperty?.(node.id, "imageUrl", uploadedUrl);
          if (asset.ossId) onUpdateProperty?.(node.id, "ossId", asset.ossId);
          onUpdateProperty?.(node.id, "isSourceNode", true);
          onUpdateData?.(node.id, {
            imageUrl: uploadedUrl,
            imageUrls: [uploadedUrl],
            ossId: asset.ossId,
            activeImageIndex: 0,
            imageNaturalWidth: naturalSize.width,
            imageNaturalHeight: naturalSize.height,
            imageDisplayWidth: displaySize.width,
            imageDisplayHeight: displaySize.height,
            uploadedImage: true,
            isUploadPlaceholder: false,
            isSourceNode: true,
            uploadingAsset: false,
            status: "success",
            loading: false,
            error: undefined,
          });
          if (node.data?.imagePromptStarter) {
            onSyncImagePromptStarterLayout?.(node.id, displaySize.width);
          }
          onSetPrimaryImageResult?.(node.id, uploadedUrl, 0);
          onNotice?.("图片已上传到 OSS");
        };
        uploadedImage.onerror = () => {
          onUpdateData?.(node.id, {
            uploadingAsset: false,
            status: "error",
            error: "Image uploaded, but preview failed to load.",
          });
          onNotice?.("图片上传成功，但预览加载失败");
        };
        uploadedImage.src = uploadedUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image upload failed.";
        onUpdateData?.(node.id, {
          uploadingAsset: false,
          status: "error",
          error: message,
        });
        onNotice?.(error instanceof Error ? error.message : "图片上传失败");
      } finally {
        setIsUploadingAsset(false);
      }
    },
    [
      aspectRatio,
      node.data?.imagePromptStarter,
      node.id,
      onNotice,
      onSetPrimaryImageResult,
      onSyncImagePromptStarterLayout,
      onUpdateData,
      onUpdateProperty,
      resultImageBounds.maxHeight,
      resultImageBounds.maxWidth,
      resultImageSize.height,
      resultImageSize.width,
    ]
  );

  const cycleActiveImage = React.useCallback(
    (direction: -1 | 1) => {
      if (resolvedImageUrls.length <= 1) return;
      const nextIndex =
        (activeImageIndex + direction + resolvedImageUrls.length) % resolvedImageUrls.length;
      setActiveImageIndex(nextIndex);
      setNaturalImageSize(null);
      onSetPrimaryImageResult?.(node.id, resolvedImageUrls[nextIndex], nextIndex);
    },
    [activeImageIndex, node.id, onSetPrimaryImageResult, resolvedImageUrls]
  );

  const visibleThumbnailItems = React.useMemo(() => {
    if (resolvedImageUrls.length <= VISIBLE_THUMBNAIL_COUNT) {
      return resolvedImageUrls.map((url, index) => ({ url, index }));
    }

    const startIndex =
      (((activeImageIndex - Math.floor(VISIBLE_THUMBNAIL_COUNT / 2)) % resolvedImageUrls.length) +
        resolvedImageUrls.length) %
      resolvedImageUrls.length;

    return Array.from({ length: VISIBLE_THUMBNAIL_COUNT }, (_, offset) => {
      const index = (startIndex + offset) % resolvedImageUrls.length;
      return { url: resolvedImageUrls[index], index };
    });
  }, [activeImageIndex, resolvedImageUrls]);

  const uploadControl = (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      <button
        type="button"
        data-node-action="true"
        aria-label={imageUrl ? "上传替换图片" : "上传图片"}
        onClick={handleUploadClick}
        disabled={isUploadingNodeAsset}
        className="flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-[#101824]/54 px-3 text-slate-300/82 shadow-[0_10px_28px_-22px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-colors hover:bg-white/[0.065] hover:text-slate-50 disabled:cursor-wait"
      >
        {isUploadingNodeAsset ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <Upload className="h-[18px] w-[18px]" />
        )}
        <span className="text-[13px] font-medium leading-none">上传</span>
      </button>
    </>
  );

  const activeGridCellCount = activeGridSelection
    ? activeGridSelection.rows * activeGridSelection.cols
    : 0;

  const handleActivatePresetGrid = (rows: number, cols: number) => {
    setActiveGridSelection({ rows, cols });
    setSelectedGridCells([]);
    setGridMenuOpen(false);
    setCustomGridOpen(false);
    setHoverCustomGrid(null);
  };

  const handleApplyCustomGrid = (rows: number, cols: number) => {
    setActiveGridSelection({ rows, cols });
    setSelectedGridCells([]);
    setGridMenuOpen(false);
    setCustomGridOpen(false);
    setHoverCustomGrid(null);
  };

  const handleExitGridSplitMode = () => {
    setActiveGridSelection(null);
    setSelectedGridCells([]);
    setHoveredGridCell(null);
  };

  const handleSplitCell = (cellIndex: number) => {
    if (!activeGridSelection || !imageUrl || !onSplitImageGrid) return;
    onSplitImageGrid(node.id, imageUrl, activeGridSelection.rows, activeGridSelection.cols, [
      cellIndex,
    ]);
    setSelectedGridCells([]);
  };

  const handleGridCellClick = (cellIndex: number, additive: boolean) => {
    if (!activeGridSelection) return;
    if (additive) {
      setSelectedGridCells((current) =>
        current.includes(cellIndex)
          ? current.filter((value) => value !== cellIndex)
          : [...current, cellIndex].sort((a, b) => a - b)
      );
      return;
    }

    if (selectedGridCells.length > 0 && selectedGridCells.includes(cellIndex)) {
      handleSplitCell(cellIndex);
      return;
    }

    setSelectedGridCells([cellIndex]);
  };

  const getGridBadgeLabel = (cellIndex: number) => {
    if (!activeGridSelection) return String(cellIndex + 1);
    const row = Math.floor(cellIndex / activeGridSelection.cols) + 1;
    const col = (cellIndex % activeGridSelection.cols) + 1;
    return `${row}-${col}`;
  };

  const hasInputPorts = !isSourceAssetNode && node.inputs.length > 0;
  const portTopStyle = getImageNodePortTopStyle({
    emptyImageNodePortCenterY: emptyImageNodeSize.portCenterY,
    hasImageUrl: Boolean(imageUrl),
    imagePortCenterY: node.data?.imagePortCenterY,
  });
  const portHandles = (
    <AnimatePresence>
      {!isUploadingNodeAsset &&
        shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
          <>
            {hasInputPorts && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute -left-11 z-10"
                style={getImagePortHandleWrapperStyle(portTopStyle)}
              >
                <div
                  role="button"
                  tabIndex={-1}
                  data-node-action="true"
                  data-port-role="input"
                  data-node-id={node.id}
                  data-port-index={0}
                  className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 ${
                    isLinkingOnCanvas && linkToNodeId === node.id && linkToInputIndex === 0
                      ? "canvas-port-input canvas-port-hot scale-110"
                      : "canvas-port-input"
                  }`}
                  onPointerEnter={() => onHoverCanvasLinkTarget?.(node.id, 0)}
                  onPointerLeave={() => onLeaveCanvasLinkTarget?.(node.id, 0)}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onFinishCanvasLink?.(node.id, 0);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  title={getCanvasLinkTargetIssue?.(node.id, 0) || "输入端口: 点击此处完成连线"}
                >
                  <Plus className="h-4 w-4 pointer-events-none" />
                </div>
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute -right-11 z-10"
              style={getImagePortHandleWrapperStyle(portTopStyle)}
            >
              <div
                role="button"
                tabIndex={-1}
                data-node-action="true"
                data-port-role="output"
                data-node-id={node.id}
                data-port-index={0}
                className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 ${
                  isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === 0
                    ? "canvas-port-output canvas-port-active scale-110"
                    : "canvas-port-output"
                }`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  onBeginCanvasLink?.(node.id, 0, e.clientX, e.clientY);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                title="输出端口: 按住并拖拽进行连线 (支持多条输出)"
              >
                <Plus className="h-4 w-4 pointer-events-none" />
              </div>
            </motion.div>
          </>
        )}
    </AnimatePresence>
  );

  const showImagePromptComposer =
    !isFrameStrip &&
    !isSourceAssetNode &&
    (isHovered || selected) &&
    !isUploadingNodeAsset &&
    !isRunning;

  const imagePreviewContent =
    imageUrl && !isRunning && !isUploadingNodeAsset ? (
      <motion.div
        onPointerDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          const target = e.target as HTMLElement;
          if (!target.closest("[data-node-action='true']")) onDragStart(e, node);
          else e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
        className="group relative cursor-grab active:cursor-grabbing"
        style={{ width: previewNodeWidth }}
      >
        {portHandles}
        <AnimatePresence>
          {selected && shouldShowUploadButton && !isExtractedFrameNode && (
            <motion.div
              data-node-action="true"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute left-1/2 top-0 z-50 flex -translate-x-1/2 -translate-y-[calc(100%-20px)] items-center"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {uploadControl}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selected && (
            <motion.div
              data-node-action="true"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute left-1/2 top-0 z-40 flex h-14 -translate-x-1/2 -translate-y-[calc(100%+18px)] items-center gap-2 rounded-[20px] border border-slate-500/18 bg-[#121923]/95 px-4 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {activeGridSelection ? (
                <>
                  <Tooltip content="退出宫格切分" position="top">
                    <button
                      type="button"
                      onClick={handleExitGridSplitMode}
                      className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <Undo2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <div className="mx-1 h-7 w-px bg-slate-500/22" />
                  <div className="flex h-9 min-w-[208px] shrink-0 items-center gap-2 rounded-[12px] px-1 text-[13px] font-medium text-slate-200/88">
                    <Grid3X3 className="h-[18px] w-[18px] text-violet-300/88" />
                    <span className="block whitespace-nowrap leading-none">
                      {selectedGridCells.length > 0
                        ? `已选 ${selectedGridCells.length} 个宫格`
                        : "请选择宫格"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Tooltip content="下载图片" position="top">
                    <button
                      type="button"
                      onClick={downloadImage}
                      className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <div className="relative" ref={gridMenuRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGridMenuOpen((value) => !value);
                        setCustomGridOpen(false);
                        setHoverCustomGrid(null);
                      }}
                      className={`flex h-9 min-w-[114px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border px-3 text-[13px] font-semibold transition-colors ${
                        gridMenuOpen || activeGridSelection
                          ? "border-violet-400/28 bg-violet-500/[0.12] text-violet-50"
                          : "border-slate-500/18 bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-slate-100"
                      }`}
                    >
                      <Grid3X3 className="h-[18px] w-[18px]" />
                      <span className="whitespace-nowrap">宫格切分</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${gridMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <AnimatePresence>
                      {gridMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: "easeOut" }}
                          className="absolute left-0 top-[calc(100%+12px)] z-50 flex items-start gap-3"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="w-[220px] rounded-[20px] border border-slate-400/16 bg-[#121923]/96 p-3 text-white shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/18 to-transparent" />
                            {GRID_SPLIT_PRESETS.map((option) => {
                              const isActive =
                                activeGridSelection?.rows === option.rows &&
                                activeGridSelection?.cols === option.cols;
                              return (
                                <button
                                  key={`${option.rows}x${option.cols}`}
                                  type="button"
                                  onClick={() => handleActivatePresetGrid(option.rows, option.cols)}
                                  className={`mb-1 flex h-12 w-full items-center rounded-[14px] px-4 text-left text-[14px] font-semibold transition-colors ${
                                    isActive
                                      ? "bg-violet-500/[0.16] text-violet-50 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.26)]"
                                      : "text-slate-100/92 hover:bg-white/[0.055] hover:text-white"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                            <div className="my-2 h-px bg-slate-400/12" />
                            <button
                              type="button"
                              onClick={() => {
                                setCustomGridOpen((value) => !value);
                                setHoverCustomGrid(activeGridSelection ?? { rows: 2, cols: 2 });
                              }}
                              className={`flex h-12 w-full items-center justify-between rounded-[14px] border px-4 text-left text-[14px] font-semibold transition-colors ${
                                customGridOpen
                                  ? "border-violet-400/28 bg-violet-500/[0.12] text-violet-50"
                                  : "border-slate-400/16 text-slate-100/92 hover:bg-white/[0.055] hover:text-white"
                              }`}
                            >
                              <span>自定义</span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          <AnimatePresence>
                            {customGridOpen && (
                              <motion.div
                                initial={{ opacity: 0, x: -6, scale: 0.98 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -6, scale: 0.98 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="w-[308px] rounded-[20px] border border-slate-400/16 bg-[#121923]/96 p-5 text-white shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
                              >
                                <div className="mb-4 flex items-center justify-between">
                                  <div className="text-[14px] font-semibold text-slate-100/62">
                                    自定义宫格
                                  </div>
                                  <div className="text-[14px] font-semibold text-slate-100/88 tabular-nums">
                                    {
                                      (
                                        hoverCustomGrid ??
                                        activeGridSelection ?? { rows: 2, cols: 2 }
                                      ).rows
                                    }{" "}
                                    x{" "}
                                    {
                                      (
                                        hoverCustomGrid ??
                                        activeGridSelection ?? { rows: 2, cols: 2 }
                                      ).cols
                                    }
                                  </div>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                  {Array.from(
                                    { length: CUSTOM_GRID_MAX_ROWS * CUSTOM_GRID_MAX_COLS },
                                    (_, index) => {
                                      const row = Math.floor(index / CUSTOM_GRID_MAX_COLS) + 1;
                                      const col = (index % CUSTOM_GRID_MAX_COLS) + 1;
                                      const previewGrid = hoverCustomGrid ??
                                        activeGridSelection ?? { rows: 2, cols: 2 };
                                      const isIncluded =
                                        row <= previewGrid.rows && col <= previewGrid.cols;
                                      return (
                                        <button
                                          key={`custom-grid-${row}-${col}`}
                                          type="button"
                                          onMouseEnter={() =>
                                            setHoverCustomGrid({ rows: row, cols: col })
                                          }
                                          onFocus={() =>
                                            setHoverCustomGrid({ rows: row, cols: col })
                                          }
                                          onClick={() => handleApplyCustomGrid(row, col)}
                                          className={`aspect-square rounded-[8px] border transition-colors ${
                                            isIncluded
                                              ? "border-violet-400/34 bg-violet-500/[0.24] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(109,40,217,0.14)]"
                                              : "border-slate-400/10 bg-slate-200/[0.08] hover:border-slate-300/18 hover:bg-slate-200/[0.12]"
                                          }`}
                                          title={`${row} x ${col}`}
                                        />
                                      );
                                    }
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Tooltip content="全屏预览" position="top">
                    <button
                      type="button"
                      onClick={() =>
                        onPreview?.(
                          imageUrl,
                          "图片节点预览",
                          node.id,
                          resolvedImageUrls,
                          activeImageIndex
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </Tooltip>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {isStarterPlaceholder ? (
          <>
            <div className="absolute -top-8 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
              <ImageIcon className="h-4 w-4 shrink-0 text-slate-300/72" />
              <span className="truncate text-[15px] font-medium tracking-tight">
                {nodeBadgeMatch ? (
                  <>
                    <span>{nodeBadgeMatch[1]}</span>
                    <span className="text-slate-200/72">{nodeBadgeMatch[2]}</span>
                  </>
                ) : (
                  nodeBadgeTitle
                )}
              </span>
            </div>
            <div className="absolute -top-8 right-0 z-30 flex shrink-0 items-center gap-3 text-[12px] font-medium tabular-nums text-slate-400/72 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
              <span>{naturalSizeLabel}</span>
            </div>
          </>
        ) : (
          <div className="mb-2 flex items-center justify-between gap-4 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
            <div className="flex min-w-0 items-center gap-1.5">
              <ImageIcon className="h-4 w-4 shrink-0 text-slate-300/72" />
              <span className="truncate text-[15px] font-medium tracking-tight">
                {nodeBadgeMatch ? (
                  <>
                    <span>{nodeBadgeMatch[1]}</span>
                    <span className="text-slate-200/72">{nodeBadgeMatch[2]}</span>
                  </>
                ) : (
                  nodeBadgeTitle
                )}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!isFrameStrip && resolvedImageUrls.length > 1 && (
                <span className="rounded-full border border-slate-400/18 bg-slate-900/46 px-2.5 py-1 text-[11px] font-semibold text-slate-300/72">
                  {activeImageIndex + 1}/{resolvedImageUrls.length}
                </span>
              )}
              <span className="text-[12px] font-medium tabular-nums text-slate-400/72">
                {naturalSizeLabel}
              </span>
            </div>
          </div>
        )}
        <div className="flex w-full flex-col items-center">
          <div
            ref={mediaFrameRef}
            className={getImagePreviewFrameClassName({
              isImageLoaded: isFrameStrip || isImageLoaded,
              isSelected: selected,
              isStarterPlaceholder,
            })}
            style={{ width: mediaFrameSize.width, height: mediaFrameSize.height }}
          >
            <div className="relative h-full w-full">
              {!isFrameStrip && !isStarterPlaceholder && !isImageLoaded && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.92)_48%,rgba(30,41,59,0.96))]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(129,140,248,0.16),transparent_32%),radial-gradient(circle_at_74%_72%,rgba(34,211,238,0.08),transparent_38%)]" />
                  <div className="animate-shimmer absolute inset-y-0 left-[-45%] w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]" />
                  <div className="relative flex items-center gap-2 rounded-full border border-cyan-100/12 bg-[#0b1220]/72 px-3 py-1.5 text-[12px] font-semibold text-slate-200/72 shadow-[0_16px_42px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                    {isImageLoadFailed ? (
                      <ImageIcon className="h-3.5 w-3.5 text-rose-200/72" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200/72" />
                    )}
                    <span>{isImageLoadFailed ? "图片加载失败" : "图片加载中"}</span>
                  </div>
                </div>
              )}
              {isFrameStrip ? (
                <div className="group/framegrid flex h-full w-full flex-col gap-px overflow-hidden rounded-[inherit] bg-[#07101b] p-[10px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                  {frameStripRows.map((row, rowIndex) => (
                    <div key={`frame-row-${rowIndex}`} className="flex shrink-0 gap-px">
                      {row.map(({ index, tileSize, url }) => (
                        <div
                          key={`${url}-${index}`}
                          role="button"
                          tabIndex={0}
                          data-node-action="true"
                      data-frame-strip-cell="true"
                      data-frame-node-id={node.id}
                      data-frame-index={index}
                      aria-label={`第 ${index + 1} 帧，拖拽到画布生成图片子节点`}
                      onPointerDown={(event) => beginFrameExtractionDrag(event, index, url)}
                      onPointerMove={moveFrameExtractionDrag}
                      onPointerUp={(event) => endFrameExtractionDrag(event, index, url)}
                      onPointerCancel={cancelFrameExtractionDrag}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setActiveImageIndex(index);
                        onSetPrimaryImageResult?.(node.id, url, index);
                      }}
                      className={`group/frame relative shrink-0 overflow-hidden bg-[#050914] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.92),inset_0_0_32px_rgba(15,23,42,0.3)] transition-all duration-200 group-hover/framegrid:opacity-70 hover:z-10 hover:scale-[1.018] hover:opacity-100 hover:shadow-[0_0_0_2px_rgba(125,211,252,0.88),0_18px_44px_-22px_rgba(34,211,238,0.78),inset_0_0_0_1px_rgba(236,254,255,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 ${onExtractFrameImage ? "cursor-grab active:cursor-grabbing" : ""}`}
                      style={{ height: tileSize.height, width: tileSize.width }}
                    >
                      <img
                        src={url}
                        alt={`\u9010\u5e27\u5206\u6790 ${index + 1}`}
                        className="h-full w-full object-contain transition-all duration-200 group-hover/frame:brightness-110 group-hover/frame:saturate-110"
                        draggable={false}
                        onLoad={(event) => {
                          const img = event.currentTarget;
                          if (!img.naturalWidth || !img.naturalHeight) return;
                          setFrameImageSizes((current) => {
                            const previous = current[index];
                            if (
                              previous?.width === img.naturalWidth &&
                              previous?.height === img.naturalHeight
                            ) {
                              return current;
                            }
                            return {
                              ...current,
                              [index]: {
                                width: img.naturalWidth,
                                height: img.naturalHeight,
                              },
                            };
                          });
                        }}
                      />
                      <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full border border-white/18 bg-[#0b1018]/82 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-[0_8px_18px_-12px_rgba(0,0,0,0.95)] transition-all duration-200 group-hover/frame:border-cyan-100/42 group-hover/frame:bg-cyan-100/18 group-hover/frame:text-cyan-50 group-hover/frame:shadow-[0_0_20px_rgba(103,232,249,0.26)]">
                        {index + 1}
                      </span>
                      {onExtractFrameImage && (
                        <>
                          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(236,254,255,0.1)_0%,rgba(236,254,255,0.04)_38%,rgba(2,12,22,0.62)_100%)] opacity-0 transition-opacity duration-200 group-hover/frame:opacity-100" />
                          <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_0_1px_rgba(236,254,255,0.42)] transition-opacity duration-200 group-hover/frame:opacity-100" />
                          <button
                            type="button"
                            data-node-action="true"
                            className="absolute bottom-3 left-1/2 z-20 flex h-8 -translate-x-1/2 translate-y-1 items-center justify-center rounded-full border border-cyan-100/18 bg-[#0b1320]/82 px-3.5 text-[12px] font-semibold text-cyan-50/92 opacity-0 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all duration-200 hover:border-cyan-100/32 hover:bg-[#101b2b]/92 hover:text-white group-hover/frame:translate-y-0 group-hover/frame:opacity-100"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              onExtractFrameImage(node.id, index);
                          }}
                        >
                            提取
                          </button>
                        </>
                      )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <img
                  ref={imageElementRef}
                  src={imageUrl}
                  alt="\u751f\u6210\u56fe\u7247"
                  className={`block h-full w-full transition-opacity duration-200 ${isStarterPlaceholder || isImageLoaded ? "opacity-100" : "opacity-0"} ${isStarterPlaceholder ? "object-cover" : "object-contain"}`}
                  draggable={false}
                  onPointerDown={beginImageFrameDropDrag}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageLoadState({ status: "loaded", url: imageUrl });
                    const naturalSize = {
                      width: img.naturalWidth || resultImageSize.width,
                      height: img.naturalHeight || resultImageSize.height,
                    };
                    const displaySize = fitMediaNodePreviewSize(naturalSize);
                    setNaturalImageSize(naturalSize);
                    if (
                      node.data?.imageNaturalWidth !== naturalSize.width ||
                      node.data?.imageNaturalHeight !== naturalSize.height ||
                      node.data?.imageDisplayWidth !== displaySize.width ||
                      node.data?.imageDisplayHeight !== displaySize.height
                    ) {
                      onUpdateData?.(node.id, {
                        imageNaturalWidth: naturalSize.width,
                        imageNaturalHeight: naturalSize.height,
                        imageDisplayWidth: displaySize.width,
                        imageDisplayHeight: displaySize.height,
                      });
                    }
                  }}
                  onError={() => setImageLoadState({ status: "error", url: imageUrl })}
                />
              )}
              {selected && activeGridSelection && onSplitImageGrid && (
                <div
                  data-node-action="true"
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${activeGridSelection.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${activeGridSelection.rows}, minmax(0, 1fr))`,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Array.from({ length: activeGridCellCount }, (_, index) => {
                    const isSelected = selectedGridCells.includes(index);
                    const isHovered = hoveredGridCell === index;
                    return (
                      <button
                        key={`split-cell-${index}`}
                        type="button"
                        onMouseEnter={() => setHoveredGridCell(index)}
                        onMouseLeave={() =>
                          setHoveredGridCell((current) => (current === index ? null : current))
                        }
                        onClick={(event) => handleGridCellClick(index, event.shiftKey)}
                        className={`relative min-h-0 min-w-0 border transition-colors focus-visible:outline-none ${
                          isSelected
                            ? "border-violet-300/82 bg-violet-400/[0.18] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2),0_0_24px_rgba(109,40,217,0.12)]"
                            : "border-white/70 bg-white/0 hover:bg-violet-400/[0.1]"
                        }`}
                      >
                        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-white/10 bg-[#0b1220]/72 px-2.5 py-1 text-[12px] font-semibold tracking-[0.02em] text-white/92 shadow-[0_12px_28px_-16px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                          {getGridBadgeLabel(index)}
                        </span>
                        {isHovered && (
                          <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 translate-y-[20px] rounded-md border border-violet-300/18 bg-[#0b1220]/88 px-2 py-1 text-[10px] font-medium text-slate-200/92 shadow-[0_12px_28px_-18px_rgba(0,0,0,0.9),0_0_18px_rgba(109,40,217,0.14)]">
                            Shift 可多选
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {isUploadingNodeAsset && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#070b12]/42 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full border border-cyan-100/18 bg-[#0b1220]/82 px-3 py-1.5 text-[12px] font-semibold text-cyan-50/86 shadow-[0_16px_42px_-22px_rgba(34,211,238,0.48),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>上传中</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!isFrameStrip && resolvedImageUrls.length > 1 && (
            <div
              data-node-action="true"
              className="mt-3 flex w-full items-center justify-center gap-3"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => cycleActiveImage(-1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-400/18 bg-slate-900/42 text-slate-200/78 transition-all hover:border-slate-300/32 hover:bg-slate-800/70 hover:text-white"
                title="上一张"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-center gap-2">
                {visibleThumbnailItems.map(({ url, index }) => {
                  const isActive = index === activeImageIndex;
                  return (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => {
                        setActiveImageIndex(index);
                        setNaturalImageSize(null);
                        onSetPrimaryImageResult?.(node.id, url, index);
                      }}
                      className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-[10px] border transition-all ${
                        isActive
                          ? "border-sky-300 shadow-[0_0_0_1px_rgba(125,211,252,0.45),0_12px_28px_-18px_rgba(56,189,248,0.6)]"
                          : "border-slate-400/18 opacity-80 hover:border-slate-300/36 hover:opacity-100"
                      }`}
                      title={`查看第 ${index + 1} 张`}
                    >
                      <img
                        src={url}
                        alt={`生成图片 ${index + 1}`}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                      <div className="absolute inset-x-0 bottom-0 flex h-5 items-center justify-center bg-black/42 text-[10px] font-semibold text-white/90">
                        {index + 1}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => cycleActiveImage(1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-400/18 bg-slate-900/42 text-slate-200/78 transition-all hover:border-slate-300/32 hover:bg-slate-800/70 hover:text-white"
                title="下一张"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    ) : null;

  return (
    <>
      <motion.div
        className="absolute text-left"
        style={{ width: imagePreviewContent ? previewNodeWidth : emptyImageNodeSize.nodeWidth }}
        ref={imagePreviewContent ? previewNodeRef : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {imagePreviewContent ?? (
          <>
            {portHandles}
            <motion.div
              onPointerDown={(e) => {
                if (e.button !== 0) {
                  return;
                }
                const target = e.target as HTMLElement;
                if (
                  !target.closest("[data-node-action='true']") &&
                  !target.closest("textarea,button,input,[contenteditable='true'],[role='textbox']")
                )
                  onDragStart(e, node);
                else e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(e);
              }}
              className={`group node-card relative cursor-grab rounded-[18px] border bg-[#121723]/88 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-all duration-300 active:cursor-grabbing ${
                selected
                  ? "border-violet-300/26 -translate-y-[1px] shadow-[0_40px_100px_-34px_rgba(0,0,0,0.98),0_0_0_1px_rgba(196,181,253,0.2),0_0_0_7px_rgba(139,92,246,0.08),0_0_48px_rgba(109,40,217,0.18)]"
                  : "border-[#2b3142]/90 hover:border-slate-300/35"
              }`}
              style={{
                width: emptyImageNodeSize.nodeWidth,
                minHeight: emptyImageNodeSize.nodeHeight,
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
              {(isRunning || isUploadingNodeAsset) && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
                  <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
                </div>
              )}
              <AnimatePresence>
                {selected && !isUploadingNodeAsset && shouldShowUploadButton && (
                  <motion.div
                    data-node-action="true"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute left-1/2 top-0 z-40 flex -translate-x-1/2 -translate-y-[calc(100%+14px)] items-center"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {uploadControl}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="absolute -top-8 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
                <ImageIcon className="h-4 w-4 text-cyan-100/58" />
                <span className="text-[15px] font-medium tracking-tight">
                  {nodeBadgeMatch ? (
                    <>
                      <span>{nodeBadgeMatch[1]}</span>
                      <span className="text-emerald-200/72">{nodeBadgeMatch[2]}</span>
                    </>
                  ) : (
                    nodeBadgeTitle
                  )}
                </span>
              </div>
              <div className="relative px-5 pb-5 pt-8">
                {isRunning || isUploadingNodeAsset ? (
                  <div
                    className="flex flex-col items-center justify-center gap-4 text-slate-300/60"
                    style={{ minHeight: Math.max(120, emptyImageNodeSize.nodeHeight - 52) }}
                  >
                    <div className="relative flex h-[96px] w-[96px] items-center justify-center text-cyan-100/58">
                      <ImageIcon className="h-14 w-14" strokeWidth={1.55} />
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 text-[13px] text-slate-100/80">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-100/72" />
                        {getMediaNodeLoadingLabel({
                          isUploading: isUploadingNodeAsset,
                          mediaType: "image",
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center"
                    style={{ minHeight: Math.max(120, emptyImageNodeSize.nodeHeight - 52) }}
                  >
                    <div className="mb-8 flex h-[96px] w-[96px] items-center justify-center text-cyan-100/58">
                      <ImageIcon className="h-14 w-14" strokeWidth={1.55} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}

        <AnimatePresence>
          {showImagePromptComposer && (
            <motion.div
              data-node-action="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(e);
              }}
              className="relative node-card left-1/2 mt-5 w-[620px] -translate-x-1/2 rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-4 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
              {inputReferences.length > 0 && (
                <div className="mb-3 rounded-2xl border border-white/6 bg-[#0d1117]/46 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="flex flex-wrap items-center gap-2">
                    {inputReferences.map((reference, index) => (
                      <React.Fragment key={`${reference.key}-${reference.value}-${index}`}>
                        <ReferencePreviewCard reference={reference} index={index} />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative">
                <PromptTokenEditor
                  value={promptText}
                  resources={inputReferences}
                  onChange={handlePromptChange}
                  placeholder={
                    upstreamPrompt
                      ? "继续补充这些输入资源要如何参与生成"
                      : hasNonTextInputReferences
                        ? "描述你想基于这些输入生成的画面内容"
                        : "描述你想要生成的画面内容"
                  }
                  className="h-[92px] text-[15px] leading-7 custom-scrollbar"
                />
              </div>
              <div
                ref={controlsRef}
                className="mt-3 flex items-center gap-2 border-t border-cyan-100/8 pt-3"
              >
                <div className="relative min-w-[180px] flex-[1_1_190px]" ref={modelMenuRef}>
                  <button
                    type="button"
                    data-node-action="true"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenSelect(null);
                      const rect = modelMenuRef.current?.getBoundingClientRect();
                      if (rect) {
                        setModelMenuPosition(
                          getFloatingMenuPosition({
                            anchorRect: rect,
                            viewportHeight: window.innerHeight,
                            viewportWidth: window.innerWidth,
                          })
                        );
                      }
                      setModelMenuOpen((open) => !open);
                    }}
                    className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-[14px] border px-3 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors ${
                      modelMenuOpen
                        ? "border-cyan-100/34 bg-cyan-100/[0.075] text-cyan-50"
                        : "border-cyan-100/8 bg-slate-950/18 text-cyan-50/78 hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5 shrink-0 text-cyan-100/50" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {getImageModelLabel(currentModel)}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-300/56 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {typeof document !== "undefined" &&
                    createPortal(
                      <AnimatePresence>
                        {modelMenuOpen && modelMenuPosition && (
                          <motion.div
                            ref={modelMenuPortalRef}
                            initial={{
                              opacity: 0,
                              y: modelMenuPosition.placement === "bottom" ? 8 : -8,
                              scale: 0.98,
                            }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{
                              opacity: 0,
                              y: modelMenuPosition.placement === "bottom" ? 8 : -8,
                              scale: 0.98,
                            }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                            className="fixed z-[160] overflow-y-auto rounded-2xl border border-cyan-100/14 bg-[#121923]/96 p-1.5 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar"
                            style={{
                              left: modelMenuPosition.left,
                              maxHeight: modelMenuPosition.maxHeight,
                              top: modelMenuPosition.top,
                              bottom: modelMenuPosition.bottom,
                              width: modelMenuPosition.width,
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onWheel={(event) => event.stopPropagation()}
                          >
                            {[
                              { label: "内置模型", models: imageModelOptionGroups.builtIn },
                              { label: "远程模型", models: imageModelOptionGroups.remote },
                            ]
                              .filter((group) => group.models.length > 0)
                              .map((group) => (
                                <div key={group.label} className="py-0.5">
                                  <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/44">
                                    {group.label}
                                  </div>
                                  {group.models.map((model) => {
                                    const isActive = currentModel === model;
                                    return (
                                      <button
                                        key={`${group.label}-${model}`}
                                        type="button"
                                        onClick={() => {
                                          onUpdateProperty?.(node.id, "model", model);
                                          setModelMenuOpen(false);
                                        }}
                                        className={`flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[13px] font-medium transition-colors ${
                                          isActive
                                            ? "bg-cyan-300/[0.13] text-cyan-50"
                                            : "text-slate-200/82 hover:bg-white/[0.05] hover:text-white"
                                        }`}
                                      >
                                        <span className="min-w-0 flex-1 truncate">
                                          {getImageModelLabel(model)}
                                        </span>
                                        {isActive && (
                                          <Check className="h-3.5 w-3.5 text-cyan-100" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                          </motion.div>
                        )}
                      </AnimatePresence>,
                      document.body
                    )}
                </div>
                <ImageResolutionPicker
                  resolution={resolution}
                  aspectRatio={aspectRatio}
                  onChange={(nextResolution, nextAspectRatio) => {
                    onUpdateProperty?.(node.id, "resolution", nextResolution);
                    onUpdateProperty?.(node.id, "aspect_ratio", nextAspectRatio);
                    if (!imageUrl && !isFrameStrip) {
                      const nextNodeSize = resolveEmptyImageNodeSize({
                        aspectRatio: nextAspectRatio,
                        isExtractedFrameNode,
                        isUploadPlaceholder: node.data?.isUploadPlaceholder === true,
                        resolution: nextResolution,
                      });
                      onUpdateData?.(node.id, {
                        imageDisplayHeight: nextNodeSize.displayHeight,
                        imageDisplayWidth: nextNodeSize.displayWidth,
                        imageNodeHeight: nextNodeSize.nodeHeight,
                        imageNodeWidth: nextNodeSize.nodeWidth,
                        imagePortCenterY: nextNodeSize.portCenterY,
                      });
                    }
                  }}
                  buttonClassName="relative inline-flex h-10 min-w-[230px] items-center justify-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModelMenuOpen(false);
                      setOpenSelect((current) => (current === "quantity" ? null : "quantity"));
                    }}
                    className={`relative inline-flex h-10 min-w-[76px] items-center justify-center gap-1.5 rounded-[14px] border px-3 text-[13px] font-medium transition-colors ${
                      openSelect === "quantity"
                        ? "border-cyan-100/34 bg-cyan-100/[0.075] text-cyan-50"
                        : "border-cyan-100/8 bg-slate-950/14 text-cyan-50/62 hover:border-cyan-100/18 hover:bg-cyan-100/[0.045] hover:text-cyan-50"
                    }`}
                  >
                    <span>{quantity.replace("张", "")}</span>
                    <span className="text-[12px] text-cyan-50/45">张</span>
                    <ChevronUp
                      className={`h-3.5 w-3.5 text-slate-300/55 transition-transform ${openSelect === "quantity" ? "" : "rotate-180"}`}
                    />
                  </button>
                  <AnimatePresence>
                    {openSelect === "quantity" && (
                      <motion.div
                        data-node-action="true"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute bottom-[calc(100%+12px)] left-0 z-50 w-[112px] rounded-[16px] border border-cyan-100/12 bg-[#0d121c]/96 p-2 shadow-[0_22px_56px_-22px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {QUANTITY_OPTIONS.map((option) => {
                          const isActive = option === quantity;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateProperty?.(node.id, "quantity", option);
                                onUpdateProperty?.(node.id, "n", Number.parseInt(option, 10));
                                setOpenSelect(null);
                              }}
                              className={`flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left transition-colors ${
                                isActive
                                  ? "bg-cyan-300/[0.1] text-cyan-50"
                                  : "text-slate-300/76 hover:bg-white/[0.055] hover:text-slate-100"
                              }`}
                            >
                              <span className="text-[13px] font-semibold">{option}</span>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" : "bg-slate-500/35"}`}
                              />
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRun();
                  }}
                  disabled={isRunning || (!upstreamPrompt && !promptText.trim())}
                  className={`ml-auto flex h-10 w-10 items-center justify-center rounded-[14px] transition-all ${
                    isRunning || (!upstreamPrompt && !promptText.trim())
                      ? "cursor-not-allowed border border-cyan-100/6 bg-slate-200/8 text-slate-200/28"
                      : "bg-cyan-50 text-[#0f172a] shadow-[0_14px_30px_-18px_rgba(103,232,249,0.9)] hover:bg-white"
                  }`}
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

const ImageNodeCard = React.memo(
  ImageNodeCardImpl,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.apiConfig?.remoteModelsByType === next.apiConfig?.remoteModelsByType &&
    prev.resolvedInputs === next.resolvedInputs
);

export default ImageNodeCard;
