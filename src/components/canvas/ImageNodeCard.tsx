import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
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
import { getNodeWidth } from "./geometry";
import { Tooltip } from "../common/Tooltip";
import { downloadMediaAsset, extensionFromAssetUrl } from "../../utils/mediaAssets";
import { formatGridCellLabel } from "../../utils/imageGridSplit";
import { uploadFileToOss } from "../../features/resource/ossApi";

interface ImageNodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: unknown) => void;
  onUpdateData?: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onSetPrimaryImageResult?: (nodeId: string, imageUrl: string, imageIndex: number) => void;
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

const RESULT_IMAGE_MAX_WIDTH = 780;
const RESULT_IMAGE_MAX_HEIGHT = 585;
const SQUARE_RESULT_IMAGE_MAX_WIDTH = 520;
const SQUARE_RESULT_IMAGE_MAX_HEIGHT = 390;
const PLACEHOLDER_RESULT_IMAGE_MAX_WIDTH = 520;
const PLACEHOLDER_RESULT_IMAGE_MAX_HEIGHT = 390;
const RATIO_OPTIONS = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"];
const QUANTITY_OPTIONS = ["1张", "2张", "3张", "4张"];
const MINIMAX_IMAGE_MODEL = "MiniMax Image 01";
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
const MINIMAX_RATIO_SIZE: Record<string, string> = {
  "16:9": "1280×720",
  "9:16": "720×1280",
  "4:3": "1152×864",
  "3:4": "864×1152",
  "1:1": "1024×1024",
  "21:9": "1344×576",
};

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
}: {
  hasImageUrl: boolean;
  isImageLoaded: boolean;
  isImageLoadFailed: boolean;
}) {
  return !hasImageUrl || isImageLoaded || isImageLoadFailed;
}

export function getImageNodePortTopStyle({
  hasImageUrl,
  imagePortCenterY,
}: {
  hasImageUrl: boolean;
  imagePortCenterY?: number;
}) {
  if (!hasImageUrl) return EMPTY_IMAGE_NODE_MAIN_CARD_CENTER_Y;
  return imagePortCenterY ?? "50%";
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

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function getResultImageBounds(aspectRatio: string, isUploadPlaceholder = false) {
  if (isUploadPlaceholder) {
    return {
      maxWidth: PLACEHOLDER_RESULT_IMAGE_MAX_WIDTH,
      maxHeight: PLACEHOLDER_RESULT_IMAGE_MAX_HEIGHT,
    };
  }

  if (aspectRatio === "1:1") {
    return {
      maxWidth: SQUARE_RESULT_IMAGE_MAX_WIDTH,
      maxHeight: SQUARE_RESULT_IMAGE_MAX_HEIGHT,
    };
  }

  return {
    maxWidth: RESULT_IMAGE_MAX_WIDTH,
    maxHeight: RESULT_IMAGE_MAX_HEIGHT,
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
  isUploadPlaceholder = false
) {
  const bounds = getResultImageBounds(aspectRatio, isUploadPlaceholder);
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
  onSelect,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
  onDragStart,
  onUpdateProperty,
  onUpdateData,
  onSetPrimaryImageResult,
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
  const isRunning = node.data?.loading === true;
  const [isHovered, setIsHovered] = React.useState(false);
  const [openSelect, setOpenSelect] = React.useState<"ratio" | "quantity" | null>(null);
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
  const previewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const mediaFrameRef = React.useRef<HTMLDivElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
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
  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
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
  const isImageLoaded = Boolean(
    imageUrl && imageLoadState.url === imageUrl && imageLoadState.status === "loaded"
  );
  const isImageLoadFailed = Boolean(
    imageUrl && imageLoadState.url === imageUrl && imageLoadState.status === "error"
  );
  const aspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const quantity = (node.properties.quantity as string) || "1张";
  const isStarterPlaceholder = node.data?.isUploadPlaceholder === true;
  const nodeBadgeTitle =
    node.title === "图片节点" || node.title === "图片" ? "图片节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const nodeWidth = getNodeWidth(node);
  const resultImageBounds = getResultImageBounds(
    aspectRatio,
    node.data?.isUploadPlaceholder === true
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
        node.data?.isUploadPlaceholder === true
      ),
    [
      aspectRatio,
      naturalImageSize?.height,
      naturalImageSize?.width,
      node.data?.imageDisplayHeight,
      node.data?.imageDisplayWidth,
      node.data?.isUploadPlaceholder,
    ]
  );
  const imageSetKey = React.useMemo(() => resolvedImageUrls.join("||"), [resolvedImageUrls]);
  const naturalSizeLabel =
    naturalImageSize && naturalImageSize.width > 0 && naturalImageSize.height > 0
      ? `${naturalImageSize.width} × ${naturalImageSize.height}`
      : `${resultImageSize.width} × ${resultImageSize.height}`;
  const shouldShowUploadButton = shouldShowImageUploadButton({
    hasImageUrl: Boolean(imageUrl),
    isImageLoaded,
    isImageLoadFailed,
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
    node.id,
    onUpdateData,
    resolvedImageUrls.length,
    resultImageSize.height,
    resultImageSize.width,
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
    if (!selected) {
      setOpenSelect(null);
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
    onRun?.(node.id);
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
          const displaySize = fitImageSize(
            naturalSize,
            aspectRatio,
            resultImageBounds.maxWidth,
            resultImageBounds.maxHeight
          );
          setActiveImageIndex(0);
          setNaturalImageSize(naturalSize);
          onUpdateProperty?.(node.id, "imageUrl", uploadedUrl);
          onUpdateData?.(node.id, {
            imageUrl: uploadedUrl,
            imageUrls: [uploadedUrl],
            activeImageIndex: 0,
            imageNaturalWidth: naturalSize.width,
            imageNaturalHeight: naturalSize.height,
            imageDisplayWidth: displaySize.width,
            imageDisplayHeight: displaySize.height,
            uploadedImage: true,
            isUploadPlaceholder: false,
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
      <Tooltip content={imageUrl ? "上传替换图片" : "上传图片"} position="top">
        <button
          type="button"
          data-node-action="true"
          onClick={handleUploadClick}
          disabled={isUploadingNodeAsset}
          className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-slate-300/14 bg-[#101827]/72 text-slate-300/78 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-violet-300/36 hover:bg-violet-500/[0.16] hover:text-violet-50 hover:shadow-[0_16px_34px_-22px_rgba(139,92,246,0.85),0_0_18px_rgba(139,92,246,0.2)]"
        >
          {isUploadingNodeAsset ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Upload className="h-[18px] w-[18px]" />
          )}
        </button>
      </Tooltip>
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

  const hasInputPorts = node.inputs.length > 0;
  const portTopStyle = getImageNodePortTopStyle({
    hasImageUrl: Boolean(imageUrl),
    imagePortCenterY: node.data?.imagePortCenterY,
  });
  const portHandles = (
    <AnimatePresence>
      {shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
        <>
          {hasInputPorts && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute -left-11 z-10 -translate-y-1/2"
              style={{ top: portTopStyle }}
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
            className="absolute -right-11 z-10 -translate-y-1/2"
            style={{ top: portTopStyle }}
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

  if (imageUrl && !isRunning) {
    return (
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="absolute text-left"
        style={{ width: resultImageSize.width }}
        ref={previewNodeRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          onPointerDown={(e) => {
            if (e.button !== 0) {
              e.stopPropagation();
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
          style={{ width: resultImageSize.width }}
        >
          {portHandles}
          <div
            data-node-action="true"
            className="absolute right-2 top-8 z-30"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {shouldShowUploadButton ? uploadControl : null}
          </div>
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
                                    onClick={() =>
                                      handleActivatePresetGrid(option.rows, option.cols)
                                    }
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
                {resolvedImageUrls.length > 1 && (
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
                isImageLoaded,
                isSelected: selected,
                isStarterPlaceholder,
              })}
              style={{ width: resultImageSize.width, height: resultImageSize.height }}
            >
              <div className="relative h-full w-full">
                {!isStarterPlaceholder && !isImageLoaded && (
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
                <img
                  src={imageUrl}
                  alt="生成图片"
                  className={`block h-full w-full transition-opacity duration-200 ${isStarterPlaceholder || isImageLoaded ? "opacity-100" : "opacity-0"} ${isStarterPlaceholder ? "object-cover" : "object-contain"}`}
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageLoadState({ status: "loaded", url: imageUrl });
                    const naturalSize = {
                      width: img.naturalWidth || resultImageSize.width,
                      height: img.naturalHeight || resultImageSize.height,
                    };
                    const displaySize = fitImageSize(
                      naturalSize,
                      aspectRatio,
                      resultImageBounds.maxWidth,
                      resultImageBounds.maxHeight
                    );
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
            {resolvedImageUrls.length > 1 && (
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
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="absolute text-left"
      style={{ width: nodeWidth }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {portHandles}
      <motion.div
        onPointerDown={(e) => {
          if (e.button !== 0) {
            e.stopPropagation();
            return;
          }
          const target = e.target as HTMLElement;
          if (
            !target.closest("[data-node-action='true']") &&
            !target.closest("textarea,button,input")
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
        style={{ width: nodeWidth, minHeight: 290 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
          </div>
        )}
        <div
          data-node-action="true"
          className="absolute right-5 top-5 z-30"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {shouldShowUploadButton ? uploadControl : null}
        </div>
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
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-5 text-slate-300/60">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <div className="text-[13px] text-slate-100/80">正在生成图片</div>
                <div className="mt-2 text-[11px] text-slate-400/60">MiniMax 正在构建画面</div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[250px] flex-col items-center justify-center">
              <div className="mb-8 flex h-[96px] w-[96px] items-center justify-center text-cyan-100/58">
                <ImageIcon className="h-14 w-14" strokeWidth={1.55} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {(isHovered || selected) && !imageUrl && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-node-action="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(e);
            }}
            className="relative node-card left-1/2 mt-5 w-[620px] -translate-x-1/2 rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-4 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
            <textarea
              value={upstreamPrompt ? "" : promptText}
              onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
              disabled={!!upstreamPrompt}
              placeholder={
                upstreamPrompt
                  ? `已由上游节点 (${upstreamPrompt.key}) 提供提示词`
                  : "描述你想要生成的画面内容"
              }
              className="h-[92px] w-full resize-none bg-transparent px-1 text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/42 disabled:cursor-not-allowed disabled:text-slate-400/45 custom-scrollbar"
            />
            <div
              ref={controlsRef}
              className="mt-3 flex items-center gap-2 border-t border-cyan-100/8 pt-3"
            >
              <div className="flex h-10 min-w-[172px] items-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <Wand2 className="h-3.5 w-3.5 text-cyan-100/50" />
                <span>{MINIMAX_IMAGE_MODEL}</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenSelect((current) => (current === "ratio" ? null : "ratio"));
                  }}
                  className={`relative inline-flex h-10 min-w-[160px] items-center justify-center gap-2 rounded-[14px] border px-3 text-[13px] font-medium transition-colors ${
                    openSelect === "ratio"
                      ? "border-cyan-100/34 bg-cyan-100/[0.075] text-cyan-50"
                      : "border-cyan-100/8 bg-slate-950/18 text-cyan-50/76 hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
                  }`}
                >
                  <span>
                    {aspectRatio} · {MINIMAX_RATIO_SIZE[aspectRatio] || MINIMAX_RATIO_SIZE["16:9"]}
                  </span>
                  <ChevronUp
                    className={`h-3.5 w-3.5 text-slate-300/55 transition-transform ${openSelect === "ratio" ? "" : "rotate-180"}`}
                  />
                </button>
                <AnimatePresence>
                  {openSelect === "ratio" && (
                    <motion.div
                      data-node-action="true"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute bottom-[calc(100%+12px)] left-0 z-50 w-[226px] rounded-[16px] border border-cyan-100/12 bg-[#0d121c]/96 p-2 shadow-[0_22px_56px_-22px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {RATIO_OPTIONS.map((ratio) => {
                        const isActive = ratio === aspectRatio;
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateProperty?.(node.id, "aspect_ratio", ratio);
                              setOpenSelect(null);
                            }}
                            className={`flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left transition-colors ${
                              isActive
                                ? "bg-cyan-300/[0.1] text-cyan-50"
                                : "text-slate-300/76 hover:bg-white/[0.055] hover:text-slate-100"
                            }`}
                          >
                            <span className="text-[13px] font-semibold">{ratio}</span>
                            <span className="flex items-center gap-2 text-[12px] tabular-nums text-slate-400/82">
                              {MINIMAX_RATIO_SIZE[ratio]}
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" : "bg-slate-500/35"}`}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
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
  );
}

const ImageNodeCard = React.memo(
  ImageNodeCardImpl,
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default ImageNodeCard;
