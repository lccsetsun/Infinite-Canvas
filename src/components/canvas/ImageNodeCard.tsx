import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Grid3X3,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Maximize2,
  MousePointer2,
  PenLine,
  Redo2,
  Replace,
  Send,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { GraphNode } from "../../types";
import type { VideoBatchReplacementSlotKey } from "../../utils/videoBatchReplacementLayout";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { isSourceNode } from "../../utils/sourceNodes";
import { Tooltip } from "../common/Tooltip";
import { downloadMediaAsset, extensionFromAssetUrl } from "../../utils/mediaAssets";
import { uploadFileToOss } from "../../features/resource/ossApi";
import { ReferencePreviewCard, type ReferencePreviewItem } from "./ReferencePreviewCard";
import { getMediaNodeLoadingLabel, isMediaNodeRunning } from "../../utils/mediaNodeLoadingState";
import { ImageResolutionPicker } from "./ImageResolutionPicker";
import { PromptTokenEditor } from "./PromptTokenEditor";
import {
  AI_MODEL_TYPES,
  getModelOptionGroups,
  type AiModelsByType,
} from "../../features/api/aiModelCatalog";
import {
  getImageResolutionPreset,
  type ImageResolutionPresetGroup,
} from "../../features/nodes/imageResolutionPresets";
import {
  getFloatingMenuPosition,
  type FloatingMenuPosition,
} from "../../utils/floatingMenuPosition";
import { cropImageGridCell } from "../../utils/imageGridSplit";
import { stringifyInputReferenceValues } from "../../utils/inputReferenceValues";
import { InlineNodePortHandle } from "./InlineNodePortHandle";
import { getImageLoadingMode, getStripThumbnailLoadingMode } from "../../utils/mediaPreviewPolicy";
import {
  createArrowAnnotation,
  createPenAnnotation,
  createRectAnnotation,
  createTextAnnotation,
  getNormalizedAnnotationPoint,
  hitTestImageAnnotation,
  moveImageAnnotation,
  resizeImageArrowAnnotation,
  sanitizeImageAnnotations,
  type ImageArrowEndpoint,
  type ImageAnnotation,
  type ImageAnnotationPoint,
} from "../../utils/imageAnnotations";
import {
  getReadableCanvasOverlayScale,
  getMediaNodeFloatingToolbarGap,
  mediaNodeFloatingToolbarRaisedClass,
  mediaNodeToolbarButtonClass,
  mediaNodeToolbarDividerClass,
  mediaNodeToolbarUploadButtonClass,
} from "./mediaNodeToolbarStyles";

interface ImageNodeCardProps {
  node: GraphNode;
  selected: boolean;
  detachedCanvasTitle?: boolean;
  canvasZoom?: number;
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
    clientPoint?: { clientX: number; clientY: number },
    frameNaturalSize?: { width: number; height: number }
  ) => void;
  onReplaceExtractedFrame?: (nodeId: string) => void;
  onReplaceFrameImage?: (
    nodeId: string,
    frameIndex: number,
    replacementUrl: string,
    replacementOssId?: string
  ) => void;
  onSyncImagePromptStarterLayout?: (nodeId: string, imageNodeWidth: number) => void;
  onSplitImageGrid?: (
    nodeId: string,
    imageUrl: string,
    gridRows: number,
    gridCols: number,
    cellIndices: number[],
    clientPoint?: { clientX: number; clientY: number }
  ) => void;
  onReplaceImageGridCell?: (
    nodeId: string,
    imageUrl: string,
    replacementUrl: string,
    gridRows: number,
    gridCols: number,
    cellIndex: number
  ) => void;
  onDropImageToVideoBatchReplacement?: (
    nodeId: string,
    slotKey: VideoBatchReplacementSlotKey,
    imageUrl: string,
    ossId?: string
  ) => void;
  onCreateBatchReplacement?: (node: GraphNode) => void;
  onReviewAsset?: (nodeId: string, ossId: string) => void;
  onPreview?: (
    content: string,
    title?: string,
    nodeId?: string,
    items?: string[],
    currentIndex?: number
  ) => void;
  resolvedInputs?: Record<string, unknown>;
  references?: ReferencePreviewItem[];
  resolutionPresetGroups?: ImageResolutionPresetGroup[];
  onRun?: (nodeId: string) => void;
  isReviewingAsset?: boolean;
  onNotice?: (message: string) => void;
  onRemoveInputReference?: (linkId: string, value: string) => void;
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
const BATCH_REPLACEMENT_FRAME_PLACEHOLDER = "__batch_replacement_frame_placeholder__";
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
const IMAGE_ANNOTATION_COLORS = [
  "#ff4d4f",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#38bdf8",
  "#2563eb",
  "#a855f7",
  "#ec4899",
  "#ffffff",
  "#111827",
] as const;
const IMAGE_ANNOTATION_STROKE_WIDTHS = [1, 2, 4, 6, 8, 12, 16] as const;
type ImageAnnotationTool = "select" | "pen" | "rect" | "arrow" | "text";
const IMAGE_ANNOTATION_COLOR_MENU_WIDTH = 180;
const IMAGE_ANNOTATION_STROKE_MENU_WIDTH = 148;
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
const FRAME_TILE_ACTION_BAR_CLASS =
  "absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 translate-y-1 items-center gap-1 rounded-full border border-white/12 bg-[#0b1320]/76 p-1 opacity-0 shadow-[0_14px_32px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all duration-200 group-hover/frame:translate-y-0 group-hover/frame:opacity-100";
const FRAME_TILE_EXTRACT_BUTTON_CLASS =
  "flex h-7 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold leading-none text-cyan-50/92 transition-colors hover:bg-cyan-100/12 hover:text-white";
const FRAME_TILE_ICON_BUTTON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-full text-slate-100/84 transition-colors hover:bg-violet-100/12 hover:text-white";

function getDragThumbAnchorX(clientX: number, originClientX: number, thumbWidth: number) {
  return clientX + (clientX >= originClientX ? -1 : 1) * (thumbWidth / 2 + 8);
}

function getDragConnectorPath(
  originClientX: number,
  originClientY: number,
  targetClientX: number,
  targetClientY: number
) {
  return `M ${originClientX} ${originClientY} L ${targetClientX} ${targetClientY}`;
}

function getElementEdgeAnchor(element: HTMLElement, targetClientX: number, targetClientY: number) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = targetClientX - centerX;
  const dy = targetClientY - centerY;

  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return { x: centerX, y: centerY };
  }

  const scaleX = Math.abs(dx) > 0.01 ? rect.width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 0.01 ? rect.height / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  };
}

function getImageModelLabel(model: string) {
  return model;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function getAnnotationPenPath(points: ImageAnnotationPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function getAnnotationStyleMenuMotionOffset(position: FloatingMenuPosition) {
  return position.placement === "bottom" ? -8 : 8;
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

  return `mx-auto overflow-hidden ${surfaceClassName} ${selectedClassName}`;
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

export function shouldShowImagePromptComposer({
  isFrameStrip,
  isRunning,
  isSelected,
  isSourceAssetNode,
  isUploadingNodeAsset,
}: {
  isFrameStrip: boolean;
  isRunning: boolean;
  isSelected: boolean;
  isSourceAssetNode: boolean;
  isUploadingNodeAsset: boolean;
}) {
  return !isFrameStrip && !isSourceAssetNode && isSelected && !isUploadingNodeAsset && !isRunning;
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

export function getImageNodeDownloadVisibility({ isFrameStrip }: { isFrameStrip: boolean }) {
  return {
    showFrameTileDownload: isFrameStrip,
    showTopToolbarDownload: !isFrameStrip,
  };
}

function formatBatchReplacementElapsedTime(elapsedMs: number) {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const seconds = Math.floor(safeElapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function getBatchReplacementResultElapsedLabel({
  finishedAt,
  isRunning,
  now,
  startedAt,
}: {
  finishedAt?: number;
  isRunning: boolean;
  now: number;
  startedAt?: number;
}) {
  if (typeof startedAt !== "number" || startedAt <= 0) {
    return isRunning || typeof finishedAt === "number"
      ? formatBatchReplacementElapsedTime(0)
      : "";
  }
  const endAt = typeof finishedAt === "number" && finishedAt >= startedAt ? finishedAt : now;
  if (!isRunning && typeof finishedAt !== "number") return "";
  return formatBatchReplacementElapsedTime(endAt - startedAt);
}

function normalizeImageNodeOssId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "bigint") return String(value);
  return "";
}

export function getPrimaryImageNodeOssId(node: GraphNode, imageUrl: string): string {
  const imageUrls = Array.isArray(node.data?.imageUrls) ? node.data.imageUrls : [];
  const ossIds = Array.isArray(node.data?.ossIds) ? node.data.ossIds : [];
  const matchedIndex = imageUrls.findIndex((url) => typeof url === "string" && url === imageUrl);
  if (matchedIndex >= 0) {
    const matchedOssId = normalizeImageNodeOssId(ossIds[matchedIndex]);
    if (matchedOssId) return matchedOssId;
  }
  return (
    normalizeImageNodeOssId(node.data?.ossId) ||
    normalizeImageNodeOssId(node.properties.ossId) ||
    normalizeImageNodeOssId(ossIds[0])
  );
}

export function getFrameStripDownloadFilename({
  frameIndex,
  nodeTitle,
  timestamp,
  url,
}: {
  frameIndex: number;
  nodeTitle: string;
  timestamp: number;
  url: string;
}) {
  const baseName = nodeTitle.replace(/\s+/g, "-") || "frame-analysis";
  return `${baseName}-frame-${frameIndex + 1}-${timestamp}.${extensionFromAssetUrl(url, "png")}`;
}

export function getFrameStripAdaptiveLayout({
  fallbackTileHeight,
  fallbackTileWidth,
  fixedTileSize = false,
  imageSizes,
  imageUrls,
  maxColumns,
}: {
  fallbackTileHeight: number;
  fallbackTileWidth: number;
  fixedTileSize?: boolean;
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
    if (fixedTileSize) {
      return {
        height: safeFallbackHeight,
        width: safeFallbackWidth,
      };
    }
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
  const rowTileHeight = fixedTileSize ? safeFallbackHeight : targetHeight;

  return {
    height: Math.max(
      safeFallbackHeight,
      rowCount * rowTileHeight +
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

export function resolveImageNodeSizePresetData({
  aspectRatio,
  hasImageUrl,
  isExtractedFrameNode,
  isFrameStrip,
  isUploadPlaceholder,
  resolution,
}: {
  aspectRatio: string;
  hasImageUrl: boolean;
  isExtractedFrameNode: boolean;
  isFrameStrip: boolean;
  isUploadPlaceholder: boolean;
  resolution: string;
}) {
  if (hasImageUrl || isFrameStrip) return null;

  const nextNodeSize = resolveEmptyImageNodeSize({
    aspectRatio,
    isExtractedFrameNode,
    isUploadPlaceholder,
    resolution,
  });

  return {
    imageDisplayHeight: nextNodeSize.displayHeight,
    imageDisplayWidth: nextNodeSize.displayWidth,
    imageNodeHeight: nextNodeSize.nodeHeight,
    imageNodeWidth: nextNodeSize.nodeWidth,
    imagePortCenterY: nextNodeSize.portCenterY,
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
  detachedCanvasTitle = false,
  canvasZoom = 1,
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
  onReplaceImageGridCell,
  onDropImageToVideoBatchReplacement,
  onCreateBatchReplacement,
  onReviewAsset,
  onPreview,
  references,
  resolvedInputs,
  resolutionPresetGroups,
  onRun,
  isReviewingAsset = false,
  onNotice,
  onRemoveInputReference,
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
  const isInterrupted = node.data?.status === "interrupted";
  const [isHovered, setIsHovered] = React.useState(false);
  const [expandedPromptEditorOpen, setExpandedPromptEditorOpen] = React.useState(false);
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
  const [annotationMode, setAnnotationMode] = React.useState(false);
  const [annotationTool, setAnnotationTool] = React.useState<ImageAnnotationTool>("rect");
  const [annotationColor, setAnnotationColor] = React.useState<(typeof IMAGE_ANNOTATION_COLORS)[number]>(
    IMAGE_ANNOTATION_COLORS[0]
  );
  const [annotationStrokeWidth, setAnnotationStrokeWidth] =
    React.useState<(typeof IMAGE_ANNOTATION_STROKE_WIDTHS)[number]>(4);
  const [annotationColorMenuOpen, setAnnotationColorMenuOpen] = React.useState(false);
  const [annotationStrokeMenuOpen, setAnnotationStrokeMenuOpen] = React.useState(false);
  const [annotationColorMenuPosition, setAnnotationColorMenuPosition] =
    React.useState<FloatingMenuPosition | null>(null);
  const [annotationStrokeMenuPosition, setAnnotationStrokeMenuPosition] =
    React.useState<FloatingMenuPosition | null>(null);
  const [annotationDraft, setAnnotationDraft] = React.useState<
    | { type: "rect"; start: ImageAnnotationPoint; current: ImageAnnotationPoint }
    | { type: "arrow"; start: ImageAnnotationPoint; current: ImageAnnotationPoint }
    | { type: "pen"; points: ImageAnnotationPoint[] }
    | null
  >(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = React.useState<string | null>(null);
  const [annotationUndoStack, setAnnotationUndoStack] = React.useState<ImageAnnotation[][]>([]);
  const [annotationRedoStack, setAnnotationRedoStack] = React.useState<ImageAnnotation[][]>([]);
  const annotationMoveRef = React.useRef<{
    id: string;
    moved: boolean;
    originalAnnotations: ImageAnnotation[];
    resizeEndpoint?: ImageArrowEndpoint;
    start: ImageAnnotationPoint;
  } | null>(null);
  const controlsRef = React.useRef<HTMLDivElement | null>(null);
  const annotationStyleMenuRef = React.useRef<HTMLDivElement | null>(null);
  const annotationColorButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const annotationStrokeButtonRef = React.useRef<HTMLButtonElement | null>(null);
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
  const getFrameNaturalSize = React.useCallback(
    (frameIndex: number) => {
      const size = frameImageSizes[frameIndex];
      if (!size || !isFinitePositiveNumber(size.width) || !isFinitePositiveNumber(size.height)) {
        return undefined;
      }
      return { width: size.width, height: size.height };
    },
    [frameImageSizes]
  );
  const previewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const mediaFrameRef = React.useRef<HTMLDivElement | null>(null);
  const imageElementRef = React.useRef<HTMLImageElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const frameExtractionDragRef = React.useRef<{
    mode: "frame" | "grid";
    cellIndex?: number;
    element: HTMLElement;
    frameIndex: number;
    gridCols?: number;
    gridRows?: number;
    ossId?: string;
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
    head: SVGPathElement;
    line: SVGPathElement;
    pulse: SVGPathElement;
    origin: SVGCircleElement;
    rail: SVGPathElement;
    softPulse: SVGPathElement;
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
    ossId?: string;
    url: string;
  } | null>(null);
  const imageFrameDropCleanupRef = React.useRef<(() => void) | null>(null);
  const imageFrameDropOverlayRef = React.useRef<{
    head: SVGPathElement;
    line: SVGPathElement;
    pulse: SVGPathElement;
    rail: SVGPathElement;
    softPulse: SVGPathElement;
    root: HTMLDivElement;
    thumb: HTMLDivElement;
  } | null>(null);
  const imageFrameDropHotTargetRef = React.useRef<HTMLElement | null>(null);
  const imageFrameDropLongPressTimerRef = React.useRef<number | null>(null);
  const [isUploadingAsset, setIsUploadingAsset] = React.useState(false);
  const isUploadingNodeAsset = node.data?.uploadingAsset === true || isUploadingAsset;
  const floatingCanvasUiScale = 1 / Math.max(0.55, Math.min(3, canvasZoom));
  const floatingToolbarGap = getMediaNodeFloatingToolbarGap(canvasZoom);
  const promptComposerCanvasScale = getReadableCanvasOverlayScale(canvasZoom);
  const elapsedBadgeStyle = {
    scale: promptComposerCanvasScale,
    transformOrigin: "center",
  } as React.CSSProperties;
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
    () =>
      references && references.length > 0
        ? references
        : getImageNodeInputReferences(resolvedInputs),
    [references, resolvedInputs]
  );
  const removeInputReference = React.useCallback(
    (reference: ReferencePreviewItem) => {
      if (reference.linkId) onRemoveInputReference?.(reference.linkId, reference.value);
    },
    [onRemoveInputReference]
  );
  const hasNonTextInputReferences = inputReferences.some((reference) => reference.kind !== "text");
  const promptText = (node.properties.text as string) || "";
  const canRunImagePrompt = Boolean(
    upstreamPrompt || promptText.trim() || inputReferences.length > 0
  );
  const isLegacyBatchReplacementResultTitle =
    typeof node.title === "string" &&
    (/批量替换结果/.test(node.title) || /鎵归噺鏇挎崲缁撴灉/.test(node.title));
  const hasBatchReplacementResultCount =
    typeof node.data?.batchReplacementResultCount === "number" &&
    node.data.batchReplacementResultCount > 0;
  const isExtractedFrameNode =
    typeof node.data?.extractedFrameSourceNodeId === "string" &&
    typeof node.data?.extractedFrameIndex === "number";
  const isBatchReplacementResultNode =
    !isExtractedFrameNode &&
    (typeof node.data?.batchReplacementRunId === "string" ||
      (typeof node.data?.batchReplacementSourceNodeId === "string" &&
        hasBatchReplacementResultCount) ||
      (node.data?.loadingOperation === "batch-replacement" && hasBatchReplacementResultCount) ||
      (isLegacyBatchReplacementResultTitle &&
        (node.data?.isFrameStrip === true ||
          (Array.isArray(node.data?.imageUrls) && node.data.imageUrls.length > 0) ||
          node.data?.loading === true)));
  const isBatchReplacementResultLoading =
    node.data?.loading === true ||
    node.data?.status === "loading" ||
    node.data?.loadingOperation === "batch-replacement";
  const imageUrls = React.useMemo(() => {
    const rawImageUrls =
      Array.isArray(node.data?.imageUrls) && node.data?.imageUrls.length
        ? node.data.imageUrls.filter(
            (url): url is string => typeof url === "string" && Boolean(url)
          )
        : [];
    if (!isBatchReplacementResultNode) return rawImageUrls;
    if (!isBatchReplacementResultLoading) {
      return rawImageUrls.filter(
        (url) =>
          url !== BATCH_REPLACEMENT_FRAME_PLACEHOLDER && !url.startsWith("data:image/svg+xml")
      );
    }

    const frameCount =
      typeof node.data?.batchReplacementResultCount === "number" &&
      node.data.batchReplacementResultCount > 0
        ? Math.trunc(node.data.batchReplacementResultCount)
        : rawImageUrls.length ||
          (Array.isArray(node.data?.frameImageOssIds) ? node.data.frameImageOssIds.length : 0);
    return Array.from({ length: frameCount }, (_, index) => {
      const url = rawImageUrls[index];
      if (!url || url.startsWith("data:image/svg+xml")) return BATCH_REPLACEMENT_FRAME_PLACEHOLDER;
      return url;
    });
  }, [isBatchReplacementResultLoading, isBatchReplacementResultNode, node.data]);
  const fallbackImageUrl =
    (node.data?.imageUrl as string) || (node.properties.imageUrl as string) || "";
  const resolvedImageUrls = React.useMemo(
    () => (imageUrls.length ? imageUrls : fallbackImageUrl ? [fallbackImageUrl] : []),
    [fallbackImageUrl, imageUrls]
  );
  const imageUrl = resolvedImageUrls[activeImageIndex] || resolvedImageUrls[0] || "";
  const imageAnnotations = React.useMemo(
    () => sanitizeImageAnnotations(node.data?.annotations),
    [node.data?.annotations]
  );
  const reviewOssId = getPrimaryImageNodeOssId(node, imageUrl);
  const isEmptyBatchReplacementSuccess =
    isBatchReplacementResultNode &&
    !isBatchReplacementResultLoading &&
    node.data?.status === "success" &&
    hasBatchReplacementResultCount &&
    resolvedImageUrls.length === 0;
  const isSourceAssetNode = isSourceNode(node);
  const isFrameStrip = node.data?.isFrameStrip === true || isBatchReplacementResultNode;
  const frameGridColumns = Math.max(1, Math.min(8, Math.round(node.data?.frameGridColumns ?? 5)));
  const batchReplacementResultColumnCount = isBatchReplacementResultNode
    ? Math.max(1, Math.min(resolvedImageUrls.length || 1, frameGridColumns))
    : 0;
  const frameTileWidth =
    typeof node.data?.frameTileWidth === "number" && node.data.frameTileWidth > 0
      ? Math.round(node.data.frameTileWidth)
      : FRAME_STRIP_TILE_MIN_WIDTH;
  const frameTileHeight =
    typeof node.data?.frameTileHeight === "number" && node.data.frameTileHeight > 0
      ? Math.round(node.data.frameTileHeight)
      : FRAME_STRIP_TILE_MIN_HEIGHT;
  const frameImageOssIds = Array.isArray(node.data?.frameImageOssIds)
    ? node.data.frameImageOssIds
    : Array.isArray(node.properties.frameImageOssIds)
      ? node.properties.frameImageOssIds
      : [];
  const getFrameImageOssId = (frameIndex: number) => {
    const ossId = frameImageOssIds[frameIndex];
    return typeof ossId === "string" ? ossId.trim() : "";
  };
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
      const tailGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      tailGradient.setAttribute("id", `frame-drag-energy-tail-${node.id}`);
      tailGradient.setAttribute("x1", "0%");
      tailGradient.setAttribute("y1", "0%");
      tailGradient.setAttribute("x2", "100%");
      tailGradient.setAttribute("y2", "0%");
      [
        ["0%", "rgba(103,232,249,0)"],
        ["30%", "rgba(103,232,249,0.18)"],
        ["72%", "rgba(167,139,250,0.86)"],
        ["100%", "rgba(224,231,255,0.18)"],
      ].forEach(([offset, stopColor]) => {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", stopColor);
        tailGradient.appendChild(stop);
      });
      const headGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      headGradient.setAttribute("id", `frame-drag-energy-head-${node.id}`);
      headGradient.setAttribute("x1", "0%");
      headGradient.setAttribute("y1", "0%");
      headGradient.setAttribute("x2", "100%");
      headGradient.setAttribute("y2", "0%");
      [
        ["0%", "rgba(224,231,255,0.08)"],
        ["46%", "rgba(255,255,255,0.98)"],
        ["100%", "rgba(103,232,249,0.94)"],
      ].forEach(([offset, stopColor]) => {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", stopColor);
        headGradient.appendChild(stop);
      });
      defs.append(tailGradient, headGradient);

      const thumbAnchorX = getDragThumbAnchorX(clientX, drag.originClientX, drag.thumbWidth);
      const originAnchor = getElementEdgeAnchor(drag.element, thumbAnchorX, clientY);
      const pathD = getDragConnectorPath(originAnchor.x, originAnchor.y, thumbAnchorX, clientY);
      const rail = document.createElementNS("http://www.w3.org/2000/svg", "path");
      rail.setAttribute("d", pathD);
      rail.setAttribute("fill", "none");
      rail.setAttribute("stroke", "rgba(34,211,238,0.22)");
      rail.setAttribute("stroke-width", "7");
      rail.setAttribute("opacity", "0.46");
      rail.setAttribute("filter", `url(#frame-drag-native-glow-${node.id})`);
      rail.setAttribute("stroke-linecap", "round");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", pathD);
      line.setAttribute("data-origin-x", String(originAnchor.x));
      line.setAttribute("data-origin-y", String(originAnchor.y));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "rgba(224,231,255,0.72)");
      line.setAttribute("stroke-width", "1.65");
      line.setAttribute("stroke-linecap", "round");
      const pulse = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pulse.setAttribute("d", pathD);
      pulse.setAttribute("class", "link-energy-pulse");
      pulse.setAttribute("pathLength", "100");
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", `url(#frame-drag-energy-tail-${node.id})`);
      pulse.setAttribute("stroke-dasharray", "34 66");
      pulse.setAttribute("stroke-linecap", "round");
      pulse.setAttribute("stroke-width", "3");
      pulse.setAttribute("filter", `url(#frame-drag-native-glow-${node.id})`);
      const softPulse = document.createElementNS("http://www.w3.org/2000/svg", "path");
      softPulse.setAttribute("d", pathD);
      softPulse.setAttribute("class", "link-energy-pulse link-energy-pulse-soft");
      softPulse.setAttribute("pathLength", "100");
      softPulse.setAttribute("fill", "none");
      softPulse.setAttribute("stroke", "rgba(196,181,253,0.62)");
      softPulse.setAttribute("stroke-dasharray", "16 84");
      softPulse.setAttribute("stroke-linecap", "round");
      softPulse.setAttribute("stroke-width", "1.45");
      const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
      head.setAttribute("d", pathD);
      head.setAttribute("class", "link-energy-pulse-head");
      head.setAttribute("pathLength", "100");
      head.setAttribute("fill", "none");
      head.setAttribute("stroke", `url(#frame-drag-energy-head-${node.id})`);
      head.setAttribute("stroke-dasharray", "3 97");
      head.setAttribute("stroke-linecap", "round");
      head.setAttribute("stroke-width", "2");
      head.setAttribute("filter", `url(#frame-drag-native-glow-${node.id})`);
      const origin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      origin.setAttribute("cx", String(originAnchor.x));
      origin.setAttribute("cy", String(originAnchor.y));
      origin.setAttribute("r", "5.5");
      origin.setAttribute("fill", "rgba(191,219,254,0.98)");
      origin.setAttribute("stroke", "rgba(255,255,255,0.76)");
      origin.setAttribute("stroke-width", "1.5");
      origin.setAttribute("filter", `url(#frame-drag-native-glow-${node.id})`);
      svg.append(defs, rail, line, pulse, softPulse, head, origin);

      const thumb = document.createElement("div");
      thumb.setAttribute("data-frame-drag-thumb", "true");
      Object.assign(thumb.style, {
        background: "rgba(13,20,33,0.9)",
        border: "1px solid rgba(196,210,255,0.55)",
        borderRadius: "12px",
        boxShadow:
          "0 18px 38px -18px rgba(0,0,0,0.96), 0 0 0 1px rgba(129,140,248,0.22), 0 0 28px rgba(129,140,248,0.28)",
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
      frameExtractionOverlayRef.current = {
        head,
        line,
        origin,
        pulse,
        rail,
        root,
        softPulse,
        thumb,
      };
    },
    [destroyFrameExtractionOverlay, node.id]
  );
  const updateFrameExtractionOverlay = React.useCallback((clientX: number, clientY: number) => {
    const overlay = frameExtractionOverlayRef.current;
    if (!overlay) return;
    const drag = frameExtractionDragRef.current;
    const thumbWidth = drag?.thumbWidth ?? overlay.thumb.offsetWidth;
    const thumbHeight = drag?.thumbHeight ?? overlay.thumb.offsetHeight;
    const fallbackOriginX = Number.parseFloat(overlay.origin.getAttribute("cx") || "0");
    const fallbackOriginY = Number.parseFloat(overlay.origin.getAttribute("cy") || "0");
    const originClientX = drag?.originClientX ?? fallbackOriginX;
    const thumbAnchorX = getDragThumbAnchorX(clientX, originClientX, thumbWidth);
    const originAnchor = drag?.element
      ? getElementEdgeAnchor(drag.element, thumbAnchorX, clientY)
      : { x: fallbackOriginX, y: fallbackOriginY };
    const pathD = getDragConnectorPath(originAnchor.x, originAnchor.y, thumbAnchorX, clientY);
    overlay.line.setAttribute("d", pathD);
    overlay.line.setAttribute("data-origin-x", String(originAnchor.x));
    overlay.line.setAttribute("data-origin-y", String(originAnchor.y));
    overlay.rail.setAttribute("d", pathD);
    overlay.pulse.setAttribute("d", pathD);
    overlay.softPulse.setAttribute("d", pathD);
    overlay.head.setAttribute("d", pathD);
    overlay.origin.setAttribute("cx", String(originAnchor.x));
    overlay.origin.setAttribute("cy", String(originAnchor.y));
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
        if (drag.mode === "grid") {
          const cellIndex = drag.cellIndex ?? drag.frameIndex;
          const gridRows = drag.gridRows ?? activeGridSelection?.rows;
          const gridCols = drag.gridCols ?? activeGridSelection?.cols;
          if (gridRows && gridCols && imageUrl) {
            onSplitImageGrid?.(node.id, imageUrl, gridRows, gridCols, [cellIndex], {
              clientX,
              clientY,
            });
          }
        } else {
          onExtractFrameImage?.(
            node.id,
            drag.frameIndex,
            {
              clientX,
              clientY,
            },
            getFrameNaturalSize(drag.frameIndex)
          );
        }
        return;
      }
      if (drag.mode === "grid") return;
      setActiveImageIndex(drag.frameIndex);
      onSetPrimaryImageResult?.(node.id, drag.url, drag.frameIndex);
    },
    [
      activeGridSelection?.cols,
      activeGridSelection?.rows,
      cleanupFrameExtractionDragListeners,
      destroyFrameExtractionOverlay,
      getFrameNaturalSize,
      imageUrl,
      node.id,
      onExtractFrameImage,
      onSetPrimaryImageResult,
      onSplitImageGrid,
      setActiveImageIndex,
    ]
  );
  const beginFrameExtractionDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, frameIndex: number, url: string, ossId?: string) => {
      if (!onExtractFrameImage || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupFrameExtractionDragListeners();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      frameExtractionDragRef.current = {
        element: event.currentTarget,
        frameIndex,
        mode: "frame",
        originClientX: rect.left + rect.width / 2,
        originClientY: rect.top + rect.height / 2,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        thumbHeight: Math.max(1, Math.round(rect.height / 2)),
        thumbWidth: Math.max(1, Math.round(rect.width / 2)),
        ossId,
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
      destroyFrameExtractionOverlay,
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
    [finishFrameExtractionDrag, node.id, onSetPrimaryImageResult, setActiveImageIndex]
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
  const beginGridCellExtractionDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, cellIndex: number) => {
      if (!onSplitImageGrid || !activeGridSelection || !imageUrl || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      cleanupFrameExtractionDragListeners();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      frameExtractionDragRef.current = {
        cellIndex,
        element: event.currentTarget,
        frameIndex: cellIndex,
        gridCols: activeGridSelection.cols,
        gridRows: activeGridSelection.rows,
        mode: "grid",
        originClientX: rect.left + rect.width / 2,
        originClientY: rect.top + rect.height / 2,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        thumbHeight: Math.max(1, Math.round(rect.height / 2)),
        thumbWidth: Math.max(1, Math.round(rect.width / 2)),
        url: imageUrl,
        dragging: false,
      };
      let lastClientX = event.clientX;
      let lastClientY = event.clientY;
      frameExtractionLongPressTimerRef.current = window.setTimeout(() => {
        const drag = frameExtractionDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || drag.mode !== "grid") return;
        drag.dragging = true;
        frameExtractionLongPressTimerRef.current = null;
        void cropImageGridCell(
          imageUrl,
          activeGridSelection.rows,
          cellIndex,
          activeGridSelection.cols
        )
          .then(({ dataUrl }) => {
            const current = frameExtractionDragRef.current;
            if (!current || current.pointerId !== event.pointerId || current.mode !== "grid")
              return;
            current.url = dataUrl;
            updateFrameExtractionDragPreview(event.pointerId, lastClientX, lastClientY);
          })
          .catch(() => {
            updateFrameExtractionDragPreview(event.pointerId, lastClientX, lastClientY);
          });
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
      activeGridSelection,
      cleanupFrameExtractionDragListeners,
      destroyFrameExtractionOverlay,
      finishFrameExtractionDrag,
      imageUrl,
      onSplitImageGrid,
      updateFrameExtractionDragPreview,
    ]
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
    target.removeAttribute("data-video-batch-hot");
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
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
      filter.setAttribute("id", `image-frame-drop-glow-${node.id}`);
      filter.setAttribute("x", "-35%");
      filter.setAttribute("y", "-80%");
      filter.setAttribute("width", "170%");
      filter.setAttribute("height", "260%");
      const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
      blur.setAttribute("stdDeviation", "4.5");
      blur.setAttribute("result", "blur");
      const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
      const blurNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
      blurNode.setAttribute("in", "blur");
      const sourceNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
      sourceNode.setAttribute("in", "SourceGraphic");
      merge.append(blurNode, sourceNode);
      filter.append(blur, merge);
      const tailGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      tailGradient.setAttribute("id", `image-frame-drop-energy-tail-${node.id}`);
      tailGradient.setAttribute("x1", "0%");
      tailGradient.setAttribute("y1", "0%");
      tailGradient.setAttribute("x2", "100%");
      tailGradient.setAttribute("y2", "0%");
      [
        ["0%", "rgba(103,232,249,0)"],
        ["30%", "rgba(103,232,249,0.18)"],
        ["72%", "rgba(167,139,250,0.86)"],
        ["100%", "rgba(224,231,255,0.18)"],
      ].forEach(([offset, stopColor]) => {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", stopColor);
        tailGradient.appendChild(stop);
      });
      const headGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      headGradient.setAttribute("id", `image-frame-drop-energy-head-${node.id}`);
      headGradient.setAttribute("x1", "0%");
      headGradient.setAttribute("y1", "0%");
      headGradient.setAttribute("x2", "100%");
      headGradient.setAttribute("y2", "0%");
      [
        ["0%", "rgba(224,231,255,0.08)"],
        ["46%", "rgba(255,255,255,0.98)"],
        ["100%", "rgba(103,232,249,0.94)"],
      ].forEach(([offset, stopColor]) => {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", stopColor);
        headGradient.appendChild(stop);
      });
      defs.append(filter, tailGradient, headGradient);
      const thumbAnchorX = getDragThumbAnchorX(clientX, drag.originClientX, drag.thumbWidth);
      const originAnchor = getElementEdgeAnchor(drag.element, thumbAnchorX, clientY);
      const pathD = getDragConnectorPath(originAnchor.x, originAnchor.y, thumbAnchorX, clientY);
      const rail = document.createElementNS("http://www.w3.org/2000/svg", "path");
      rail.setAttribute("d", pathD);
      rail.setAttribute("fill", "none");
      rail.setAttribute("stroke", "rgba(34,211,238,0.22)");
      rail.setAttribute("stroke-width", "7");
      rail.setAttribute("opacity", "0.46");
      rail.setAttribute("filter", `url(#image-frame-drop-glow-${node.id})`);
      rail.setAttribute("stroke-linecap", "round");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", pathD);
      line.setAttribute("data-origin-x", String(originAnchor.x));
      line.setAttribute("data-origin-y", String(originAnchor.y));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "rgba(224,231,255,0.72)");
      line.setAttribute("stroke-width", "1.65");
      line.setAttribute("stroke-linecap", "round");
      const pulse = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pulse.setAttribute("d", pathD);
      pulse.setAttribute("class", "link-energy-pulse");
      pulse.setAttribute("pathLength", "100");
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", `url(#image-frame-drop-energy-tail-${node.id})`);
      pulse.setAttribute("stroke-dasharray", "34 66");
      pulse.setAttribute("stroke-linecap", "round");
      pulse.setAttribute("stroke-width", "3");
      pulse.setAttribute("filter", `url(#image-frame-drop-glow-${node.id})`);
      const softPulse = document.createElementNS("http://www.w3.org/2000/svg", "path");
      softPulse.setAttribute("d", pathD);
      softPulse.setAttribute("class", "link-energy-pulse link-energy-pulse-soft");
      softPulse.setAttribute("pathLength", "100");
      softPulse.setAttribute("fill", "none");
      softPulse.setAttribute("stroke", "rgba(196,181,253,0.62)");
      softPulse.setAttribute("stroke-dasharray", "16 84");
      softPulse.setAttribute("stroke-linecap", "round");
      softPulse.setAttribute("stroke-width", "1.45");
      const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
      head.setAttribute("d", pathD);
      head.setAttribute("class", "link-energy-pulse-head");
      head.setAttribute("pathLength", "100");
      head.setAttribute("fill", "none");
      head.setAttribute("stroke", `url(#image-frame-drop-energy-head-${node.id})`);
      head.setAttribute("stroke-dasharray", "3 97");
      head.setAttribute("stroke-linecap", "round");
      head.setAttribute("stroke-width", "2");
      head.setAttribute("filter", `url(#image-frame-drop-glow-${node.id})`);
      svg.append(defs, rail, line, pulse, softPulse, head);

      const thumb = document.createElement("div");
      thumb.setAttribute("data-image-frame-drop-thumb", "true");
      Object.assign(thumb.style, {
        background: "rgba(13,20,33,0.9)",
        border: "1px solid rgba(196,210,255,0.55)",
        borderRadius: "12px",
        boxShadow:
          "0 18px 38px -18px rgba(0,0,0,0.96), 0 0 0 1px rgba(129,140,248,0.22), 0 0 28px rgba(129,140,248,0.28)",
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
      imageFrameDropOverlayRef.current = { head, line, pulse, rail, root, softPulse, thumb };
    },
    [destroyImageFrameDropOverlay, node.id]
  );
  const setImageFrameDropHotTarget = React.useCallback(
    (target: HTMLElement | null) => {
      if (imageFrameDropHotTargetRef.current === target) return;
      clearImageFrameDropHotTarget();
      if (!target) return;
      if (target.hasAttribute("data-video-batch-slot-key")) {
        target.setAttribute("data-video-batch-hot", "true");
      } else {
        target.setAttribute("data-frame-drop-hot", "true");
      }
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
      const drag = imageFrameDropDragRef.current;
      const thumbWidth = drag?.thumbWidth ?? overlay.thumb.offsetWidth;
      const thumbHeight = drag?.thumbHeight ?? overlay.thumb.offsetHeight;
      const originClientX =
        drag?.originClientX ?? Number.parseFloat(overlay.line.getAttribute("data-origin-x") || "0");
      const originClientY =
        drag?.originClientY ?? Number.parseFloat(overlay.line.getAttribute("data-origin-y") || "0");
      const thumbAnchorX = getDragThumbAnchorX(clientX, originClientX, thumbWidth);
      const originAnchor = drag?.element
        ? getElementEdgeAnchor(drag.element, thumbAnchorX, clientY)
        : { x: originClientX, y: originClientY };
      const pathD = getDragConnectorPath(originAnchor.x, originAnchor.y, thumbAnchorX, clientY);
      overlay.line.setAttribute("d", pathD);
      overlay.line.setAttribute("data-origin-x", String(originAnchor.x));
      overlay.line.setAttribute("data-origin-y", String(originAnchor.y));
      overlay.rail.setAttribute("d", pathD);
      overlay.pulse.setAttribute("d", pathD);
      overlay.softPulse.setAttribute("d", pathD);
      overlay.head.setAttribute("d", pathD);
      overlay.thumb.style.left = `${clientX - thumbWidth / 2}px`;
      overlay.thumb.style.top = `${clientY - thumbHeight / 2}px`;

      const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const target = element?.closest(
        "[data-frame-strip-cell='true'],[data-grid-split-cell='true'],[data-video-batch-slot-key]"
      ) as HTMLElement | null;
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
      if (hotTarget.hasAttribute("data-video-batch-slot-key")) {
        const targetNodeId = hotTarget.getAttribute("data-video-batch-node-id") || "";
        const slotKey = hotTarget.getAttribute("data-video-batch-slot-key") || "";
        if (targetNodeId && (slotKey === "front" || slotKey === "side" || slotKey === "back")) {
          onDropImageToVideoBatchReplacement?.(targetNodeId, slotKey, drag.url, drag.ossId);
        }
        return;
      }
      if (hotTarget.getAttribute("data-grid-split-cell") === "true") {
        const targetNodeId = hotTarget.getAttribute("data-grid-node-id") || "";
        const targetImageUrl = hotTarget.getAttribute("data-grid-image-url") || "";
        const targetCellIndex = Number.parseInt(
          hotTarget.getAttribute("data-grid-cell-index") || "-1",
          10
        );
        const targetGridRows = Number.parseInt(hotTarget.getAttribute("data-grid-rows") || "0", 10);
        const targetGridCols = Number.parseInt(hotTarget.getAttribute("data-grid-cols") || "0", 10);
        if (
          targetNodeId &&
          targetImageUrl &&
          Number.isInteger(targetCellIndex) &&
          targetCellIndex >= 0 &&
          Number.isInteger(targetGridRows) &&
          targetGridRows > 0 &&
          Number.isInteger(targetGridCols) &&
          targetGridCols > 0
        ) {
          onReplaceImageGridCell?.(
            targetNodeId,
            targetImageUrl,
            drag.url,
            targetGridRows,
            targetGridCols,
            targetCellIndex
          );
        }
        return;
      }
      const targetNodeId = hotTarget.getAttribute("data-frame-node-id") || "";
      const targetFrameIndex = Number.parseInt(
        hotTarget.getAttribute("data-frame-index") || "-1",
        10
      );
      if (targetNodeId && Number.isInteger(targetFrameIndex) && targetFrameIndex >= 0) {
        onReplaceFrameImage?.(targetNodeId, targetFrameIndex, drag.url, drag.ossId);
      }
    },
    [
      cleanupImageFrameDropListeners,
      destroyImageFrameDropOverlay,
      onDropImageToVideoBatchReplacement,
      onReplaceFrameImage,
      onReplaceImageGridCell,
    ]
  );
  const beginImageFrameDropDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        (!onReplaceFrameImage && !onReplaceImageGridCell && !onDropImageToVideoBatchReplacement) ||
        isFrameStrip ||
        !imageUrl ||
        event.button !== 0
      ) {
        return;
      }
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
          ossId: getPrimaryImageNodeOssId(node, imageUrl),
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
      node,
      onDropImageToVideoBatchReplacement,
      onReplaceFrameImage,
      onReplaceImageGridCell,
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
  const rawAspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const rawResolution = (node.properties.resolution as string) || "1K";
  const currentCustomSize =
    typeof node.properties.customSize === "string" ? node.properties.customSize : "";
  const activeResolutionGroup =
    resolutionPresetGroups?.find((group) => group.resolution === rawResolution) ??
    resolutionPresetGroups?.[0];
  const resolution = activeResolutionGroup?.resolution ?? rawResolution;
  const aspectRatio = activeResolutionGroup?.presets.some(
    (preset) => preset.aspectRatio === rawAspectRatio
  )
    ? rawAspectRatio
    : (activeResolutionGroup?.presets[0]?.aspectRatio ?? rawAspectRatio);
  const quantity = (node.properties.quantity as string) || "1张";
  const imageModelOptionGroups = React.useMemo(
    () => getModelOptionGroups([], apiConfig?.remoteModelsByType?.[AI_MODEL_TYPES[1]] ?? []),
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
  const batchReplacementStartedAt =
    typeof node.data?.batchReplacementStartedAt === "number"
      ? node.data.batchReplacementStartedAt
      : undefined;
  const batchReplacementFinishedAt =
    typeof node.data?.batchReplacementFinishedAt === "number"
      ? node.data.batchReplacementFinishedAt
      : undefined;
  const [batchReplacementElapsedNow, setBatchReplacementElapsedNow] = React.useState(() =>
    Date.now()
  );
  const effectiveBatchReplacementFinishedAt =
    batchReplacementFinishedAt ??
    (isBatchReplacementResultNode && node.data?.status === "success"
      ? batchReplacementElapsedNow
      : undefined);
  React.useEffect(() => {
    if (
      !isBatchReplacementResultNode ||
      typeof batchReplacementStartedAt === "number" ||
      !onUpdateData
    ) {
      return;
    }
    const shouldBackfillRunningStart = node.data?.loading === true;
    const shouldBackfillCompletedStart =
      node.data?.status === "success" || typeof batchReplacementFinishedAt === "number";
    if (!shouldBackfillRunningStart && !shouldBackfillCompletedStart) return;
    const now = Date.now();
    onUpdateData(node.id, {
      batchReplacementStartedAt: now,
      batchReplacementFinishedAt: shouldBackfillRunningStart
        ? undefined
        : (batchReplacementFinishedAt ?? now),
    });
  }, [
    batchReplacementFinishedAt,
    batchReplacementStartedAt,
    isBatchReplacementResultNode,
    node.data?.loading,
    node.data?.status,
    node.id,
    onUpdateData,
  ]);
  React.useEffect(() => {
    if (!isBatchReplacementResultNode || node.data?.loading !== true) return;
    setBatchReplacementElapsedNow(Date.now());
    const timerId = window.setInterval(() => setBatchReplacementElapsedNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [isBatchReplacementResultNode, node.data?.loading]);
  const batchReplacementElapsedLabel = isBatchReplacementResultNode
    ? getBatchReplacementResultElapsedLabel({
        finishedAt: effectiveBatchReplacementFinishedAt,
        isRunning: node.data?.loading === true,
        now: batchReplacementElapsedNow,
        startedAt: batchReplacementStartedAt,
      })
    : "";
  React.useEffect(() => {
    if (!resolutionPresetGroups?.length) return;
    if (rawResolution !== resolution) onUpdateProperty?.(node.id, "resolution", resolution);
    if (rawAspectRatio !== aspectRatio) onUpdateProperty?.(node.id, "aspect_ratio", aspectRatio);
    const preset = getImageResolutionPreset(resolution, aspectRatio, resolutionPresetGroups);
    const nextCustomSize = preset ? `${preset.width}x${preset.height}` : "";
    if (nextCustomSize && currentCustomSize !== nextCustomSize) {
      onUpdateProperty?.(node.id, "customSize", nextCustomSize);
    }
  }, [
    aspectRatio,
    currentCustomSize,
    node.id,
    onUpdateProperty,
    rawAspectRatio,
    rawResolution,
    resolution,
    resolutionPresetGroups,
  ]);
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
        fixedTileSize: isFrameStrip,
        imageSizes: frameImageSizes,
        imageUrls: resolvedImageUrls,
        maxColumns: isBatchReplacementResultNode
          ? batchReplacementResultColumnCount
          : frameGridColumns,
      }),
    [
      batchReplacementResultColumnCount,
      frameGridColumns,
      frameImageSizes,
      frameTileHeight,
      frameTileWidth,
      isBatchReplacementResultNode,
      isFrameStrip,
      resolvedImageUrls,
    ]
  );
  const frameStripSize = {
    width: frameStripLayout.width,
    height: frameStripLayout.height,
  };
  const frameStripRows = React.useMemo(
    () =>
      Array.from(
        {
          length: Math.max(
            1,
            Math.ceil(
              Math.max(1, resolvedImageUrls.length) /
                (isBatchReplacementResultNode
                  ? batchReplacementResultColumnCount
                  : frameGridColumns)
            )
          ),
        },
        (_, rowIndex) =>
          resolvedImageUrls
            .slice(
              rowIndex *
                (isBatchReplacementResultNode
                  ? batchReplacementResultColumnCount
                  : frameGridColumns),
              (rowIndex + 1) *
                (isBatchReplacementResultNode
                  ? batchReplacementResultColumnCount
                  : frameGridColumns)
            )
            .map((url, offset) => {
              const index =
                rowIndex *
                  (isBatchReplacementResultNode
                    ? batchReplacementResultColumnCount
                    : frameGridColumns) +
                offset;
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
      batchReplacementResultColumnCount,
      frameGridColumns,
      frameStripLayout.tiles,
      frameTileHeight,
      frameTileWidth,
      isBatchReplacementResultNode,
      resolvedImageUrls,
    ]
  );
  const batchReplacementEmptySuccessFrameSize = {
    height:
      isEmptyBatchReplacementSuccess && typeof node.data?.imageNodeHeight === "number"
        ? node.data.imageNodeHeight
        : isEmptyBatchReplacementSuccess && typeof node.data?.imageDisplayHeight === "number"
          ? node.data.imageDisplayHeight
          : frameStripSize.height,
    width:
      isEmptyBatchReplacementSuccess && typeof node.data?.imageNodeWidth === "number"
        ? node.data.imageNodeWidth
        : isEmptyBatchReplacementSuccess && typeof node.data?.imageDisplayWidth === "number"
          ? node.data.imageDisplayWidth
          : frameStripSize.width,
  };
  const mediaFrameSize = isEmptyBatchReplacementSuccess
    ? batchReplacementEmptySuccessFrameSize
    : isFrameStrip
      ? frameStripSize
      : resultImageSize;
  const previewNodeWidth = isEmptyBatchReplacementSuccess
    ? batchReplacementEmptySuccessFrameSize.width
    : getImagePreviewNodeWidth({
        frameStripWidth: frameStripSize.width,
        isFrameStrip,
        resultImageWidth: resultImageSize.width,
      });
  const imageSetKey = React.useMemo(() => resolvedImageUrls.join("||"), [resolvedImageUrls]);
  const batchReplacementVisibleFrameCount = isEmptyBatchReplacementSuccess
    ? 0
    : resolvedImageUrls.length;
  const naturalSizeLabel = isFrameStrip
    ? `${batchReplacementVisibleFrameCount} \u5e27`
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
    if (!imageUrl || isBatchReplacementResultNode || !previewNodeRef.current) return;

    const syncNodeBounds = () => {
      const nextWidth = Math.round(
        mediaFrameRef.current?.offsetWidth ?? previewNodeRef.current?.offsetWidth ?? 0
      );
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
    isBatchReplacementResultNode,
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
    if (!isFrameStrip) return;
    if (
      node.data?.imageNaturalWidth === frameStripSize.width &&
      node.data?.imageNaturalHeight === frameStripSize.height &&
      node.data?.imageDisplayWidth === frameStripSize.width &&
      node.data?.imageDisplayHeight === frameStripSize.height
    ) {
      return;
    }

    onUpdateData?.(node.id, {
      imageNaturalWidth: frameStripSize.width,
      imageNaturalHeight: frameStripSize.height,
      imageDisplayWidth: frameStripSize.width,
      imageDisplayHeight: frameStripSize.height,
    });
  }, [
    frameStripSize.height,
    frameStripSize.width,
    isFrameStrip,
    node.data?.imageDisplayHeight,
    node.data?.imageDisplayWidth,
    node.data?.imageNaturalHeight,
    node.data?.imageNaturalWidth,
    node.id,
    onUpdateData,
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
      setAnnotationMode(false);
      setAnnotationDraft(null);
      setSelectedAnnotationId(null);
      setAnnotationUndoStack([]);
      setAnnotationRedoStack([]);
      setAnnotationColorMenuOpen(false);
      setAnnotationStrokeMenuOpen(false);
      setAnnotationColorMenuPosition(null);
      setAnnotationStrokeMenuPosition(null);
    }
  }, [selected]);

  React.useEffect(() => {
    if (!annotationMode) {
      setAnnotationColorMenuOpen(false);
      setAnnotationStrokeMenuOpen(false);
      setAnnotationColorMenuPosition(null);
      setAnnotationStrokeMenuPosition(null);
    }
  }, [annotationMode]);

  const getAnnotationStyleMenuPosition = React.useCallback(
    (anchor: HTMLElement | null, menuWidth: number) => {
      const rect = anchor?.getBoundingClientRect();
      if (!rect) return null;
      return getFloatingMenuPosition({
        anchorRect: {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.left + menuWidth,
          top: rect.top,
          width: menuWidth,
        },
        gap: 10,
        margin: 12,
        maxMenuHeight: 320,
        minMenuHeight: 120,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });
    },
    []
  );

  const updateAnnotationStyleMenuPositions = React.useCallback(() => {
    if (annotationColorMenuOpen) {
      setAnnotationColorMenuPosition(
        getAnnotationStyleMenuPosition(annotationColorButtonRef.current, IMAGE_ANNOTATION_COLOR_MENU_WIDTH)
      );
    }
    if (annotationStrokeMenuOpen) {
      setAnnotationStrokeMenuPosition(
        getAnnotationStyleMenuPosition(annotationStrokeButtonRef.current, IMAGE_ANNOTATION_STROKE_MENU_WIDTH)
      );
    }
  }, [
    annotationColorMenuOpen,
    annotationStrokeMenuOpen,
    getAnnotationStyleMenuPosition,
    setAnnotationColorMenuPosition,
    setAnnotationStrokeMenuPosition,
  ]);

  React.useEffect(() => {
    if (!annotationColorMenuOpen && !annotationStrokeMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && annotationStyleMenuRef.current?.contains(target)) return;
      setAnnotationColorMenuOpen(false);
      setAnnotationStrokeMenuOpen(false);
      setAnnotationColorMenuPosition(null);
      setAnnotationStrokeMenuPosition(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAnnotationColorMenuOpen(false);
      setAnnotationStrokeMenuOpen(false);
      setAnnotationColorMenuPosition(null);
      setAnnotationStrokeMenuPosition(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateAnnotationStyleMenuPositions);
    window.addEventListener("scroll", updateAnnotationStyleMenuPositions, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateAnnotationStyleMenuPositions);
      window.removeEventListener("scroll", updateAnnotationStyleMenuPositions, true);
    };
  }, [annotationColorMenuOpen, annotationStrokeMenuOpen, updateAnnotationStyleMenuPositions]);

  const handleRun = () => {
    if (isRunning) return;
    setOpenSelect(null);
    setModelMenuOpen(false);
    onRun?.(node.id);
  };

  const handleReviewAsset = () => {
    if (!reviewOssId || isReviewingAsset) return;
    onReviewAsset?.(node.id, reviewOssId);
  };

  const persistImageAnnotations = React.useCallback(
    (nextAnnotations: ImageAnnotation[], history = true) => {
      if (history) {
        setAnnotationUndoStack((stack) => [...stack.slice(-24), imageAnnotations]);
        setAnnotationRedoStack([]);
      }
      onUpdateData?.(node.id, { annotations: nextAnnotations });
    },
    [imageAnnotations, node.id, onUpdateData]
  );

  const makeAnnotationId = React.useCallback(
    () => `annotation-${node.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    [node.id]
  );

  const commitAnnotationDraft = React.useCallback(
    (draft: typeof annotationDraft) => {
      if (!draft) return;
      const nextAnnotation =
        draft.type === "rect"
          ? createRectAnnotation({
              color: annotationColor,
              end: draft.current,
              id: makeAnnotationId(),
              start: draft.start,
              strokeWidth: annotationStrokeWidth,
            })
          : draft.type === "arrow"
            ? createArrowAnnotation({
                color: annotationColor,
                end: draft.current,
                id: makeAnnotationId(),
                start: draft.start,
                strokeWidth: annotationStrokeWidth,
              })
            : createPenAnnotation({
                color: annotationColor,
                id: makeAnnotationId(),
                points: draft.points,
                strokeWidth: annotationStrokeWidth,
              });
      if (!nextAnnotation) return;
      const nextAnnotations = [...imageAnnotations, nextAnnotation];
      persistImageAnnotations(nextAnnotations);
      setSelectedAnnotationId(nextAnnotation.id);
    },
    [
      annotationColor,
      annotationStrokeWidth,
      imageAnnotations,
      makeAnnotationId,
      persistImageAnnotations,
      setSelectedAnnotationId,
    ]
  );

  const getAnnotationPointFromEvent = React.useCallback((event: React.PointerEvent) => {
    const rect = mediaFrameRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return getNormalizedAnnotationPoint(
      { clientX: event.clientX, clientY: event.clientY },
      rect
    );
  }, []);

  const handleAnnotationPointerDown = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!annotationMode || event.button !== 0) return;
      const point = getAnnotationPointFromEvent(event);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      if (annotationTool === "select") {
        const hitId = hitTestImageAnnotation(imageAnnotations, point);
        setSelectedAnnotationId(hitId);
        annotationMoveRef.current = hitId
          ? { id: hitId, moved: false, originalAnnotations: imageAnnotations, start: point }
          : null;
        return;
      }
      if (annotationTool === "text") {
        const text =
          typeof window === "undefined"
            ? ""
            : window.prompt("输入文字批注", "需要修改")?.trim() ?? "";
        const nextAnnotation = createTextAnnotation({
          color: annotationColor,
          fontSize: 18,
          id: makeAnnotationId(),
          point,
          text,
        });
        if (nextAnnotation) {
          persistImageAnnotations([...imageAnnotations, nextAnnotation]);
          setSelectedAnnotationId(nextAnnotation.id);
        }
        return;
      }
      setSelectedAnnotationId(null);
      setAnnotationDraft(
        annotationTool === "rect"
          ? { type: "rect", start: point, current: point }
          : annotationTool === "arrow"
            ? { type: "arrow", start: point, current: point }
            : { type: "pen", points: [point] }
      );
    },
    [
      annotationColor,
      annotationMode,
      annotationTool,
      getAnnotationPointFromEvent,
      imageAnnotations,
      makeAnnotationId,
      persistImageAnnotations,
      setAnnotationDraft,
      setSelectedAnnotationId,
    ]
  );

  const handleArrowEndpointPointerDown = React.useCallback(
    (
      annotationId: string,
      resizeEndpoint: ImageArrowEndpoint,
      event: React.PointerEvent<SVGCircleElement>
    ) => {
      if (!annotationMode || event.button !== 0) return;
      const point = getAnnotationPointFromEvent(event);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      setAnnotationTool("select");
      setSelectedAnnotationId(annotationId);
      annotationMoveRef.current = {
        id: annotationId,
        moved: false,
        originalAnnotations: imageAnnotations,
        resizeEndpoint,
        start: point,
      };
    },
    [
      annotationMode,
      getAnnotationPointFromEvent,
      imageAnnotations,
      setAnnotationTool,
      setSelectedAnnotationId,
    ]
  );

  const handleAnnotationPointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!annotationMode) return;
      const point = getAnnotationPointFromEvent(event);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      if (annotationTool === "select" && annotationMoveRef.current) {
        const moving = annotationMoveRef.current;
        const delta = { x: point.x - moving.start.x, y: point.y - moving.start.y };
        moving.moved = Math.abs(delta.x) > 0.0005 || Math.abs(delta.y) > 0.0005;
        const nextAnnotations = moving.originalAnnotations.map((annotation) => {
          if (annotation.id !== moving.id) return annotation;
          if (moving.resizeEndpoint) {
            return resizeImageArrowAnnotation(annotation, moving.resizeEndpoint, point);
          }
          return moveImageAnnotation(annotation, delta);
        });
        onUpdateData?.(node.id, { annotations: nextAnnotations });
        return;
      }
      if (!annotationDraft) return;
      setAnnotationDraft((current) => {
        if (!current) return current;
        if (current.type === "rect" || current.type === "arrow") return { ...current, current: point };
        return { ...current, points: [...current.points, point] };
      });
    },
    [
      annotationDraft,
      annotationMode,
      annotationTool,
      getAnnotationPointFromEvent,
      node.id,
      onUpdateData,
      setAnnotationDraft,
    ]
  );

  const handleAnnotationPointerUp = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!annotationMode) return;
      event.preventDefault();
      event.stopPropagation();
      if (annotationTool === "select" && annotationMoveRef.current) {
        const moving = annotationMoveRef.current;
        if (moving.moved) {
          setAnnotationUndoStack((stack) => [...stack.slice(-24), moving.originalAnnotations]);
          setAnnotationRedoStack([]);
        }
        annotationMoveRef.current = null;
      } else if (annotationDraft) {
        commitAnnotationDraft(annotationDraft);
        setAnnotationDraft(null);
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [annotationDraft, annotationMode, annotationTool, commitAnnotationDraft, setAnnotationDraft]
  );

  const handleUndoAnnotation = React.useCallback(() => {
    const previous = annotationUndoStack.at(-1);
    if (!previous) return;
    setAnnotationUndoStack((stack) => stack.slice(0, -1));
    setAnnotationRedoStack((stack) => [...stack, imageAnnotations]);
    persistImageAnnotations(previous, false);
    setSelectedAnnotationId(null);
  }, [annotationUndoStack, imageAnnotations, persistImageAnnotations, setSelectedAnnotationId]);

  const handleRedoAnnotation = React.useCallback(() => {
    const next = annotationRedoStack.at(-1);
    if (!next) return;
    setAnnotationRedoStack((stack) => stack.slice(0, -1));
    setAnnotationUndoStack((stack) => [...stack, imageAnnotations]);
    persistImageAnnotations(next, false);
    setSelectedAnnotationId(null);
  }, [annotationRedoStack, imageAnnotations, persistImageAnnotations, setSelectedAnnotationId]);

  const handleDeleteSelectedAnnotation = React.useCallback(() => {
    if (!selectedAnnotationId) return;
    persistImageAnnotations(imageAnnotations.filter((annotation) => annotation.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  }, [imageAnnotations, persistImageAnnotations, selectedAnnotationId, setSelectedAnnotationId]);

  const updateSelectedAnnotation = React.useCallback(
    (updater: (annotation: ImageAnnotation) => ImageAnnotation) => {
      if (!selectedAnnotationId) return false;
      persistImageAnnotations(
        imageAnnotations.map((annotation) =>
          annotation.id === selectedAnnotationId ? updater(annotation) : annotation
        )
      );
      return true;
    },
    [imageAnnotations, persistImageAnnotations, selectedAnnotationId]
  );

  const handleSelectAnnotationColor = React.useCallback(
    (color: (typeof IMAGE_ANNOTATION_COLORS)[number]) => {
      setAnnotationColor(color);
      updateSelectedAnnotation((annotation) => ({ ...annotation, color }));
      setAnnotationColorMenuOpen(false);
      setAnnotationColorMenuPosition(null);
    },
    [
      setAnnotationColor,
      setAnnotationColorMenuOpen,
      setAnnotationColorMenuPosition,
      updateSelectedAnnotation,
    ]
  );

  const handleSelectAnnotationStrokeWidth = React.useCallback(
    (width: (typeof IMAGE_ANNOTATION_STROKE_WIDTHS)[number]) => {
      setAnnotationStrokeWidth(width);
      updateSelectedAnnotation((annotation) =>
        annotation.type === "text" ? annotation : { ...annotation, strokeWidth: width }
      );
      setAnnotationStrokeMenuOpen(false);
      setAnnotationStrokeMenuPosition(null);
    },
    [
      setAnnotationStrokeMenuOpen,
      setAnnotationStrokeMenuPosition,
      setAnnotationStrokeWidth,
      updateSelectedAnnotation,
    ]
  );

  const handleClearAnnotations = React.useCallback(() => {
    if (imageAnnotations.length === 0) return;
    persistImageAnnotations([]);
    setAnnotationDraft(null);
    setSelectedAnnotationId(null);
  }, [imageAnnotations.length, persistImageAnnotations, setAnnotationDraft, setSelectedAnnotationId]);

  React.useEffect(() => {
    if (!annotationMode || !selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if (event.key === "Escape") {
        if (annotationColorMenuOpen || annotationStrokeMenuOpen) {
          event.preventDefault();
          setAnnotationColorMenuOpen(false);
          setAnnotationStrokeMenuOpen(false);
          setAnnotationColorMenuPosition(null);
          setAnnotationStrokeMenuPosition(null);
          return;
        }
        setAnnotationMode(false);
        setAnnotationDraft(null);
        setSelectedAnnotationId(null);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handleRedoAnnotation();
        else handleUndoAnnotation();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedoAnnotation();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        handleDeleteSelectedAnnotation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    annotationMode,
    annotationColorMenuOpen,
    annotationStrokeMenuOpen,
    handleDeleteSelectedAnnotation,
    handleRedoAnnotation,
    handleUndoAnnotation,
    selected,
    setAnnotationDraft,
  ]);

  const handlePromptChange = (value: string) => {
    onUpdateProperty?.(node.id, "text", value);
  };

  const downloadImage = async () => {
    if (!imageUrl) return;
    const filename = `${nodeBadgeTitle.replace(/\s+/g, "-") || "image-node"}-${Date.now()}.${extensionFromAssetUrl(imageUrl, "png")}`;
    await downloadMediaAsset(imageUrl, filename);
  };

  const downloadFrameImage = async (url: string, frameIndex: number) => {
    const filename = getFrameStripDownloadFilename({
      frameIndex,
      nodeTitle: nodeBadgeTitle,
      timestamp: Date.now(),
      url,
    });
    await downloadMediaAsset(url, filename);
  };

  const downloadVisibility = getImageNodeDownloadVisibility({ isFrameStrip });

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
      node.data?.imagePromptStarter,
      node.id,
      onNotice,
      onSetPrimaryImageResult,
      onSyncImagePromptStarterLayout,
      onUpdateData,
      onUpdateProperty,
      resultImageSize.height,
      resultImageSize.width,
      setActiveImageIndex,
      setIsUploadingAsset,
      setNaturalImageSize,
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
    [
      activeImageIndex,
      node.id,
      onSetPrimaryImageResult,
      resolvedImageUrls,
      setActiveImageIndex,
      setNaturalImageSize,
    ]
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
        className={mediaNodeToolbarUploadButtonClass}
      >
        {isUploadingNodeAsset ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <Upload className="h-[18px] w-[18px]" />
        )}
      </button>
    </>
  );

  const annotationDraftItem = annotationDraft
    ? annotationDraft.type === "rect"
      ? createRectAnnotation({
          color: annotationColor,
          end: annotationDraft.current,
          id: "__draft_annotation__",
          start: annotationDraft.start,
          strokeWidth: annotationStrokeWidth,
        })
      : annotationDraft.type === "arrow"
        ? createArrowAnnotation({
            color: annotationColor,
            end: annotationDraft.current,
            id: "__draft_annotation__",
            start: annotationDraft.start,
            strokeWidth: annotationStrokeWidth,
          })
        : createPenAnnotation({
            color: annotationColor,
            id: "__draft_annotation__",
            points: annotationDraft.points,
            strokeWidth: annotationStrokeWidth,
          })
    : null;
  const visibleAnnotations = annotationDraftItem
    ? [...imageAnnotations, annotationDraftItem]
    : imageAnnotations;
  const annotationStrokeScale = Math.max(mediaFrameSize.width, mediaFrameSize.height, 1);
  const canAnnotateImage = Boolean(imageUrl) && !isFrameStrip && !isStarterPlaceholder;

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
    hasImageUrl: Boolean(imageUrl || isEmptyBatchReplacementSuccess),
    imagePortCenterY: node.data?.imagePortCenterY,
  });
  const portHandles = (
    <AnimatePresence>
      {!isRunning &&
        !isUploadingNodeAsset &&
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
                <InlineNodePortHandle
                  role="input"
                  nodeId={node.id}
                  portIndex={0}
                  active={Boolean(
                    isLinkingOnCanvas && linkToNodeId === node.id && linkToInputIndex === 0
                  )}
                  onHoverCanvasLinkTarget={onHoverCanvasLinkTarget}
                  onLeaveCanvasLinkTarget={onLeaveCanvasLinkTarget}
                  onFinishCanvasLink={onFinishCanvasLink}
                  inputIssue={getCanvasLinkTargetIssue?.(node.id, 0)}
                />
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute -right-11 z-10"
              style={getImagePortHandleWrapperStyle(portTopStyle)}
            >
              <InlineNodePortHandle
                role="output"
                nodeId={node.id}
                portIndex={0}
                active={Boolean(
                  isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === 0
                )}
                onBeginCanvasLink={onBeginCanvasLink}
              />
            </motion.div>
          </>
        )}
    </AnimatePresence>
  );

  const showImagePromptComposer = shouldShowImagePromptComposer({
    isFrameStrip,
    isRunning,
    isSelected: selected,
    isSourceAssetNode,
    isUploadingNodeAsset,
  });

  React.useEffect(() => {
    if (!showImagePromptComposer) setExpandedPromptEditorOpen(false);
  }, [showImagePromptComposer]);

  React.useEffect(() => {
    if (!expandedPromptEditorOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedPromptEditorOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [expandedPromptEditorOpen]);

  const expandPromptEditorButton = (
    <button
      type="button"
      aria-label="放大编辑"
      title="放大编辑"
      onClick={(event) => {
        event.stopPropagation();
        setExpandedPromptEditorOpen(true);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-slate-950/22 text-slate-200/78 transition hover:bg-violet-200/10 hover:text-white"
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </button>
  );

  const expandedPromptEditorNode =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {expandedPromptEditorOpen && showImagePromptComposer && (
              <motion.div
                data-node-action="true"
                className="fixed inset-0 z-[220] flex items-center justify-center bg-[#101626]/56 px-8 py-8 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
              >
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="relative flex h-[min(760px,calc(100vh-80px))] w-[min(1120px,calc(100vw-80px))] flex-col overflow-hidden rounded-[22px] border border-violet-200/16 bg-[#182131]/96 shadow-[0_34px_120px_-42px_rgba(0,0,0,0.94),0_0_0_1px_rgba(196,181,253,0.08),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-100/26 to-transparent" />
                  <div className="flex h-16 shrink-0 items-center justify-between border-b border-violet-100/10 px-5">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-slate-50">
                        {nodeBadgeTitle}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-slate-300/58">
                        内容会实时同步到节点输入面板
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="关闭全屏编辑"
                      title="关闭全屏编辑"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedPromptEditorOpen(false);
                      }}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.045] text-slate-200/72 transition hover:border-violet-200/28 hover:bg-violet-200/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {inputReferences.length > 0 && (
                    <div className="mx-5 mt-4 shrink-0 rounded-2xl border border-white/8 bg-[#20293a]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="flex max-h-[126px] flex-wrap items-center gap-2 overflow-y-auto pr-1 custom-scrollbar">
                        {inputReferences.map((reference, index) => (
                          <React.Fragment key={`${reference.key}-${reference.value}-${index}`}>
                            <ReferencePreviewCard
                              reference={reference}
                              index={index}
                              onRemove={removeInputReference}
                            />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
                    <PromptTokenEditor
                      value={promptText}
                      resources={inputReferences}
                      onChange={handlePromptChange}
                      onEscape={() => setExpandedPromptEditorOpen(false)}
                      placeholder={
                        upstreamPrompt
                          ? "继续补充这些输入资源要如何参与生成"
                          : hasNonTextInputReferences
                            ? "描述你想基于这些输入生成的画面内容"
                            : "描述你想要生成的画面内容"
                      }
                      className="h-full min-h-0 overflow-y-auto pr-3 text-[16px] leading-8 custom-scrollbar"
                    />
                  </div>

                  <div className="flex h-[76px] shrink-0 flex-nowrap items-center gap-3 border-t border-violet-100/10 px-5">
                    <div className="relative min-w-0 flex-[1_1_210px]" ref={modelMenuRef}>
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
                        className={`flex h-11 w-full min-w-0 items-center gap-2 rounded-[15px] border px-3 text-[14px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors ${
                          modelMenuOpen
                            ? "border-violet-300/28 bg-violet-500/[0.13] text-violet-50"
                            : "border-slate-400/16 bg-[#111827]/52 text-slate-200/82 hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                        }`}
                      >
                        <Wand2 className="h-4 w-4 shrink-0 text-violet-200/58" />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {getImageModelLabel(currentModel)}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-300/56 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                    <ImageResolutionPicker
                      resolution={resolution}
                      aspectRatio={aspectRatio}
                      panelLayerClassName="z-[240]"
                      panelTitle="Image Size"
                      presetGroups={resolutionPresetGroups}
                      onChange={(nextResolution, nextAspectRatio) => {
                        onUpdateProperty?.(node.id, "resolution", nextResolution);
                        onUpdateProperty?.(node.id, "aspect_ratio", nextAspectRatio);
                        const preset = getImageResolutionPreset(
                          nextResolution,
                          nextAspectRatio,
                          resolutionPresetGroups
                        );
                        if (preset) {
                          onUpdateProperty?.(
                            node.id,
                            "customSize",
                            `${preset.width}x${preset.height}`
                          );
                        }
                        const nextNodeSizeData = resolveImageNodeSizePresetData({
                          aspectRatio: nextAspectRatio,
                          hasImageUrl: Boolean(imageUrl),
                          isExtractedFrameNode,
                          isFrameStrip,
                          isUploadPlaceholder: node.data?.isUploadPlaceholder === true,
                          resolution: nextResolution,
                        });
                        if (nextNodeSizeData) onUpdateData?.(node.id, nextNodeSizeData);
                      }}
                      buttonClassName="relative inline-flex h-11 w-[300px] shrink-0 items-center justify-center gap-2 rounded-[15px] border border-slate-400/16 bg-slate-950/18 px-3 text-[14px] font-medium text-slate-200/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                    />
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModelMenuOpen(false);
                          setOpenSelect((current) => (current === "quantity" ? null : "quantity"));
                        }}
                        className={`relative inline-flex h-11 min-w-[86px] items-center justify-center gap-1.5 rounded-[15px] border px-3 text-[14px] font-medium transition-colors ${
                          openSelect === "quantity"
                            ? "border-violet-300/28 bg-violet-500/[0.13] text-violet-50"
                            : "border-slate-400/16 bg-[#111827]/42 text-slate-300/72 hover:border-violet-200/22 hover:bg-violet-500/[0.08] hover:text-violet-50"
                        }`}
                      >
                        <span>{quantity.replace("张", "")}</span>
                        <span className="text-[12px] text-slate-400/68">张</span>
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
                            className="absolute bottom-[calc(100%+12px)] left-0 z-50 w-[112px] rounded-[16px] border border-slate-400/16 bg-[#0d121c]/96 p-2 shadow-[0_22px_56px_-22px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {QUANTITY_OPTIONS.map((option) => {
                              const isActive = option === quantity;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onUpdateProperty?.(node.id, "quantity", option);
                                    onUpdateProperty?.(node.id, "n", Number.parseInt(option, 10));
                                    setOpenSelect(null);
                                  }}
                                  className={`flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left transition-colors ${
                                    isActive
                                      ? "bg-violet-500/[0.16] text-violet-50"
                                      : "text-slate-300/76 hover:bg-white/[0.055] hover:text-slate-100"
                                  }`}
                                >
                                  <span className="text-[13px] font-semibold">{option}</span>
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.72)]" : "bg-slate-500/35"}`}
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
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRun();
                      }}
                      disabled={isRunning || !canRunImagePrompt}
                      className={`ml-auto flex h-11 w-14 shrink-0 items-center justify-center rounded-[16px] transition-all ${
                        isRunning || !canRunImagePrompt
                          ? "cursor-not-allowed border border-cyan-100/6 bg-slate-200/8 text-slate-200/28"
                          : "bg-slate-100 text-[#111827] shadow-[0_14px_34px_-18px_rgba(226,232,240,0.78)] hover:bg-white"
                      }`}
                    >
                      {isRunning ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowUp className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {typeof document !== "undefined" &&
                    expandedPromptEditorOpen &&
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
                            className="fixed z-[240] overflow-y-auto rounded-2xl border border-slate-400/16 bg-[#121923]/96 p-1.5 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar"
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
                                            ? "bg-violet-500/[0.16] text-violet-50"
                                            : "text-slate-200/82 hover:bg-white/[0.05] hover:text-white"
                                        }`}
                                      >
                                        <span className="min-w-0 flex-1 truncate">
                                          {getImageModelLabel(model)}
                                        </span>
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  const imagePreviewContent =
    (imageUrl || isEmptyBatchReplacementSuccess) &&
    (!isRunning || isBatchReplacementResultNode) &&
    !isUploadingNodeAsset ? (
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
          {selected && (
            <motion.div
              data-node-action="true"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className={mediaNodeFloatingToolbarRaisedClass}
              style={
                {
                  "--media-node-toolbar-gap": `${floatingToolbarGap}px`,
                  scale: floatingCanvasUiScale,
                  transformOrigin: "bottom center",
                } as React.CSSProperties
              }
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {activeGridSelection ? (
                <>
                  <Tooltip content="退出宫格切分" position="top">
                    <button
                      type="button"
                      onClick={handleExitGridSplitMode}
                      className={mediaNodeToolbarButtonClass}
                    >
                      <Undo2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <div className={mediaNodeToolbarDividerClass} />
                  <div className="flex h-8 min-w-[188px] shrink-0 items-center gap-2 rounded-[10px] px-1 text-[12px] font-medium text-slate-200/82">
                    <Grid3X3 className="h-[18px] w-[18px] text-violet-300/88" />
                    <span className="block whitespace-nowrap leading-none">
                      {selectedGridCells.length > 0
                        ? `已选 ${selectedGridCells.length} 个宫格`
                        : "请选择宫格"}
                    </span>
                  </div>
                </>
              ) : annotationMode && canAnnotateImage ? (
                <div data-image-annotation-toolbar="true" className="contents">
                  {imageAnnotations.length > 0 && (
                    <span className="flex h-8 shrink-0 whitespace-nowrap items-center rounded-[10px] border border-rose-300/16 bg-rose-400/[0.08] px-2 text-[11px] font-semibold leading-none text-rose-100/86">
                      已标记 {imageAnnotations.length}
                    </span>
                  )}
                  <div className={mediaNodeToolbarDividerClass} />
                  <Tooltip content="选择标记" position="top">
                    <button
                      type="button"
                      aria-label="选择标记"
                      onClick={() => setAnnotationTool("select")}
                      className={`${mediaNodeToolbarButtonClass} ${
                        annotationTool === "select" ? "bg-violet-400/12 text-violet-50" : ""
                      }`}
                    >
                      <MousePointer2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="矩形标记" position="top">
                    <button
                      type="button"
                      aria-label="矩形标记"
                      onClick={() => setAnnotationTool("rect")}
                      className={`${mediaNodeToolbarButtonClass} ${
                        annotationTool === "rect" ? "bg-violet-400/12 text-violet-50" : ""
                      }`}
                    >
                      <Square className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="画笔标记" position="top">
                    <button
                      type="button"
                      aria-label="画笔标记"
                      onClick={() => setAnnotationTool("pen")}
                      className={`${mediaNodeToolbarButtonClass} ${
                        annotationTool === "pen" ? "bg-violet-400/12 text-violet-50" : ""
                      }`}
                    >
                      <PenLine className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="箭头标记" position="top">
                    <button
                      type="button"
                      aria-label="箭头标记"
                      onClick={() => setAnnotationTool("arrow")}
                      className={`${mediaNodeToolbarButtonClass} ${
                        annotationTool === "arrow" ? "bg-violet-400/12 text-violet-50" : ""
                      }`}
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="文字标记" position="top">
                    <button
                      type="button"
                      aria-label="文字标记"
                      onClick={() => setAnnotationTool("text")}
                      className={`${mediaNodeToolbarButtonClass} ${
                        annotationTool === "text" ? "bg-violet-400/12 text-violet-50" : ""
                      }`}
                    >
                      <Type className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <div ref={annotationStyleMenuRef} className="flex h-8 items-center gap-1">
                    <div className="relative">
                      <Tooltip content="标记颜色" position="top">
                        <button
                          ref={annotationColorButtonRef}
                          type="button"
                          aria-label="打开标记颜色选择"
                          onClick={() => {
                            const nextOpen = !annotationColorMenuOpen;
                            setAnnotationColorMenuOpen(nextOpen);
                            setAnnotationStrokeMenuOpen(false);
                            setAnnotationStrokeMenuPosition(null);
                            setAnnotationColorMenuPosition(
                              nextOpen
                                ? getAnnotationStyleMenuPosition(
                                    annotationColorButtonRef.current,
                                    IMAGE_ANNOTATION_COLOR_MENU_WIDTH
                                  )
                                : null
                            );
                          }}
                          className={`flex h-8 min-w-[52px] items-center justify-center gap-1.5 rounded-[10px] border px-2 transition-colors ${
                            annotationColorMenuOpen
                              ? "border-violet-300/34 bg-violet-500/[0.14] text-violet-50"
                              : "border-slate-400/12 bg-slate-950/10 text-slate-300/76 hover:bg-white/[0.055] hover:text-slate-50"
                          }`}
                        >
                          <span
                            className="h-5 w-5 rounded-full border border-white/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_0_1px_rgba(15,23,42,0.45)]"
                            style={{ backgroundColor: annotationColor }}
                          />
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-300/62 transition-transform ${
                              annotationColorMenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </Tooltip>
                      {typeof document !== "undefined" &&
                        createPortal(
                          <AnimatePresence>
                            {annotationColorMenuOpen && annotationColorMenuPosition && (
                              <motion.div
                                data-image-annotation-color-menu="true"
                                initial={{
                                  opacity: 0,
                                  y: getAnnotationStyleMenuMotionOffset(annotationColorMenuPosition),
                                  scale: 0.98,
                                }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{
                                  opacity: 0,
                                  y: getAnnotationStyleMenuMotionOffset(annotationColorMenuPosition),
                                  scale: 0.98,
                                }}
                                transition={{ duration: 0.14, ease: "easeOut" }}
                                className="fixed z-[220] flex flex-col gap-1 overflow-y-auto rounded-[14px] border border-slate-300/14 bg-[#0c1220]/96 p-1.5 shadow-[0_22px_58px_-24px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl custom-scrollbar"
                                style={{
                                  bottom: annotationColorMenuPosition.bottom,
                                  left: annotationColorMenuPosition.left,
                                  maxHeight: annotationColorMenuPosition.maxHeight,
                                  top: annotationColorMenuPosition.top,
                                  transformOrigin:
                                    annotationColorMenuPosition.placement === "bottom"
                                      ? "top left"
                                      : "bottom left",
                                  width: annotationColorMenuPosition.width,
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                onWheel={(event) => event.stopPropagation()}
                              >
                            {IMAGE_ANNOTATION_COLORS.map((color) => {
                              const active = annotationColor === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  aria-label={`${color} 标记颜色`}
                                  onClick={() => handleSelectAnnotationColor(color)}
                                  className={`flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-semibold transition-colors ${
                                    active
                                      ? "bg-white/[0.1] text-white"
                                      : "text-slate-300/78 hover:bg-white/[0.06] hover:text-slate-50"
                                  }`}
                                >
                                  <span
                                    className={`h-5 w-5 rounded-full border ${
                                      active ? "border-white" : "border-white/24"
                                    }`}
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="min-w-0 flex-1 uppercase">{color}</span>
                                  {active && <Check className="h-3.5 w-3.5 text-violet-100" />}
                                </button>
                              );
                            })}
                              </motion.div>
                            )}
                          </AnimatePresence>,
                          document.body
                        )}
                    </div>
                    <div className="relative">
                      <Tooltip content="标记粗细" position="top">
                        <button
                          ref={annotationStrokeButtonRef}
                          type="button"
                          aria-label="打开标记粗细选择"
                          onClick={() => {
                            const nextOpen = !annotationStrokeMenuOpen;
                            setAnnotationStrokeMenuOpen(nextOpen);
                            setAnnotationColorMenuOpen(false);
                            setAnnotationColorMenuPosition(null);
                            setAnnotationStrokeMenuPosition(
                              nextOpen
                                ? getAnnotationStyleMenuPosition(
                                    annotationStrokeButtonRef.current,
                                    IMAGE_ANNOTATION_STROKE_MENU_WIDTH
                                  )
                                : null
                            );
                          }}
                          className={`flex h-8 min-w-[62px] items-center justify-center gap-1.5 rounded-[10px] border px-2 transition-colors ${
                            annotationStrokeMenuOpen
                              ? "border-violet-300/34 bg-violet-500/[0.14] text-violet-50"
                              : "border-slate-400/12 bg-slate-950/10 text-slate-300/76 hover:bg-white/[0.055] hover:text-slate-50"
                          }`}
                        >
                          <span className="flex h-5 w-6 items-center justify-center">
                            <span
                              className="w-5 rounded-full bg-current"
                              style={{ height: Math.max(2, Math.min(8, annotationStrokeWidth)) }}
                            />
                          </span>
                          <span className="text-[12px] font-semibold tabular-nums">{annotationStrokeWidth}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-slate-300/62 transition-transform ${
                              annotationStrokeMenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </Tooltip>
                      {typeof document !== "undefined" &&
                        createPortal(
                          <AnimatePresence>
                            {annotationStrokeMenuOpen && annotationStrokeMenuPosition && (
                              <motion.div
                                data-image-annotation-stroke-menu="true"
                                initial={{
                                  opacity: 0,
                                  y: getAnnotationStyleMenuMotionOffset(annotationStrokeMenuPosition),
                                  scale: 0.98,
                                }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{
                                  opacity: 0,
                                  y: getAnnotationStyleMenuMotionOffset(annotationStrokeMenuPosition),
                                  scale: 0.98,
                                }}
                                transition={{ duration: 0.14, ease: "easeOut" }}
                                className="fixed z-[220] flex flex-col gap-1 overflow-y-auto rounded-[14px] border border-slate-300/14 bg-[#0c1220]/96 p-1.5 shadow-[0_22px_58px_-24px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl custom-scrollbar"
                                style={{
                                  bottom: annotationStrokeMenuPosition.bottom,
                                  left: annotationStrokeMenuPosition.left,
                                  maxHeight: annotationStrokeMenuPosition.maxHeight,
                                  top: annotationStrokeMenuPosition.top,
                                  transformOrigin:
                                    annotationStrokeMenuPosition.placement === "bottom"
                                      ? "top left"
                                      : "bottom left",
                                  width: annotationStrokeMenuPosition.width,
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                onWheel={(event) => event.stopPropagation()}
                              >
                            {IMAGE_ANNOTATION_STROKE_WIDTHS.map((width) => {
                              const active = annotationStrokeWidth === width;
                              return (
                                <button
                                  key={width}
                                  type="button"
                                  aria-label={`${width}px 标记粗细`}
                                  onClick={() => handleSelectAnnotationStrokeWidth(width)}
                                  className={`flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-[12px] font-semibold transition-colors ${
                                    active
                                      ? "bg-white/[0.1] text-white"
                                      : "text-slate-300/78 hover:bg-white/[0.06] hover:text-slate-50"
                                  }`}
                                >
                                  <span className="flex h-5 w-8 items-center">
                                    <span
                                      className="w-full rounded-full bg-current"
                                      style={{ height: Math.max(1, Math.min(10, width)) }}
                                    />
                                  </span>
                                  <span className="flex-1 text-left tabular-nums">{width}px</span>
                                  {active && <Check className="h-3.5 w-3.5 text-violet-100" />}
                                </button>
                              );
                            })}
                              </motion.div>
                            )}
                          </AnimatePresence>,
                          document.body
                        )}
                    </div>
                  </div>
                  <Tooltip content="撤销标记" position="top">
                    <button
                      type="button"
                      aria-label="撤销标记"
                      onClick={handleUndoAnnotation}
                      disabled={annotationUndoStack.length === 0}
                      className={mediaNodeToolbarButtonClass}
                    >
                      <Undo2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="重做标记" position="top">
                    <button
                      type="button"
                      aria-label="重做标记"
                      onClick={handleRedoAnnotation}
                      disabled={annotationRedoStack.length === 0}
                      className={mediaNodeToolbarButtonClass}
                    >
                      <Redo2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="删除选中标记" position="top">
                    <button
                      type="button"
                      aria-label="删除选中标记"
                      onClick={handleDeleteSelectedAnnotation}
                      disabled={!selectedAnnotationId}
                      className={mediaNodeToolbarButtonClass}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="清空标记" position="top">
                    <button
                      type="button"
                      onClick={handleClearAnnotations}
                      disabled={imageAnnotations.length === 0}
                      className={mediaNodeToolbarButtonClass}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </Tooltip>
                  <Tooltip content="退出标记" position="top">
                    <button
                      type="button"
                      aria-label="退出标记"
                      onClick={() => {
                        setAnnotationMode(false);
                        setAnnotationDraft(null);
                      }}
                      className={mediaNodeToolbarButtonClass}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </Tooltip>
                </div>
              ) : (
                <div data-image-default-toolbar="true" className="contents">
                  {shouldShowUploadButton && !isExtractedFrameNode && (
                    <>
                      {uploadControl}
                      <div className={mediaNodeToolbarDividerClass} />
                    </>
                  )}
                  {downloadVisibility.showTopToolbarDownload && (
                    <Tooltip content="下载图片" position="top">
                      <button
                        type="button"
                        onClick={downloadImage}
                        className={mediaNodeToolbarButtonClass}
                      >
                        <Download className="h-5 w-5" />
                      </button>
                    </Tooltip>
                  )}
                  {reviewOssId && (
                    <Tooltip content={isReviewingAsset ? "送审中" : "送审"} position="top">
                      <button
                        type="button"
                        onClick={handleReviewAsset}
                        disabled={isReviewingAsset}
                        aria-label={isReviewingAsset ? "送审中" : "送审"}
                        className={mediaNodeToolbarButtonClass}
                      >
                        {isReviewingAsset ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                        <span className="sr-only">{isReviewingAsset ? "送审中" : "送审"}</span>
                      </button>
                    </Tooltip>
                  )}
                  {canAnnotateImage && (
                    <>
                      <Tooltip content={imageAnnotations.length > 0 ? `已标记${imageAnnotations.length}` : "标记"} position="top">
                        <button
                          type="button"
                          onClick={() => {
                            if (!annotationMode) setAnnotationTool("pen");
                            setAnnotationMode((value) => !value);
                            setAnnotationDraft(null);
                            setActiveGridSelection(null);
                          }}
                          className={`${mediaNodeToolbarButtonClass} ${
                            annotationMode ? "bg-rose-400/12 text-rose-50" : ""
                          }`}
                        >
                          <PenLine className="h-5 w-5" />
                        </button>
                      </Tooltip>
                    </>
                  )}
                  {isFrameStrip && (
                    <>
                      <div className={mediaNodeToolbarDividerClass} />
                      <Tooltip content="批量替换" position="top">
                        <button
                          type="button"
                          onClick={() => onCreateBatchReplacement?.(node)}
                          className={mediaNodeToolbarButtonClass}
                        >
                          <Replace className="h-5 w-5" />
                        </button>
                      </Tooltip>
                    </>
                  )}
                  <div className="relative" ref={gridMenuRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGridMenuOpen((value) => !value);
                        setCustomGridOpen(false);
                        setHoverCustomGrid(null);
                      }}
                      className={`flex h-8 min-w-[104px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 text-[12px] font-medium transition-colors ${
                        gridMenuOpen || activeGridSelection
                          ? "border-violet-400/24 bg-violet-500/[0.1] text-violet-50"
                          : "border-slate-400/12 bg-transparent text-slate-300/74 hover:bg-white/[0.055] hover:text-slate-50"
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
                      className={mediaNodeToolbarButtonClass}
                    >
                      <Maximize2 className="h-5 w-5" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {isStarterPlaceholder ? (
          <>
            {!detachedCanvasTitle && (
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
            )}
            {!detachedCanvasTitle && (
              <div className="absolute -top-8 right-0 z-30 flex shrink-0 items-center gap-3 text-[12px] font-medium tabular-nums text-slate-400/72 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
                <span>{naturalSizeLabel}</span>
              </div>
            )}
          </>
        ) : (
          <div className="relative mb-2 flex items-center justify-between gap-4 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
            {!detachedCanvasTitle && (
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
            )}
            {batchReplacementElapsedLabel && !detachedCanvasTitle && (
              <span
                data-batch-replacement-elapsed-badge="true"
                className="absolute left-1/2 top-0 z-30 -translate-x-1/2 rounded-full border border-cyan-200/16 bg-cyan-300/[0.08] px-3 py-0.5 text-[15px] font-medium tracking-tight text-cyan-50/90 shadow-[0_10px_24px_-18px_rgba(34,211,238,0.8),inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={elapsedBadgeStyle}
              >
                {batchReplacementElapsedLabel}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-3">
              {!isFrameStrip && resolvedImageUrls.length > 1 && (
                <span className="rounded-full border border-slate-400/18 bg-slate-900/46 px-2.5 py-1 text-[11px] font-semibold text-slate-300/72">
                  {activeImageIndex + 1}/{resolvedImageUrls.length}
                </span>
              )}
              {!detachedCanvasTitle && (
                <span className="text-[12px] font-medium tabular-nums text-slate-400/72">
                  {naturalSizeLabel}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="flex w-full flex-col items-center">
          <div
            ref={mediaFrameRef}
            className={getImagePreviewFrameClassName({
              isImageLoaded: isEmptyBatchReplacementSuccess ? false : isFrameStrip || isImageLoaded,
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
                  <div className="relative flex items-center gap-2 rounded-full border border-slate-400/16 bg-[#0b1220]/72 px-3 py-1.5 text-[12px] font-semibold text-slate-200/72 shadow-[0_16px_42px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                    {isImageLoadFailed ? (
                      <ImageIcon className="h-3.5 w-3.5 text-rose-200/72" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200/72" />
                    )}
                    <span>{isImageLoadFailed ? "图片加载失败" : "图片加载中"}</span>
                  </div>
                </div>
              )}
              {isEmptyBatchReplacementSuccess ? (
                <div
                  data-batch-replacement-empty-success="true"
                  className="flex h-full w-full flex-col items-center justify-center gap-4 text-center"
                >
                  <div className="relative flex h-[96px] w-[96px] items-center justify-center rounded-[24px] border border-emerald-200/16 bg-emerald-300/[0.055] text-emerald-100/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_42px_-28px_rgba(16,185,129,0.72)]">
                    <ImageIcon className="h-12 w-12" strokeWidth={1.55} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[14px] font-semibold text-emerald-50/92">
                      生成完成，未返回图片
                    </div>
                  </div>
                </div>
              ) : isBatchReplacementResultNode ? (
                <div
                  data-batch-replacement-result-grid="true"
                  data-batch-replacement-result-count={resolvedImageUrls.length}
                  className="grid h-full w-full gap-px overflow-hidden rounded-[inherit] bg-[#07101b] p-[10px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]"
                  style={{
                    gridTemplateColumns: `repeat(${batchReplacementResultColumnCount}, ${frameTileWidth}px)`,
                    gridAutoRows: `${frameTileHeight}px`,
                  }}
                >
                  {resolvedImageUrls.map((url, index) => {
                    const isBatchReplacementPlaceholder =
                      url === BATCH_REPLACEMENT_FRAME_PLACEHOLDER ||
                      !url ||
                      url.startsWith("data:image/svg+xml");
                    return (
                      <div
                        key={`${url}-${index}`}
                        role="button"
                        tabIndex={0}
                        data-node-action="true"
                        data-batch-replacement-result-cell="true"
                        data-frame-strip-cell="true"
                        data-frame-node-id={node.id}
                        data-frame-index={index}
                        aria-label={`第 ${index + 1} 张批量替换结果，拖拽到画布生成图片子节点`}
                        onPointerDown={(event) => {
                          if (!isBatchReplacementPlaceholder)
                            beginFrameExtractionDrag(event, index, url, getFrameImageOssId(index));
                        }}
                        onPointerMove={(event) => {
                          if (!isBatchReplacementPlaceholder) moveFrameExtractionDrag(event);
                        }}
                        onPointerUp={(event) => {
                          if (!isBatchReplacementPlaceholder)
                            endFrameExtractionDrag(event, index, url);
                        }}
                        onPointerCancel={(event) => {
                          if (!isBatchReplacementPlaceholder) cancelFrameExtractionDrag(event);
                        }}
                        onKeyDown={(event) => {
                          if (isBatchReplacementPlaceholder) return;
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          setActiveImageIndex(index);
                          onSetPrimaryImageResult?.(node.id, url, index);
                        }}
                        className={`group/frame relative overflow-hidden bg-[#050914] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.92),inset_0_0_32px_rgba(15,23,42,0.3)] transition-all duration-200 hover:z-10 hover:scale-[1.018] hover:shadow-[0_0_0_2px_rgba(125,211,252,0.88),0_18px_44px_-22px_rgba(34,211,238,0.78),inset_0_0_0_1px_rgba(236,254,255,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 ${onExtractFrameImage ? "cursor-grab active:cursor-grabbing" : ""}`}
                        style={{ height: frameTileHeight, width: frameTileWidth }}
                      >
                        {isBatchReplacementPlaceholder ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94)_50%,rgba(30,41,59,0.98))] text-slate-300/72">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_78%_72%,rgba(129,140,248,0.12),transparent_38%)]" />
                            <div className="animate-shimmer absolute inset-y-0 left-[-45%] w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]" />
                            <ImageIcon className="relative h-7 w-7 text-slate-300/70" />
                            <div className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-200/76">
                              <Loader2 className="h-3 w-3 animate-spin text-cyan-200/80" />
                              <span>正在生成图片</span>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`批量替换结果 ${index + 1}`}
                            className="h-full w-full object-contain transition-all duration-200 group-hover/frame:brightness-110 group-hover/frame:saturate-110"
                            decoding="async"
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
                        )}
                        <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full border border-white/18 bg-[#0b1018]/82 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-[0_8px_18px_-12px_rgba(0,0,0,0.95)] transition-all duration-200 group-hover/frame:border-cyan-100/42 group-hover/frame:bg-cyan-100/18 group-hover/frame:text-cyan-50 group-hover/frame:shadow-[0_0_20px_rgba(103,232,249,0.26)]">
                          {index + 1}
                        </span>
                        {!isBatchReplacementPlaceholder &&
                          (onExtractFrameImage || downloadVisibility.showFrameTileDownload) && (
                            <>
                              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(236,254,255,0.1)_0%,rgba(236,254,255,0.04)_38%,rgba(2,12,22,0.62)_100%)] opacity-0 transition-opacity duration-200 group-hover/frame:opacity-100" />
                              <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_0_1px_rgba(236,254,255,0.42)] transition-opacity duration-200 group-hover/frame:opacity-100" />
                              <div className={FRAME_TILE_ACTION_BAR_CLASS}>
                                {onExtractFrameImage && (
                                  <button
                                    type="button"
                                    data-node-action="true"
                                    className={FRAME_TILE_EXTRACT_BUTTON_CLASS}
                                    onPointerDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onExtractFrameImage(
                                        node.id,
                                        index,
                                        undefined,
                                        getFrameNaturalSize(index)
                                      );
                                    }}
                                  >
                                    提取
                                  </button>
                                )}
                                {downloadVisibility.showFrameTileDownload && (
                                  <button
                                    type="button"
                                    data-node-action="true"
                                    aria-label={`下载第 ${index + 1} 张批量替换结果`}
                                    className={FRAME_TILE_ICON_BUTTON_CLASS}
                                    onPointerDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void downloadFrameImage(url, index);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                      </div>
                    );
                  })}
                </div>
              ) : isFrameStrip ? (
                <div className="group/framegrid flex h-full w-full flex-col gap-px overflow-hidden rounded-[inherit] bg-[#07101b] p-[10px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                  {frameStripRows.map((row, rowIndex) => (
                    <div key={`frame-row-${rowIndex}`} className="flex shrink-0 gap-px">
                      {row.map(({ index, tileSize, url }) => {
                        const isBatchReplacementPlaceholder =
                          isBatchReplacementResultNode &&
                          url === BATCH_REPLACEMENT_FRAME_PLACEHOLDER;
                        return (
                          <div
                            key={`${url}-${index}`}
                            role="button"
                            tabIndex={0}
                            data-node-action="true"
                            data-frame-strip-cell="true"
                            data-frame-node-id={node.id}
                            data-frame-index={index}
                            aria-label={`第 ${index + 1} 帧，拖拽到画布生成图片子节点`}
                            onPointerDown={(event) => {
                              if (!isBatchReplacementPlaceholder)
                                beginFrameExtractionDrag(
                                  event,
                                  index,
                                  url,
                                  getFrameImageOssId(index)
                                );
                            }}
                            onPointerMove={(event) => {
                              if (!isBatchReplacementPlaceholder) moveFrameExtractionDrag(event);
                            }}
                            onPointerUp={(event) => {
                              if (!isBatchReplacementPlaceholder)
                                endFrameExtractionDrag(event, index, url);
                            }}
                            onPointerCancel={(event) => {
                              if (!isBatchReplacementPlaceholder) cancelFrameExtractionDrag(event);
                            }}
                            onKeyDown={(event) => {
                              if (isBatchReplacementPlaceholder) return;
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              setActiveImageIndex(index);
                              onSetPrimaryImageResult?.(node.id, url, index);
                            }}
                            className={`group/frame relative shrink-0 overflow-hidden bg-[#050914] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.92),inset_0_0_32px_rgba(15,23,42,0.3)] transition-all duration-200 group-hover/framegrid:opacity-70 hover:z-10 hover:scale-[1.018] hover:opacity-100 hover:shadow-[0_0_0_2px_rgba(125,211,252,0.88),0_18px_44px_-22px_rgba(34,211,238,0.78),inset_0_0_0_1px_rgba(236,254,255,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 ${onExtractFrameImage ? "cursor-grab active:cursor-grabbing" : ""}`}
                            style={{ height: tileSize.height, width: tileSize.width }}
                          >
                            {isBatchReplacementPlaceholder ? (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94)_50%,rgba(30,41,59,0.98))] text-slate-300/72">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_78%_72%,rgba(129,140,248,0.12),transparent_38%)]" />
                                <div className="animate-shimmer absolute inset-y-0 left-[-45%] w-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]" />
                                <ImageIcon className="relative h-7 w-7 text-slate-300/70" />
                                <div className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-200/76">
                                  <Loader2 className="h-3 w-3 animate-spin text-cyan-200/80" />
                                  <span>正在生成图片</span>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={url}
                                alt={`\u9010\u5e27\u5206\u6790 ${index + 1}`}
                                className="h-full w-full object-contain transition-all duration-200 group-hover/frame:brightness-110 group-hover/frame:saturate-110"
                                loading={getStripThumbnailLoadingMode({
                                  activeIndex: activeImageIndex,
                                  index,
                                })}
                                decoding="async"
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
                            )}
                            <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full border border-white/18 bg-[#0b1018]/82 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-[0_8px_18px_-12px_rgba(0,0,0,0.95)] transition-all duration-200 group-hover/frame:border-cyan-100/42 group-hover/frame:bg-cyan-100/18 group-hover/frame:text-cyan-50 group-hover/frame:shadow-[0_0_20px_rgba(103,232,249,0.26)]">
                              {index + 1}
                            </span>
                            {!isBatchReplacementPlaceholder &&
                              (onExtractFrameImage || downloadVisibility.showFrameTileDownload) && (
                                <>
                                  <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(236,254,255,0.1)_0%,rgba(236,254,255,0.04)_38%,rgba(2,12,22,0.62)_100%)] opacity-0 transition-opacity duration-200 group-hover/frame:opacity-100" />
                                  <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_0_1px_rgba(236,254,255,0.42)] transition-opacity duration-200 group-hover/frame:opacity-100" />
                                  <div className={FRAME_TILE_ACTION_BAR_CLASS}>
                                    {onExtractFrameImage && (
                                      <button
                                        type="button"
                                        data-node-action="true"
                                        className={FRAME_TILE_EXTRACT_BUTTON_CLASS}
                                        onPointerDown={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          onExtractFrameImage(
                                            node.id,
                                            index,
                                            undefined,
                                            getFrameNaturalSize(index)
                                          );
                                        }}
                                      >
                                        提取
                                      </button>
                                    )}
                                    {downloadVisibility.showFrameTileDownload && (
                                      <button
                                        type="button"
                                        data-node-action="true"
                                        aria-label={`下载第 ${index + 1} 帧图片`}
                                        className={FRAME_TILE_ICON_BUTTON_CLASS}
                                        onPointerDown={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void downloadFrameImage(url, index);
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <img
                  ref={imageElementRef}
                  src={imageUrl}
                  alt="\u751f\u6210\u56fe\u7247"
                  className={`block h-full w-full transition-opacity duration-200 ${isStarterPlaceholder || isImageLoaded ? "opacity-100" : "opacity-0"} ${isStarterPlaceholder ? "object-cover" : "object-contain"}`}
                  loading={getImageLoadingMode({ selected, visible: true })}
                  decoding="async"
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
              {canAnnotateImage && (visibleAnnotations.length > 0 || annotationMode) ? (
                <svg
                  data-node-action="true"
                  data-image-annotation-overlay="true"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  className={`absolute inset-0 z-20 h-full w-full ${
                    annotationMode ? "cursor-crosshair" : "pointer-events-none"
                  }`}
                  onPointerDown={handleAnnotationPointerDown}
                  onPointerMove={handleAnnotationPointerMove}
                  onPointerUp={handleAnnotationPointerUp}
                  onPointerCancel={() => {
                    annotationMoveRef.current = null;
                    setAnnotationDraft(null);
                  }}
                  onClick={(event) => {
                    if (annotationMode) event.stopPropagation();
                  }}
                >
                  <defs>
                    <marker
                      id={`annotation-arrow-${node.id}`}
                      markerHeight="10"
                      markerWidth="10"
                      orient="auto"
                      refX="8"
                      refY="3"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L0,6 L8,3 z" fill="context-stroke" />
                    </marker>
                  </defs>
                  {visibleAnnotations.map((annotation) => {
                    const isDraftAnnotation = annotation.id === "__draft_annotation__";
                    const isSelectedAnnotation = annotation.id === selectedAnnotationId;
                    const annotationStrokeWidthValue =
                      annotation.type === "text" ? 2 : annotation.strokeWidth;
                    const commonStroke = {
                      opacity: isDraftAnnotation ? 0.72 : 1,
                      stroke: annotation.color,
                      strokeWidth: annotationStrokeWidthValue / annotationStrokeScale,
                    };
                    const selectionStrokeWidth = 2 / annotationStrokeScale;
                    if (annotation.type === "rect") {
                      return (
                        <React.Fragment key={annotation.id}>
                          <rect
                            x={annotation.x}
                            y={annotation.y}
                            width={annotation.width}
                            height={annotation.height}
                            fill="none"
                            {...commonStroke}
                          />
                          {isSelectedAnnotation && (
                            <rect
                              x={annotation.x}
                              y={annotation.y}
                              width={annotation.width}
                              height={annotation.height}
                              fill="none"
                              stroke="#ffffff"
                              strokeDasharray="0.012 0.008"
                              strokeWidth={selectionStrokeWidth}
                            />
                          )}
                        </React.Fragment>
                      );
                    }
                    if (annotation.type === "arrow") {
                      return (
                        <React.Fragment key={annotation.id}>
                          <line
                            x1={annotation.start.x}
                            y1={annotation.start.y}
                            x2={annotation.end.x}
                            y2={annotation.end.y}
                            markerEnd={`url(#annotation-arrow-${node.id})`}
                            strokeLinecap="round"
                            {...commonStroke}
                          />
                          {isSelectedAnnotation && (
                            <>
                              <line
                                x1={annotation.start.x}
                                y1={annotation.start.y}
                                x2={annotation.end.x}
                                y2={annotation.end.y}
                                fill="none"
                                stroke="#ffffff"
                                strokeDasharray="0.012 0.008"
                                strokeLinecap="round"
                                strokeWidth={selectionStrokeWidth}
                              />
                              {(["start", "end"] as const).map((resizeEndpoint) => {
                                const point = annotation[resizeEndpoint];
                                const isEndHandle = resizeEndpoint === "end";
                                return (
                                  <circle
                                    key={`${annotation.id}-${resizeEndpoint}`}
                                    data-image-annotation-arrow-handle={resizeEndpoint}
                                    aria-label={isEndHandle ? "调整箭头终点" : "调整箭头起点"}
                                    cx={point.x}
                                    cy={point.y}
                                    r={(isEndHandle ? 7 : 5.5) / annotationStrokeScale}
                                    fill={isEndHandle ? annotation.color : "#0f172a"}
                                    stroke="#ffffff"
                                    strokeWidth={2 / annotationStrokeScale}
                                    className="cursor-grab"
                                    onPointerDown={(event) =>
                                      handleArrowEndpointPointerDown(
                                        annotation.id,
                                        resizeEndpoint,
                                        event
                                      )
                                    }
                                  />
                                );
                              })}
                            </>
                          )}
                        </React.Fragment>
                      );
                    }
                    if (annotation.type === "text") {
                      return (
                        <text
                          key={annotation.id}
                          x={annotation.x}
                          y={annotation.y}
                          fill={annotation.color}
                          fontSize={annotation.fontSize / annotationStrokeScale}
                          fontWeight={700}
                          paintOrder="stroke"
                          stroke={isSelectedAnnotation ? "#ffffff" : "rgba(15,23,42,0.72)"}
                          strokeWidth={isSelectedAnnotation ? 3 / annotationStrokeScale : 2 / annotationStrokeScale}
                        >
                          {annotation.text}
                        </text>
                      );
                    }
                    return (
                      <path
                        key={annotation.id}
                        d={getAnnotationPenPath(annotation.points)}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        {...commonStroke}
                      />
                    );
                  })}
                </svg>
              ) : null}
              {annotationMode && imageAnnotations.length > 0 && (
                <div
                  data-node-action="true"
                  data-image-annotation-list="true"
                  className="absolute left-[calc(100%+12px)] top-0 z-30 w-48 rounded-[12px] border border-slate-400/16 bg-[#101827]/92 p-2 text-xs text-slate-200 shadow-[0_20px_50px_-26px_rgba(0,0,0,0.92)] backdrop-blur-xl"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-300/80">
                    <ListChecks className="h-3.5 w-3.5 text-violet-200/80" />
                    <span>批注列表</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-0.5 custom-scrollbar">
                    {imageAnnotations.map((annotation, index) => (
                      <button
                        key={annotation.id}
                        type="button"
                        onClick={() => {
                          setSelectedAnnotationId(annotation.id);
                          setAnnotationTool("select");
                        }}
                        className={`mb-1 flex h-8 w-full items-center justify-between gap-2 rounded-[8px] px-2 text-left transition ${
                          selectedAnnotationId === annotation.id
                            ? "bg-violet-400/16 text-violet-50"
                            : "text-slate-300/78 hover:bg-white/[0.06] hover:text-slate-50"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {index + 1}. {annotation.type === "text" ? annotation.text : annotation.type}
                        </span>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: annotation.color }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
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
                        data-grid-split-cell="true"
                        data-grid-node-id={node.id}
                        data-grid-image-url={imageUrl}
                        data-grid-cell-index={index}
                        data-grid-rows={activeGridSelection.rows}
                        data-grid-cols={activeGridSelection.cols}
                        onMouseEnter={() => setHoveredGridCell(index)}
                        onMouseLeave={() =>
                          setHoveredGridCell((current) => (current === index ? null : current))
                        }
                        onPointerDown={(event) => beginGridCellExtractionDrag(event, index)}
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
                  <div className="flex items-center gap-2 rounded-full border border-cyan-100/18 bg-[#0b1220]/82 px-3 py-1.5 text-[12px] font-semibold text-slate-100/86 shadow-[0_16px_42px_-22px_rgba(34,211,238,0.48),inset_0_1px_0_rgba(255,255,255,0.08)]">
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
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-400/18 bg-slate-900/42 text-slate-200/78 transition-all hover:border-slate-300/32 hover:bg-slate-800/70 hover:text-white"
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
                        loading={getStripThumbnailLoadingMode({
                          activeIndex: activeImageIndex,
                          index,
                        })}
                        decoding="async"
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
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-400/18 bg-slate-900/42 text-slate-200/78 transition-all hover:border-slate-300/32 hover:bg-slate-800/70 hover:text-white"
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
                {selected &&
                  !isUploadingNodeAsset &&
                  !isEmptyBatchReplacementSuccess &&
                  shouldShowUploadButton && (
                    <motion.div
                      data-node-action="true"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute left-1/2 top-0 z-40 flex -translate-x-1/2 -translate-y-[calc(100%+14px)] items-center"
                      style={{ scale: floatingCanvasUiScale, transformOrigin: "bottom center" }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {uploadControl}
                    </motion.div>
                  )}
              </AnimatePresence>
              {!detachedCanvasTitle && (
                <div className="absolute -top-8 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
                  <ImageIcon className="h-4 w-4 text-violet-100/58" />
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
              )}
              <div className="relative px-5 pb-5 pt-8">
                {isRunning || isUploadingNodeAsset ? (
                  <div
                    className="flex flex-col items-center justify-center gap-4 text-slate-300/60"
                    style={{ minHeight: Math.max(120, emptyImageNodeSize.nodeHeight - 52) }}
                  >
                    <div className="relative flex h-[96px] w-[96px] items-center justify-center text-violet-100/58">
                      <ImageIcon className="h-14 w-14" strokeWidth={1.55} />
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 text-[13px] text-slate-100/80">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-100/72" />
                        {getMediaNodeLoadingLabel({
                          isUploading: isUploadingNodeAsset,
                          mediaType: "image",
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center text-center"
                    style={{ minHeight: Math.max(120, emptyImageNodeSize.nodeHeight - 52) }}
                  >
                    <div className="mb-4 flex h-[96px] w-[96px] items-center justify-center text-violet-100/58">
                      <ImageIcon className="h-14 w-14" strokeWidth={1.55} />
                    </div>
                    {isInterrupted ? (
                      <div className="max-w-[260px] text-[13px] leading-5 text-amber-100/78">
                        上次生成已中断，可保留参数重新生成
                      </div>
                    ) : null}
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
              style={{ scale: promptComposerCanvasScale, transformOrigin: "top center" }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
              <div className="absolute right-4 top-4 z-20">{expandPromptEditorButton}</div>
              {inputReferences.length > 0 && (
                <div className="mb-3 flex items-start gap-3 pr-10">
                  <div className="flex flex-wrap items-center gap-2">
                    {inputReferences.map((reference, index) => (
                      <React.Fragment key={`${reference.key}-${reference.value}-${index}`}>
                        <ReferencePreviewCard
                          reference={reference}
                          index={index}
                          onRemove={removeInputReference}
                        />
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
                        ? "border-violet-300/28 bg-violet-500/[0.13] text-violet-50"
                        : "border-slate-400/16 bg-[#111827]/52 text-slate-200/82 hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5 shrink-0 text-violet-200/58" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {getImageModelLabel(currentModel)}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-300/56 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {!expandedPromptEditorOpen &&
                    typeof document !== "undefined" &&
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
                            className="fixed z-[160] overflow-y-auto rounded-2xl border border-slate-400/16 bg-[#121923]/96 p-1.5 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar"
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
                                            ? "bg-violet-500/[0.16] text-violet-50"
                                            : "text-slate-200/82 hover:bg-white/[0.05] hover:text-white"
                                        }`}
                                      >
                                        <span className="min-w-0 flex-1 truncate">
                                          {getImageModelLabel(model)}
                                        </span>
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
                  presetGroups={resolutionPresetGroups}
                  onChange={(nextResolution, nextAspectRatio) => {
                    onUpdateProperty?.(node.id, "resolution", nextResolution);
                    onUpdateProperty?.(node.id, "aspect_ratio", nextAspectRatio);
                    const preset = getImageResolutionPreset(
                      nextResolution,
                      nextAspectRatio,
                      resolutionPresetGroups
                    );
                    if (preset) {
                      onUpdateProperty?.(node.id, "customSize", `${preset.width}x${preset.height}`);
                    }
                    const nextNodeSizeData = resolveImageNodeSizePresetData({
                      aspectRatio: nextAspectRatio,
                      hasImageUrl: Boolean(imageUrl),
                      isExtractedFrameNode,
                      isFrameStrip,
                      isUploadPlaceholder: node.data?.isUploadPlaceholder === true,
                      resolution: nextResolution,
                    });
                    if (nextNodeSizeData) onUpdateData?.(node.id, nextNodeSizeData);
                  }}
                  buttonClassName="relative inline-flex h-10 min-w-[230px] items-center justify-center gap-2 rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-[13px] font-medium text-slate-200/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
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
                        ? "border-violet-300/28 bg-violet-500/[0.13] text-violet-50"
                        : "border-slate-400/16 bg-[#111827]/42 text-slate-300/72 hover:border-violet-200/22 hover:bg-violet-500/[0.08] hover:text-violet-50"
                    }`}
                  >
                    <span>{quantity.replace("张", "")}</span>
                    <span className="text-[12px] text-slate-400/68">张</span>
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
                        className="absolute bottom-[calc(100%+12px)] left-0 z-50 w-[112px] rounded-[16px] border border-slate-400/16 bg-[#0d121c]/96 p-2 shadow-[0_22px_56px_-22px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
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
                                  ? "bg-violet-500/[0.16] text-violet-50"
                                  : "text-slate-300/76 hover:bg-white/[0.055] hover:text-slate-100"
                              }`}
                            >
                              <span className="text-[13px] font-semibold">{option}</span>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.72)]" : "bg-slate-500/35"}`}
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
                  disabled={isRunning || !canRunImagePrompt}
                  className={`ml-auto flex h-10 w-10 items-center justify-center rounded-[14px] transition-all ${
                    isRunning || !canRunImagePrompt
                      ? "cursor-not-allowed border border-cyan-100/6 bg-slate-200/8 text-slate-200/28"
                      : "bg-slate-100 text-[#111827] shadow-[0_14px_30px_-18px_rgba(226,232,240,0.72)] hover:bg-white"
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
        {expandedPromptEditorNode}
      </motion.div>
    </>
  );
}

const ImageNodeCard = React.memo(
  ImageNodeCardImpl,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.detachedCanvasTitle === next.detachedCanvasTitle &&
    prev.canvasZoom === next.canvasZoom &&
    prev.isReviewingAsset === next.isReviewingAsset &&
    prev.apiConfig?.remoteModelsByType === next.apiConfig?.remoteModelsByType &&
    prev.resolvedInputs === next.resolvedInputs &&
    prev.references === next.references
);

export default ImageNodeCard;
