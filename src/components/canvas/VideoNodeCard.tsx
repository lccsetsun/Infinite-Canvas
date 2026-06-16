import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Maximize2,
  Pause,
  Play,
  ScanSearch,
  Upload,
  Video,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { GraphNode } from "../../types";
import type { VideoFrameCaptureItem } from "../../features/video/frameCapture";
import { fetchVideoFrameCapture } from "../../features/video/frameCapture";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { isSourceNode } from "../../utils/sourceNodes";
import { Tooltip } from "../common/Tooltip";
import { downloadMediaAsset, extensionFromAssetUrl } from "../../utils/mediaAssets";
import { uploadFileToOss } from "../../features/resource/ossApi";
import {
  getMediaNodeLoadingLabel,
  isMediaNodeRunning,
  type MediaNodeLoadingOperation,
} from "../../utils/mediaNodeLoadingState";
import { ImageResolutionPicker } from "./ImageResolutionPicker";
import { ReferencePreviewCard, type ReferencePreviewItem } from "./ReferencePreviewCard";
import { PromptTokenEditor } from "./PromptTokenEditor";
import {
  AI_MODEL_TYPES,
  getModelOptionGroups,
  type AiModelsByType,
} from "../../features/api/aiModelCatalog";
import type { ImageResolutionPresetGroup } from "../../features/nodes/imageResolutionPresets";
import {
  getFloatingMenuPosition,
  type FloatingMenuPosition,
} from "../../utils/floatingMenuPosition";
import { stringifyInputReferenceValues } from "../../utils/inputReferenceValues";
import { InlineNodePortHandle } from "./InlineNodePortHandle";
import { getVideoPreloadMode } from "../../utils/mediaPreviewPolicy";
import type { VideoFrameImageCaptureMode } from "../../utils/videoFrameImageExtraction";
import {
  getReadableCanvasOverlayScale,
  mediaNodeFloatingToolbarClass,
  mediaNodeToolbarButtonClass,
  mediaNodeToolbarDividerClass,
  mediaNodeToolbarUploadButtonClass,
} from "./mediaNodeToolbarStyles";

interface VideoNodeCardProps {
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
  onPreview?: (
    content: string,
    title?: string,
    nodeId?: string,
    items?: string[],
    currentIndex?: number
  ) => void;
  onCreateVideoFrameImage?: (
    sourceNodeId: string,
    captureMode: VideoFrameImageCaptureMode,
    preview: { url: string; width: number; height: number }
  ) => string | null;
  onCompleteVideoFrameImage?: (nodeId: string, uploaded: { url: string; ossId?: string }) => void;
  onFailVideoFrameImage?: (nodeId: string, error: string) => void;
  onAnalyzeVideo?: (node: GraphNode, captures: VideoFrameCaptureItem[]) => Promise<void> | void;
  onReverseVideoPrompt?: (node: GraphNode, videoUrl: string) => Promise<void> | void;
  resolvedInputs?: Record<string, unknown>;
  references?: ReferencePreviewItem[];
  resolutionPresetGroups?: ImageResolutionPresetGroup[];
  onRun?: (nodeId: string) => void;
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

const EMPTY_NODE_FOOTPRINT_WIDTH = 540;
const EMPTY_NODE_FOOTPRINT_HEIGHT = 540;
const VIDEO_DURATION_MIN_SECONDS = 1;
const VIDEO_DURATION_MAX_SECONDS = 15;
const VIDEO_DURATION_DEFAULT_SECONDS = 5;
const VIDEO_NODE_REFERENCE_IGNORED_KEYS = new Set([
  "duration",
  "aspect_ratio",
  "resolution",
  "model",
  "audio",
]);
const VIDEO_NODE_TEXT_INPUT_KEYS = new Set(["prompt", "text", "user_prompt"]);

export type VideoNodeInputReferenceKind = "text" | "image" | "video" | "audio";

export interface VideoNodeInputReference {
  key: string;
  kind: VideoNodeInputReferenceKind;
  label: string;
  title: string;
  value: string;
}

function inferVideoNodeInputReferenceKind(
  key: string,
  value: string
): VideoNodeInputReferenceKind | null {
  const normalizedKey = key.toLowerCase();
  const normalizedValue = value.toLowerCase();
  if (
    normalizedKey.includes("image") ||
    normalizedValue.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(normalizedValue)
  ) {
    return "image";
  }
  if (normalizedKey.includes("video") || /\.(mp4|mov|webm|m4v|avi)(\?.*)?$/.test(normalizedValue)) {
    return "video";
  }
  if (
    normalizedKey.includes("audio") ||
    /\.(mp3|wav|m4a|aac|flac|ogg)(\?.*)?$/.test(normalizedValue)
  ) {
    return "audio";
  }
  if (VIDEO_NODE_TEXT_INPUT_KEYS.has(key) || normalizedKey.includes("prompt")) return "text";
  return null;
}

function getVideoInputReferenceLabel(kind: VideoNodeInputReferenceKind) {
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "Text";
}

function getVideoInputReferenceTitle(key: string, kind: VideoNodeInputReferenceKind) {
  if (kind === "image" && key === "image") return "First frame";
  if (kind === "text" && key === "prompt") return "Prompt";
  return getVideoInputReferenceLabel(kind);
}

export function getVideoNodeInputReferences(
  resolvedInputs: Record<string, unknown> | undefined
): VideoNodeInputReference[] {
  if (!resolvedInputs) return [];
  return Object.entries(resolvedInputs).reduce<VideoNodeInputReference[]>(
    (references, [key, rawValue]) => {
      if (VIDEO_NODE_REFERENCE_IGNORED_KEYS.has(key)) return references;
      stringifyInputReferenceValues(rawValue).forEach((value) => {
        const kind = inferVideoNodeInputReferenceKind(key, value);
        if (!kind) return;
        const label = getVideoInputReferenceLabel(kind);
        references.push({
          key,
          kind,
          label,
          title: getVideoInputReferenceTitle(key, kind),
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

export function fitVideoSize(
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
  if (ratio >= maxWidth / maxHeight) {
    return { width: maxWidth, height: Math.round(maxWidth / ratio) };
  }
  return { width: Math.round(maxHeight * ratio), height: maxHeight };
}

export function resolveEmptyVideoNodeSize({
  aspectRatio,
  resolution,
}: {
  aspectRatio: string;
  resolution: string;
}) {
  void resolution;
  const displaySize = fitVideoSize(
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

export function resolveVideoNodeSizePresetData({
  aspectRatio,
  hasVideoUrl,
  resolution,
}: {
  aspectRatio: string;
  hasVideoUrl: boolean;
  resolution: string;
}) {
  if (hasVideoUrl) return null;

  const nextNodeSize = resolveEmptyVideoNodeSize({ aspectRatio, resolution });

  return {
    videoDisplayHeight: nextNodeSize.displayHeight,
    videoDisplayWidth: nextNodeSize.displayWidth,
    videoNodeHeight: nextNodeSize.nodeHeight,
    videoNodeWidth: nextNodeSize.nodeWidth,
    videoPortCenterY: nextNodeSize.portCenterY,
  };
}

export function getVideoNodePortTopStyle({
  emptyVideoNodePortCenterY,
  hasVideoPreview,
  videoPortCenterY,
}: {
  emptyVideoNodePortCenterY: number;
  hasVideoPreview: boolean;
  videoPortCenterY?: number;
}): number | string {
  if (!hasVideoPreview) return emptyVideoNodePortCenterY;
  return videoPortCenterY ?? "50%";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function getVideoControlDisplayTime({
  currentTime,
  duration,
}: {
  currentTime: number;
  duration: number;
}) {
  if (
    Number.isFinite(currentTime) &&
    Number.isFinite(duration) &&
    duration > 0 &&
    duration - currentTime <= 0.1
  ) {
    return duration;
  }
  return currentTime;
}

export function getVideoProgressPercent({
  currentTime,
  duration,
}: {
  currentTime: number;
  duration: number;
}) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (currentTime / duration) * 100)));
}

export type VideoFrameCaptureMode = "current" | "first" | "last";

export function getVideoFrameCaptureTime({
  currentTime,
  duration,
  mode,
}: {
  currentTime: number;
  duration: number;
  mode: VideoFrameCaptureMode;
}) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const maxSeekTime = Math.round(Math.max(0, safeDuration - 0.05) * 100) / 100;
  if (mode === "first") return 0;
  if (mode === "last") return maxSeekTime;
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  return Math.min(safeCurrentTime, maxSeekTime);
}

export function getVideoFrameCaptureSourceUrl(
  videoUrl: string,
  pageOrigin = window.location.origin
) {
  if (!videoUrl.trim()) return "";
  try {
    const url = new URL(videoUrl, pageOrigin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin === pageOrigin
        ? url.toString()
        : `/api/video-frame-source?url=${encodeURIComponent(url.toString())}`;
    }
  } catch {
    return videoUrl;
  }
  return videoUrl;
}

export function normalizeVideoDurationSeconds(value: unknown): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(raw)) return VIDEO_DURATION_DEFAULT_SECONDS;
  return Math.min(
    VIDEO_DURATION_MAX_SECONDS,
    Math.max(VIDEO_DURATION_MIN_SECONDS, Math.trunc(raw))
  );
}

export function getVideoDurationSliderPercent(value: number): number {
  const normalized = normalizeVideoDurationSeconds(value);
  return Math.round(
    ((normalized - VIDEO_DURATION_MIN_SECONDS) /
      (VIDEO_DURATION_MAX_SECONDS - VIDEO_DURATION_MIN_SECONDS)) *
      100
  );
}

export function shouldShowVideoUploadButton({
  isRunning,
  isUploadingAsset,
  isUploadingVideo = false,
}: {
  isRunning: boolean;
  isUploadingAsset: boolean;
  isUploadingVideo?: boolean;
}) {
  return !isRunning && !isUploadingAsset && !isUploadingVideo;
}

export function shouldShowVideoPromptComposer({
  isExternalUploadSourceVideoNode,
  isRunning,
  isSelected,
  isUploadingAsset,
}: {
  isExternalUploadSourceVideoNode: boolean;
  isRunning: boolean;
  isSelected: boolean;
  isUploadingAsset: boolean;
}) {
  return !isRunning && !isUploadingAsset && !isExternalUploadSourceVideoNode && isSelected;
}

export function shouldShowVideoPreview({
  hasVideoUrl,
  isRunning,
  isUploadingAsset,
  loadingOperation,
}: {
  hasVideoUrl: boolean;
  isRunning: boolean;
  isUploadingAsset: boolean;
  loadingOperation?: MediaNodeLoadingOperation;
}) {
  if (!hasVideoUrl || isUploadingAsset) return false;
  if (!isRunning) return true;
  return loadingOperation === "frame-analysis" || loadingOperation === "video-prompt";
}

export function shouldShowVideoCustomControls({
  hasVideoPreview,
  isHovered,
}: {
  hasVideoPreview: boolean;
  isHovered: boolean;
}) {
  return hasVideoPreview && isHovered;
}

export function shouldUseEmptyVideoNodeSize({
  hasVideoUrl,
  isUploadingAsset,
  hasKnownVideoSize,
}: {
  hasVideoUrl: boolean;
  isUploadingAsset: boolean;
  hasKnownVideoSize: boolean;
}) {
  return !hasVideoUrl && !(isUploadingAsset && hasKnownVideoSize);
}

function VideoNodeCardImpl({
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
  onPreview,
  onCreateVideoFrameImage,
  onCompleteVideoFrameImage,
  onFailVideoFrameImage,
  onAnalyzeVideo,
  onReverseVideoPrompt,
  references,
  resolvedInputs,
  resolutionPresetGroups,
  onRun,
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
}: VideoNodeCardProps) {
  const isRunning = isMediaNodeRunning({
    data: node.data,
    properties: node.properties,
  });
  const isSourceAssetNode = isSourceNode(node);
  const isNodeUploadingAsset = node.data?.uploadingAsset === true;
  const [isHovered, setIsHovered] = React.useState(false);
  const [expandedPromptEditorOpen, setExpandedPromptEditorOpen] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isVideoFrameHovered, setIsVideoFrameHovered] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [mediaDuration, setMediaDuration] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [frameMenuOpen, setFrameMenuOpen] = React.useState(false);
  const [isAnalyzingFrames, setIsAnalyzingFrames] = React.useState(false);
  const [isReversingPrompt, setIsReversingPrompt] = React.useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = React.useState(false);
  const isUploadingAsset = isNodeUploadingAsset || isUploadingVideo;
  const floatingCanvasUiScale = 1 / Math.max(0.55, Math.min(3, canvasZoom));
  const promptComposerCanvasScale = getReadableCanvasOverlayScale(canvasZoom);
  const shouldShowUploadButton = shouldShowVideoUploadButton({
    isRunning,
    isUploadingAsset,
    isUploadingVideo,
  });
  const modelMenuRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuPortalRef = React.useRef<HTMLDivElement | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [modelMenuPosition, setModelMenuPosition] = React.useState<FloatingMenuPosition | null>(
    null
  );
  const previewNodeRef = React.useRef<HTMLDivElement | null>(null);
  const mediaFrameRef = React.useRef<HTMLDivElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const captureQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const [naturalVideoSize, setNaturalVideoSize] = React.useState<{
    width: number;
    height: number;
  } | null>(() => {
    const width = node.data?.videoNaturalWidth;
    const height = node.data?.videoNaturalHeight;
    return typeof width === "number" && typeof height === "number" ? { width, height } : null;
  });
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (!frameMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-video-frame-menu='true']")) return;
      setFrameMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [frameMenuOpen]);

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, [
    "prompt",
    "text",
    "视频提示词",
    "用户提示词",
  ]);
  const inputReferences = React.useMemo(
    () =>
      references && references.length > 0
        ? references
        : getVideoNodeInputReferences(resolvedInputs),
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
  const canRunVideoPrompt = Boolean(
    upstreamPrompt || promptText.trim() || inputReferences.length > 0
  );
  const videoUrl = (node.data?.videoUrl as string) || (node.properties.videoUrl as string) || "";
  const loadingOperation = node.data?.loadingOperation as MediaNodeLoadingOperation | undefined;
  const promptComposerVisible = shouldShowVideoPromptComposer({
    isExternalUploadSourceVideoNode: node.data?.externalUploadSource === true,
    isRunning,
    isSelected: selected,
    isUploadingAsset,
  });
  const rawAspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const rawResolution = (node.properties.resolution as string) || "480p";
  const activeResolutionGroup =
    resolutionPresetGroups?.find((group) => group.resolution === rawResolution) ??
    resolutionPresetGroups?.[0];
  const resolution = activeResolutionGroup?.resolution ?? rawResolution;
  const aspectRatio = activeResolutionGroup?.presets.some(
    (preset) => preset.aspectRatio === rawAspectRatio
  )
    ? rawAspectRatio
    : (activeResolutionGroup?.presets[0]?.aspectRatio ?? rawAspectRatio);
  const durationSeconds = normalizeVideoDurationSeconds(node.properties.duration);
  const durationSliderPercent = getVideoDurationSliderPercent(durationSeconds);
  const audioEnabled = node.properties.audio !== false;
  const isVideoMuted = muted || !audioEnabled;
  const videoModelOptionGroups = React.useMemo(
    () => getModelOptionGroups([], apiConfig?.remoteModelsByType?.[AI_MODEL_TYPES[2]] ?? []),
    [apiConfig?.remoteModelsByType]
  );
  const videoModelOptions = React.useMemo(
    () => [...videoModelOptionGroups.builtIn, ...videoModelOptionGroups.remote],
    [videoModelOptionGroups]
  );
  const preferredVideoModel = videoModelOptions[0] || "";
  const selectedVideoModel =
    typeof node.properties.model === "string" && node.properties.model.trim()
      ? node.properties.model.trim()
      : "";
  const currentModel = selectedVideoModel || preferredVideoModel;
  const nodeBadgeTitle =
    node.title === "视频节点" || node.title === "视频" ? "视频节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const playbackProgress = getVideoProgressPercent({
    currentTime,
    duration: mediaDuration,
  });
  const displayCurrentTime = getVideoControlDisplayTime({
    currentTime,
    duration: mediaDuration,
  });
  const progressStyle = {
    "--video-progress": `${playbackProgress}%`,
  } as React.CSSProperties;

  React.useEffect(() => {
    if (!promptComposerVisible) setExpandedPromptEditorOpen(false);
  }, [promptComposerVisible]);

  React.useEffect(() => {
    if (!expandedPromptEditorOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedPromptEditorOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [expandedPromptEditorOpen]);

  React.useEffect(() => {
    if (!resolutionPresetGroups?.length) return;
    if (rawResolution !== resolution) onUpdateProperty?.(node.id, "resolution", resolution);
    if (rawAspectRatio !== aspectRatio) onUpdateProperty?.(node.id, "aspect_ratio", aspectRatio);
  }, [
    aspectRatio,
    node.id,
    onUpdateProperty,
    rawAspectRatio,
    rawResolution,
    resolution,
    resolutionPresetGroups,
  ]);
  const resultVideoSize = React.useMemo(
    () =>
      fitVideoSize(
        naturalVideoSize,
        aspectRatio,
        EMPTY_NODE_FOOTPRINT_WIDTH,
        EMPTY_NODE_FOOTPRINT_HEIGHT
      ),
    [aspectRatio, naturalVideoSize]
  );
  const emptyVideoNodeSize = React.useMemo(
    () => resolveEmptyVideoNodeSize({ aspectRatio, resolution }),
    [aspectRatio, resolution]
  );
  const hasVideoPreview = shouldShowVideoPreview({
    hasVideoUrl: Boolean(videoUrl),
    isRunning,
    isUploadingAsset,
    loadingOperation,
  });
  const hasKnownVideoSize = Boolean(naturalVideoSize);
  const shouldUseEmptySize = shouldUseEmptyVideoNodeSize({
    hasVideoUrl: Boolean(videoUrl),
    isUploadingAsset,
    hasKnownVideoSize,
  });
  const visibleEmptyBranchSize = shouldUseEmptySize
    ? emptyVideoNodeSize
    : {
        displayHeight: resultVideoSize.height,
        displayWidth: resultVideoSize.width,
        nodeHeight: resultVideoSize.height,
        nodeWidth: resultVideoSize.width,
        portCenterY: Math.round(resultVideoSize.height / 2),
      };
  const shouldShowVideoLoadingOverlay = Boolean(isUploadingAsset || (isRunning && hasVideoPreview));
  const showVideoCustomControls = shouldShowVideoCustomControls({
    hasVideoPreview,
    isHovered: isVideoFrameHovered,
  });
  const portTopStyle = getVideoNodePortTopStyle({
    emptyVideoNodePortCenterY: visibleEmptyBranchSize.portCenterY,
    hasVideoPreview: hasVideoPreview || !shouldUseEmptySize,
    videoPortCenterY: node.data?.videoPortCenterY,
  });
  const naturalSizeLabel =
    naturalVideoSize && naturalVideoSize.width > 0 && naturalVideoSize.height > 0
      ? `${naturalVideoSize.width} × ${naturalVideoSize.height}`
      : `${resultVideoSize.width} × ${resultVideoSize.height}`;

  React.useEffect(() => {
    const width = node.data?.videoNaturalWidth;
    const height = node.data?.videoNaturalHeight;
    setNaturalVideoSize(
      typeof width === "number" && typeof height === "number" ? { width, height } : null
    );
  }, [node.data?.videoNaturalHeight, node.data?.videoNaturalWidth, videoUrl]);

  React.useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setMediaDuration(0);
    setFrameMenuOpen(false);
    videoRef.current?.load();
  }, [videoUrl]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideoPreview) return;

    if (!isVideoFrameHovered) {
      video.pause();
      setFrameMenuOpen(false);
      return;
    }

    void video.play().catch(() => undefined);
  }, [hasVideoPreview, isVideoFrameHovered, videoUrl]);

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
    if (!videoUrl || !previewNodeRef.current) return;

    const syncNodeBounds = () => {
      const nextWidth = Math.round(previewNodeRef.current?.offsetWidth ?? 0);
      const nextHeight = Math.round(previewNodeRef.current?.offsetHeight ?? 0);
      const nextPortCenterY = Math.round(
        (mediaFrameRef.current?.offsetTop ?? 0) + (mediaFrameRef.current?.offsetHeight ?? 0) / 2
      );
      if (
        nextWidth > 0 &&
        nextHeight > 0 &&
        (node.data?.videoNodeWidth !== nextWidth ||
          node.data?.videoNodeHeight !== nextHeight ||
          node.data?.videoPortCenterY !== nextPortCenterY)
      ) {
        onUpdateData?.(node.id, {
          videoNodeWidth: nextWidth,
          videoNodeHeight: nextHeight,
          videoPortCenterY: nextPortCenterY,
        });
      }
    };

    syncNodeBounds();
    const frame = window.requestAnimationFrame(syncNodeBounds);
    return () => window.cancelAnimationFrame(frame);
  }, [
    node.data?.videoNodeHeight,
    node.data?.videoNodeWidth,
    node.data?.videoPortCenterY,
    node.id,
    onUpdateData,
    resultVideoSize.height,
    resultVideoSize.width,
    videoUrl,
  ]);

  React.useEffect(() => {
    if (!shouldUseEmptySize) return;
    if (
      node.data?.videoDisplayWidth === emptyVideoNodeSize.displayWidth &&
      node.data?.videoDisplayHeight === emptyVideoNodeSize.displayHeight &&
      node.data?.videoNodeWidth === emptyVideoNodeSize.nodeWidth &&
      node.data?.videoNodeHeight === emptyVideoNodeSize.nodeHeight &&
      node.data?.videoPortCenterY === emptyVideoNodeSize.portCenterY
    ) {
      return;
    }

    onUpdateData?.(node.id, {
      videoDisplayHeight: emptyVideoNodeSize.displayHeight,
      videoDisplayWidth: emptyVideoNodeSize.displayWidth,
      videoNodeHeight: emptyVideoNodeSize.nodeHeight,
      videoNodeWidth: emptyVideoNodeSize.nodeWidth,
      videoPortCenterY: emptyVideoNodeSize.portCenterY,
    });
  }, [
    emptyVideoNodeSize.displayHeight,
    emptyVideoNodeSize.displayWidth,
    emptyVideoNodeSize.nodeHeight,
    emptyVideoNodeSize.nodeWidth,
    emptyVideoNodeSize.portCenterY,
    node.data?.videoDisplayHeight,
    node.data?.videoDisplayWidth,
    node.data?.videoNodeHeight,
    node.data?.videoNodeWidth,
    node.data?.videoPortCenterY,
    node.id,
    onUpdateData,
    shouldUseEmptySize,
  ]);

  React.useEffect(() => {
    if (!selected) setModelMenuOpen(false);
  }, [selected]);

  const handleRun = () => {
    if (isRunning) return;
    setModelMenuOpen(false);
    onRun?.(node.id);
  };

  const handlePromptChange = (value: string) => {
    onUpdateProperty?.(node.id, "text", value);
  };

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
            {expandedPromptEditorOpen && promptComposerVisible && (
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
                    <div
                      className={`mx-5 mt-4 shrink-0 rounded-2xl border border-white/8 bg-[#20293a]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                        hasNonTextInputReferences ? "ring-1 ring-violet-200/10" : ""
                      }`}
                    >
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
                          : "描述你想要生成的视频内容"
                      }
                      className="h-full min-h-0 overflow-y-auto pr-3 text-[16px] leading-8 custom-scrollbar"
                    />
                  </div>

                  <div className="flex h-[76px] shrink-0 flex-nowrap items-center gap-3 border-t border-violet-100/10 px-5">
                    <div className="relative min-w-0 flex-[1_1_190px]" ref={modelMenuRef}>
                      <button
                        type="button"
                        data-node-action="true"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
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
                        <Video className="h-4 w-4 shrink-0 text-violet-200/58" />
                        <span className="min-w-0 flex-1 truncate text-left">{currentModel}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-300/56 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                    <ImageResolutionPicker
                      resolution={resolution}
                      aspectRatio={aspectRatio}
                      panelLayerClassName="z-[240]"
                      panelTitle="Video Size"
                      presetGroups={resolutionPresetGroups}
                      triggerIcon={Video}
                      onChange={(nextResolution, nextAspectRatio) => {
                        onUpdateProperty?.(node.id, "resolution", nextResolution);
                        onUpdateProperty?.(node.id, "aspect_ratio", nextAspectRatio);
                        const nextNodeSizeData = resolveVideoNodeSizePresetData({
                          aspectRatio: nextAspectRatio,
                          hasVideoUrl: Boolean(videoUrl),
                          resolution: nextResolution,
                        });
                        if (nextNodeSizeData) onUpdateData?.(node.id, nextNodeSizeData);
                      }}
                      buttonClassName="relative inline-flex h-11 w-[286px] shrink-0 items-center justify-center gap-2 rounded-[15px] border border-slate-400/16 bg-slate-950/18 px-3 text-[14px] font-medium text-slate-200/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                    />
                    <div
                      data-node-action="true"
                      className="flex h-11 w-[178px] shrink-0 items-center gap-3 rounded-[15px] border border-slate-400/16 bg-slate-950/18 px-3 text-slate-200/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex w-10 shrink-0 items-baseline justify-end gap-0.5 tabular-nums">
                        <span className="text-[15px] font-semibold text-slate-100/86">
                          {durationSeconds}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400/68">s</span>
                      </div>
                      <input
                        type="range"
                        min={VIDEO_DURATION_MIN_SECONDS}
                        max={VIDEO_DURATION_MAX_SECONDS}
                        step={1}
                        value={durationSeconds}
                        aria-label="视频时长"
                        onChange={(event) => {
                          onUpdateProperty?.(node.id, "duration", `${event.currentTarget.value}s`);
                        }}
                        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700/70 accent-violet-200 outline-none transition"
                        style={{
                          background: `linear-gradient(90deg, rgba(207,250,254,0.88) ${durationSliderPercent}%, rgba(51,65,85,0.78) ${durationSliderPercent}%)`,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateProperty?.(node.id, "audio", !audioEnabled);
                      }}
                      className="inline-flex h-11 w-[98px] shrink-0 items-center justify-center rounded-[15px] border border-slate-400/16 bg-slate-950/18 px-3 text-[14px] font-medium text-slate-200/74 transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                    >
                      {audioEnabled ? "音频开" : "音频关"}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRun();
                      }}
                      disabled={isRunning || !canRunVideoPrompt}
                      className={`ml-auto flex h-11 w-14 shrink-0 items-center justify-center rounded-[16px] transition-all ${
                        isRunning || !canRunVideoPrompt
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
                              { label: "内置模型", models: videoModelOptionGroups.builtIn },
                              { label: "远程模型", models: videoModelOptionGroups.remote },
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
                                        <span className="min-w-0 flex-1 truncate">{model}</span>
                                        {isActive && (
                                          <Check className="h-3.5 w-3.5 text-violet-100" />
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  const seekTo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const uploadCapturedFrame = async (
    childNodeId: string,
    canvas: HTMLCanvasElement,
    mode: VideoFrameCaptureMode
  ) => {
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) {
            resolve(value);
          } else {
            reject(new Error("无法生成截帧图片文件"));
          }
        }, "image/png");
      });
      const file = new File([blob], `video-${mode}-frame-${Date.now()}.png`, {
        type: "image/png",
      });
      const asset = await uploadFileToOss(file);
      onCompleteVideoFrameImage?.(childNodeId, { url: asset.url, ossId: asset.ossId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "截帧图片上传失败";
      onFailVideoFrameImage?.(childNodeId, message);
    }
  };

  const waitForDrawableVideoFrame = async (video: HTMLVideoElement) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const cleanup = () => {
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("canplay", handleReady);
        window.clearTimeout(timeoutId);
      };
      const handleReady = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const timeoutId = window.setTimeout(handleReady, 800);
      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
    });
  };

  const seekVideoForCapture = async (sourceUrl: string, targetTime: number) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("error", handleError);
      };
      const handleLoadedMetadata = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error("视频加载失败，无法截帧"));
      };
      video.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
      video.addEventListener("error", handleError, { once: true });
      video.src = sourceUrl;
      video.load();
    });

    const safeDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const safeTargetTime = Math.min(targetTime, Math.max(0, safeDuration - 0.05));
    if (Math.abs(video.currentTime - safeTargetTime) >= 0.02) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener("seeked", handleSeeked);
          video.removeEventListener("error", handleError);
        };
        const handleSeeked = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error("视频定位失败，无法截帧"));
        };
        video.addEventListener("seeked", handleSeeked, { once: true });
        video.addEventListener("error", handleError, { once: true });
        video.currentTime = safeTargetTime;
      });
    }

    await waitForDrawableVideoFrame(video);
    return video;
  };

  const captureFrameTask = async ({
    childNodeId,
    mode,
    targetTime,
  }: {
    childNodeId: string | null;
    mode: VideoFrameCaptureMode;
    targetTime: number;
  }) => {
    const draw = async (captureVideo: HTMLVideoElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = captureVideo.videoWidth || resultVideoSize.width;
      canvas.height = captureVideo.videoHeight || resultVideoSize.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(captureVideo, 0, 0, canvas.width, canvas.height);
      const previewUrl = canvas.toDataURL("image/png");

      if (!childNodeId) {
        onUpdateData?.(node.id, { videoFrameUrl: previewUrl });
        return;
      }

      void uploadCapturedFrame(childNodeId, canvas, mode);
    };

    const captureSourceUrl = getVideoFrameCaptureSourceUrl(videoUrl);
    let captureVideo: HTMLVideoElement | null = null;
    try {
      captureVideo = await seekVideoForCapture(captureSourceUrl, targetTime);
      await draw(captureVideo);
    } catch (error) {
      if (childNodeId) {
        const message = error instanceof Error ? error.message : "截帧失败";
        onFailVideoFrameImage?.(childNodeId, message);
      }
    } finally {
      if (captureVideo) {
        captureVideo.removeAttribute("src");
        captureVideo.load();
      }
    }
  };

  const captureFrame = (mode: VideoFrameCaptureMode) => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;

    const placeholderWidth = video.videoWidth || naturalVideoSize?.width || resultVideoSize.width;
    const placeholderHeight =
      video.videoHeight || naturalVideoSize?.height || resultVideoSize.height;
    const childNodeId =
      onCreateVideoFrameImage?.(node.id, mode, {
        url: "",
        width: placeholderWidth,
        height: placeholderHeight,
      }) ?? null;
    const targetTime = getVideoFrameCaptureTime({
      currentTime: video.currentTime,
      duration: video.duration,
      mode,
    });

    captureQueueRef.current = captureQueueRef.current
      .catch(() => undefined)
      .then(() => captureFrameTask({ childNodeId, mode, targetTime }));
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const extension = extensionFromAssetUrl(videoUrl, "mp4");
    const filename = `${nodeBadgeTitle.replace(/\s+/g, "-") || "video-node"}-${Date.now()}.${extension}`;
    void downloadMediaAsset(videoUrl, filename);
  };

  const readLocalVideoMetadata = React.useCallback(
    (file: File) =>
      new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const width = video.videoWidth;
          const height = video.videoHeight;
          const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0;
          cleanup();
          if (width > 0 && height > 0) {
            resolve({ width, height, duration: durationSeconds });
          } else {
            reject(new Error("无法读取视频尺寸"));
          }
        };
        video.onerror = () => {
          cleanup();
          reject(new Error("无法读取视频尺寸"));
        };
        video.src = objectUrl;
      }),
    []
  );

  const handleUploadClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    uploadInputRef.current?.click();
  }, []);

  const handleVideoUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("video/")) return;

      setIsUploadingVideo(true);
      onUpdateData?.(node.id, {
        uploadingAsset: true,
        uploadedAssetName: file.name,
        status: "uploading",
        error: undefined,
      });

      try {
        const metadata = await readLocalVideoMetadata(file);
        const naturalSize = { width: metadata.width, height: metadata.height };
        const displaySize = fitVideoSize(
          naturalSize,
          aspectRatio,
          EMPTY_NODE_FOOTPRINT_WIDTH,
          EMPTY_NODE_FOOTPRINT_HEIGHT
        );
        const asset = await uploadFileToOss(file);

        setNaturalVideoSize(naturalSize);
        setCurrentTime(0);
        setMediaDuration(metadata.duration);
        onUpdateProperty?.(node.id, "videoUrl", asset.url);
        if (asset.ossId) onUpdateProperty?.(node.id, "ossId", asset.ossId);
        onUpdateProperty?.(node.id, "isSourceNode", true);
        onUpdateData?.(node.id, {
          videoUrl: asset.url,
          ossId: asset.ossId,
          videoNaturalWidth: naturalSize.width,
          videoNaturalHeight: naturalSize.height,
          videoDisplayWidth: displaySize.width,
          videoDisplayHeight: displaySize.height,
          videoDuration: metadata.duration,
          isSourceNode: true,
          uploadingAsset: false,
          status: "success",
          loading: false,
          error: undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "视频上传失败";
        onUpdateData?.(node.id, {
          uploadingAsset: false,
          status: "error",
          error: message,
        });
      } finally {
        setIsUploadingVideo(false);
      }
    },
    [
      aspectRatio,
      node.id,
      onUpdateData,
      onUpdateProperty,
      readLocalVideoMetadata,
      setCurrentTime,
      setIsUploadingVideo,
      setMediaDuration,
      setNaturalVideoSize,
    ]
  );

  const uploadControl = (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoUpload}
      />
      <button
        type="button"
        data-node-action="true"
        aria-label={videoUrl ? "上传替换视频" : "上传视频"}
        onClick={handleUploadClick}
        disabled={isRunning || isUploadingAsset || isUploadingVideo}
        className={mediaNodeToolbarUploadButtonClass}
      >
        {isUploadingAsset || isUploadingVideo ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <Upload className="h-[18px] w-[18px]" />
        )}
      </button>
    </>
  );

  const analyzeFrames = async () => {
    if (!videoUrl || isAnalyzingFrames) return;
    setIsAnalyzingFrames(true);
    try {
      const captures = await fetchVideoFrameCapture(videoUrl);
      if (captures.length === 0)
        throw new Error(
          "\u9010\u5e27\u5206\u6790\u63a5\u53e3\u672a\u8fd4\u56de\u53ef\u7528\u5e27\u6570\u636e"
        );
      await onAnalyzeVideo?.(node, captures);
      onUpdateData?.(node.id, {
        error: undefined,
      });
    } catch (error) {
      onUpdateData?.(node.id, {
        error: error instanceof Error ? error.message : "\u9010\u5e27\u5206\u6790\u5931\u8d25",
      });
    } finally {
      setIsAnalyzingFrames(false);
    }
  };

  const reverseVideoPrompt = async () => {
    if (!videoUrl || isReversingPrompt) return;
    setIsReversingPrompt(true);
    try {
      await onReverseVideoPrompt?.(node, videoUrl);
      onUpdateData?.(node.id, {
        error: undefined,
      });
    } catch (error) {
      onUpdateData?.(node.id, {
        error: error instanceof Error ? error.message : "视频反推提示词失败",
      });
    } finally {
      setIsReversingPrompt(false);
    }
  };

  const hasInputPorts = !isSourceAssetNode && node.inputs.length > 0;
  const portHandles = (
    <AnimatePresence>
      {!isRunning &&
        !isUploadingAsset &&
        shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
          <>
            {hasInputPorts && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute -left-11 z-10 -translate-y-1/2"
                style={{ top: portTopStyle }}
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
              className="absolute -right-11 z-10 -translate-y-1/2"
              style={{ top: portTopStyle }}
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

  const promptComposerControlsNode = (
    <div className="mt-3 flex flex-nowrap items-center gap-2 border-t border-cyan-100/8 pt-3">
      <div className="relative min-w-0 flex-[1_1_196px]" ref={modelMenuRef}>
        <button
          type="button"
          data-node-action="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
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
          <Video className="h-3.5 w-3.5 shrink-0 text-violet-200/58" />
          <span className="min-w-0 flex-1 truncate text-left">{currentModel}</span>
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
                    { label: "内置模型", models: videoModelOptionGroups.builtIn },
                    { label: "远程模型", models: videoModelOptionGroups.remote },
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
                              <span className="min-w-0 flex-1 truncate">{model}</span>
                              {isActive && <Check className="h-3.5 w-3.5 text-violet-100" />}
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
        panelTitle="Video Size"
        presetGroups={resolutionPresetGroups}
        triggerIcon={Video}
        onChange={(nextResolution, nextAspectRatio) => {
          onUpdateProperty?.(node.id, "resolution", nextResolution);
          onUpdateProperty?.(node.id, "aspect_ratio", nextAspectRatio);
          const nextNodeSizeData = resolveVideoNodeSizePresetData({
            aspectRatio: nextAspectRatio,
            hasVideoUrl: Boolean(videoUrl),
            resolution: nextResolution,
          });
          if (nextNodeSizeData) onUpdateData?.(node.id, nextNodeSizeData);
        }}
        buttonClassName="relative inline-flex h-10 w-[246px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-[13px] font-medium text-slate-200/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
      />
      <div
        data-node-action="true"
        className="flex h-10 w-[168px] shrink-0 items-center gap-3 rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-slate-200/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-10 shrink-0 items-baseline justify-end gap-0.5 tabular-nums">
          <span className="text-[14px] font-semibold text-slate-100/86">{durationSeconds}</span>
          <span className="text-[10px] font-medium text-slate-400/68">s</span>
        </div>
        <input
          type="range"
          min={VIDEO_DURATION_MIN_SECONDS}
          max={VIDEO_DURATION_MAX_SECONDS}
          step={1}
          value={durationSeconds}
          aria-label="视频时长"
          onChange={(event) => {
            onUpdateProperty?.(node.id, "duration", `${event.currentTarget.value}s`);
          }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700/70 accent-violet-200 outline-none transition"
          style={{
            background: `linear-gradient(90deg, rgba(207,250,254,0.88) ${durationSliderPercent}%, rgba(51,65,85,0.78) ${durationSliderPercent}%)`,
          }}
        />
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onUpdateProperty?.(node.id, "audio", !audioEnabled);
        }}
        className="inline-flex h-10 w-[86px] shrink-0 items-center justify-center rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-[13px] font-medium text-slate-200/74 transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
      >
        {audioEnabled ? "音频开" : "音频关"}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleRun();
        }}
        disabled={isRunning || !canRunVideoPrompt}
        className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-all ${
          isRunning || !canRunVideoPrompt
            ? "cursor-not-allowed border border-cyan-100/6 bg-slate-200/8 text-slate-200/28"
            : "bg-slate-100 text-[#111827] shadow-[0_14px_30px_-18px_rgba(226,232,240,0.72)] hover:bg-white"
        }`}
      >
        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </div>
  );

  const promptComposerNode = (
    <AnimatePresence>
      {promptComposerVisible && (
        <motion.div
          data-node-action="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
          }}
          className="relative node-card left-1/2 mt-5 w-[720px] -translate-x-1/2 rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-5 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
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
                upstreamPrompt ? "继续补充这些输入资源要如何参与生成" : "描述你想要生成的视频内容"
              }
              className="h-[92px] text-[15px] leading-7 custom-scrollbar"
            />
          </div>
          {promptComposerControlsNode}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (hasVideoPreview) {
    return (
      <motion.div
        className="absolute text-left"
        style={{ width: resultVideoSize.width }}
        ref={previewNodeRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
          style={{ width: resultVideoSize.width }}
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
                className={mediaNodeFloatingToolbarClass}
                style={{ scale: floatingCanvasUiScale, transformOrigin: "bottom center" }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {shouldShowUploadButton && (
                  <>
                    {uploadControl}
                    <div className={mediaNodeToolbarDividerClass} />
                  </>
                )}
                <Tooltip content="下载视频" position="top">
                  <button
                    type="button"
                    onClick={downloadVideo}
                    className={mediaNodeToolbarButtonClass}
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </Tooltip>
                <div className={mediaNodeToolbarDividerClass} />
                <Tooltip content="逐帧分析" position="top">
                  <button
                    type="button"
                    onClick={analyzeFrames}
                    disabled={isAnalyzingFrames}
                    className={`${mediaNodeToolbarButtonClass} disabled:cursor-wait disabled:text-cyan-200`}
                  >
                    {isAnalyzingFrames ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ScanSearch className="h-5 w-5" />
                    )}
                  </button>
                </Tooltip>
                <Tooltip content="反推提示词" position="top">
                  <button
                    type="button"
                    onClick={reverseVideoPrompt}
                    disabled={isReversingPrompt}
                    className={`${mediaNodeToolbarButtonClass} disabled:cursor-wait disabled:text-violet-200`}
                  >
                    {isReversingPrompt ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Wand2 className="h-5 w-5" />
                    )}
                  </button>
                </Tooltip>
                <div className={mediaNodeToolbarDividerClass} />
                <Tooltip content="全屏预览" position="top">
                  <button
                    type="button"
                    onClick={() => onPreview?.(videoUrl, "视频节点预览", node.id)}
                    className={mediaNodeToolbarButtonClass}
                  >
                    <Maximize2 className="h-5 w-5" />
                  </button>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mb-2 flex items-center justify-between gap-4 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
            {!detachedCanvasTitle && (
              <div className="flex min-w-0 items-center gap-1.5">
                <Video className="h-4 w-4 shrink-0 text-slate-300/72" />
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
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-400/72">
                {naturalSizeLabel}
              </span>
            )}
          </div>
          <div
            ref={mediaFrameRef}
            className={`relative overflow-hidden rounded-[8px] bg-black ${selected ? "shadow-[0_0_0_1.5px_rgba(192,132,252,0.58),0_0_0_6px_rgba(139,92,246,0.14),0_0_38px_rgba(109,40,217,0.18)]" : ""}`}
            style={{ width: resultVideoSize.width, height: resultVideoSize.height }}
            onMouseEnter={() => setIsVideoFrameHovered(true)}
            onMouseLeave={() => setIsVideoFrameHovered(false)}
          >
            <video
              key={videoUrl}
              ref={videoRef}
              src={videoUrl}
              preload={getVideoPreloadMode({
                hovered: isVideoFrameHovered,
                playing: isPlaying,
                selected,
              })}
              className="block h-full w-full object-contain"
              muted={isVideoMuted}
              playsInline
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                const naturalSize = {
                  width: video.videoWidth || resultVideoSize.width,
                  height: video.videoHeight || resultVideoSize.height,
                };
                const displaySize = fitVideoSize(
                  naturalSize,
                  aspectRatio,
                  EMPTY_NODE_FOOTPRINT_WIDTH,
                  EMPTY_NODE_FOOTPRINT_HEIGHT
                );
                setNaturalVideoSize(naturalSize);
                setMediaDuration(video.duration || 0);
                if (
                  node.data?.videoNaturalWidth !== naturalSize.width ||
                  node.data?.videoNaturalHeight !== naturalSize.height ||
                  node.data?.videoDisplayWidth !== displaySize.width ||
                  node.data?.videoDisplayHeight !== displaySize.height
                ) {
                  onUpdateData?.(node.id, {
                    videoNaturalWidth: naturalSize.width,
                    videoNaturalHeight: naturalSize.height,
                    videoDisplayWidth: displaySize.width,
                    videoDisplayHeight: displaySize.height,
                  });
                }
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onDurationChange={(e) => setMediaDuration(e.currentTarget.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              draggable={false}
            />
            {shouldShowVideoLoadingOverlay && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-[#050812]/20">
                <div className="absolute inset-0 animate-[video-node-light-breathe_1.9s_ease-in-out_infinite] bg-[radial-gradient(circle_at_38%_34%,rgba(125,211,252,0.16),transparent_34%),radial-gradient(circle_at_68%_62%,rgba(167,139,250,0.14),transparent_38%)]" />
                <div className="absolute inset-y-[-24%] left-[-52%] w-[44%] animate-[video-node-light-sweep_1.55s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(224,242,254,0.08)_18%,rgba(255,255,255,0.38)_48%,rgba(103,232,249,0.12)_68%,transparent)] blur-[1px]" />
                <div className="absolute inset-y-[-18%] left-[-46%] w-[24%] animate-[video-node-light-sweep_1.55s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)] [animation-delay:0.18s]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/60 to-transparent" />
                <div className="relative flex items-center gap-2 rounded-full border border-cyan-100/18 bg-[#08101d]/68 px-3 py-1.5 text-[12px] font-semibold text-cyan-50/88 shadow-[0_18px_46px_-24px_rgba(34,211,238,0.62),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-100 shadow-[0_0_14px_rgba(165,243,252,0.9)]" />
                  <span>
                    {getMediaNodeLoadingLabel({
                      isUploading: isUploadingAsset,
                      mediaType: "video",
                      operation: loadingOperation,
                    })}
                  </span>
                </div>
              </div>
            )}
            <AnimatePresence>
              {showVideoCustomControls && (
                <motion.div
                  data-node-action="true"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute inset-x-0 bottom-0 flex h-[52px] items-center gap-2.5 rounded-b-[8px] border-t border-white/[0.08] bg-[linear-gradient(180deg,rgba(3,7,18,0.42),rgba(3,7,18,0.88)_34%,rgba(3,7,18,0.96))] px-3 text-white shadow-[0_-20px_54px_-30px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-colors duration-200 group-hover:border-cyan-100/16"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-100/18 bg-cyan-100/[0.08] text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-cyan-100/34 hover:bg-cyan-100/[0.14] hover:text-white"
                    title={isPlaying ? "暂停" : "播放"}
                  >
                    {isPlaying ? (
                      <Pause className="h-[18px] w-[18px] fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />
                    )}
                  </button>
                  <span className="min-w-[72px] text-[12px] font-semibold tracking-[-0.01em] text-slate-100/92 tabular-nums">
                    {formatTime(displayCurrentTime)}
                    <span className="px-1 text-slate-500/80">/</span>
                    <span className="text-slate-300/72">{formatTime(mediaDuration)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(mediaDuration, 0.01)}
                    step={0.01}
                    value={Math.min(currentTime, Math.max(mediaDuration, 0.01))}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    className="video-node-range h-5 min-w-0 flex-1 cursor-pointer"
                    style={progressStyle}
                    aria-label="视频播放进度"
                  />
                  <button
                    type="button"
                    onClick={() => setMuted((value) => !value)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-200/82 transition hover:bg-white/[0.08] hover:text-white"
                    title={isVideoMuted ? "打开声音" : "静音"}
                  >
                    {isVideoMuted ? (
                      <VolumeX className="h-[18px] w-[18px]" />
                    ) : (
                      <Volume2 className="h-[18px] w-[18px]" />
                    )}
                  </button>
                  <div
                    className="relative"
                    data-video-frame-menu="true"
                    onMouseEnter={() => setFrameMenuOpen(true)}
                    onMouseLeave={() => setFrameMenuOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => captureFrame("current")}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                        frameMenuOpen
                          ? "bg-violet-300/[0.14] text-violet-50"
                          : "text-slate-200/82 hover:bg-white/[0.08] hover:text-white"
                      }`}
                      title="点击截取当前帧"
                    >
                      <Camera className="h-[18px] w-[18px]" />
                    </button>
                    <AnimatePresence>
                      {frameMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          className="absolute bottom-11 right-0 w-[150px] overflow-hidden rounded-[12px] border border-white/[0.1] bg-[#08111e]/92 p-1.5 text-[12px] font-semibold text-slate-100 shadow-[0_22px_54px_-20px_rgba(0,0,0,0.94),0_0_34px_rgba(139,92,246,0.13),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
                        >
                          <button
                            type="button"
                            className="block w-full rounded-[9px] px-3 py-2 text-left transition hover:bg-cyan-100/[0.09] hover:text-white"
                            onClick={() => captureFrame("first")}
                          >
                            截取首帧
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-[9px] px-3 py-2 text-left transition hover:bg-violet-100/[0.1] hover:text-white"
                            onClick={() => captureFrame("last")}
                          >
                            截取尾帧
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        {promptComposerNode}
        {expandedPromptEditorNode}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute text-left"
      style={{ width: visibleEmptyBranchSize.nodeWidth }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
          width: visibleEmptyBranchSize.nodeWidth,
          minHeight: visibleEmptyBranchSize.nodeHeight,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(129,140,248,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        {(isRunning || isUploadingAsset) && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
          </div>
        )}
        {portHandles}
        <AnimatePresence>
          {selected && shouldShowUploadButton && (
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
            <Video className="h-4 w-4 text-violet-100/58" />
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
          {isRunning || isUploadingAsset ? (
            <div
              className="flex flex-col items-center justify-center gap-5 text-slate-300/60"
              style={{ minHeight: Math.max(120, visibleEmptyBranchSize.nodeHeight - 52) }}
            >
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <div className="text-[13px] text-slate-100/80">
                  {getMediaNodeLoadingLabel({
                    isUploading: isUploadingAsset,
                    mediaType: "video",
                    operation: node.data?.loadingOperation,
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center"
              style={{ minHeight: Math.max(120, visibleEmptyBranchSize.nodeHeight - 52) }}
            >
              <div className="mb-8 flex h-[96px] w-[96px] items-center justify-center text-violet-100/58">
                <Video className="h-14 w-14" strokeWidth={1.55} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {promptComposerVisible && (
          <motion.div
            data-node-action="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(e);
            }}
            className="relative node-card left-1/2 mt-5 w-[720px] -translate-x-1/2 rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-5 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
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
                  upstreamPrompt ? "继续补充这些输入资源要如何参与生成" : "描述你想要生成的视频内容"
                }
                className="h-[92px] text-[15px] leading-7 custom-scrollbar"
              />
            </div>
            <div className="mt-3 flex flex-nowrap items-center gap-2 border-t border-cyan-100/8 pt-3">
              <div className="relative min-w-0 flex-[1_1_196px]" ref={modelMenuRef}>
                <button
                  type="button"
                  data-node-action="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
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
                  <Video className="h-3.5 w-3.5 shrink-0 text-violet-200/58" />
                  <span className="min-w-0 flex-1 truncate text-left">{currentModel}</span>
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
                            { label: "内置模型", models: videoModelOptionGroups.builtIn },
                            { label: "远程模型", models: videoModelOptionGroups.remote },
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
                                      <span className="min-w-0 flex-1 truncate">{model}</span>
                                      {isActive && (
                                        <Check className="h-3.5 w-3.5 text-violet-100" />
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
                panelTitle="Video Size"
                presetGroups={resolutionPresetGroups}
                triggerIcon={Video}
                onChange={(nextResolution, nextAspectRatio) => {
                  onUpdateProperty?.(node.id, "resolution", nextResolution);
                  onUpdateProperty?.(node.id, "aspect_ratio", nextAspectRatio);
                  const nextNodeSizeData = resolveVideoNodeSizePresetData({
                    aspectRatio: nextAspectRatio,
                    hasVideoUrl: Boolean(videoUrl),
                    resolution: nextResolution,
                  });
                  if (nextNodeSizeData) onUpdateData?.(node.id, nextNodeSizeData);
                }}
                buttonClassName="relative inline-flex h-10 w-[246px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-[13px] font-medium text-slate-200/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
              />
              <div
                data-node-action="true"
                className="flex h-10 w-[168px] shrink-0 items-center gap-3 rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-slate-200/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex w-10 shrink-0 items-baseline justify-end gap-0.5 tabular-nums">
                  <span className="text-[14px] font-semibold text-slate-100/86">
                    {durationSeconds}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400/68">s</span>
                </div>
                <input
                  type="range"
                  min={VIDEO_DURATION_MIN_SECONDS}
                  max={VIDEO_DURATION_MAX_SECONDS}
                  step={1}
                  value={durationSeconds}
                  aria-label="视频时长"
                  onChange={(event) => {
                    onUpdateProperty?.(node.id, "duration", `${event.currentTarget.value}s`);
                  }}
                  className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700/70 accent-violet-200 outline-none transition"
                  style={{
                    background: `linear-gradient(90deg, rgba(207,250,254,0.88) ${durationSliderPercent}%, rgba(51,65,85,0.78) ${durationSliderPercent}%)`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateProperty?.(node.id, "audio", !audioEnabled);
                }}
                className="inline-flex h-10 w-[86px] shrink-0 items-center justify-center rounded-[14px] border border-slate-400/16 bg-slate-950/18 px-3 text-[13px] font-medium text-slate-200/74 transition-colors hover:border-violet-200/22 hover:bg-violet-500/[0.08]"
              >
                {audioEnabled ? "音频开" : "音频关"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
                disabled={isRunning || !canRunVideoPrompt}
                className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-all ${
                  isRunning || !canRunVideoPrompt
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
  );
}

const VideoNodeCard = React.memo(
  VideoNodeCardImpl,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.detachedCanvasTitle === next.detachedCanvasTitle &&
    prev.canvasZoom === next.canvasZoom &&
    prev.apiConfig?.remoteModelsByType === next.apiConfig?.remoteModelsByType &&
    prev.resolvedInputs === next.resolvedInputs &&
    prev.references === next.references
);

export default VideoNodeCard;
