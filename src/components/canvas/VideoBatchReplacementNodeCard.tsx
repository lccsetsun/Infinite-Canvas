import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Image as ImageIcon, Loader2, Send, Upload, Wand2, X } from "lucide-react";
import type { GraphNode } from "../../types";
import { uploadFileToOss } from "../../features/resource/ossApi";
import { AI_MODEL_TYPES, type AiModelsByType } from "../../features/api/aiModelCatalog";
import {
  getImageResolutionPreset,
  type ImageAspectRatio,
  type ImageResolution,
  type ImageResolutionPresetGroup,
} from "../../features/nodes/imageResolutionPresets";
import {
  createVideoBatchReplacementSlots,
  DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS,
  type VideoBatchReplacementMode,
  type VideoBatchReplacementModeOption,
  type VideoBatchReplacementSlot,
  type VideoBatchReplacementSlotKey,
} from "../../utils/videoBatchReplacementLayout";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { InlineNodePortHandle } from "./InlineNodePortHandle";
import { ImageResolutionPicker } from "./ImageResolutionPicker";
import {
  getFloatingMenuPosition,
  type FloatingMenuPosition,
} from "../../utils/floatingMenuPosition";

interface VideoBatchReplacementNodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateData?: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onSubmit?: (
    nodeId: string,
    slots: VideoBatchReplacementSlot[],
    mode: VideoBatchReplacementMode
  ) => void | Promise<void>;
  apiConfig?: {
    remoteModelsByType?: AiModelsByType;
  };
  replacementModeOptions?: VideoBatchReplacementModeOption[];
  resolutionPresetGroups?: ImageResolutionPresetGroup[];
  highlightedSlotKey?: VideoBatchReplacementSlotKey | null;
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

function normalizeSlots(slots: unknown): VideoBatchReplacementSlot[] {
  const defaults = createVideoBatchReplacementSlots();
  if (!Array.isArray(slots)) return defaults;

  return defaults.map((fallback) => {
    const candidate = slots.find(
      (slot): slot is Partial<VideoBatchReplacementSlot> =>
        typeof slot === "object" &&
        slot !== null &&
        "key" in slot &&
        (slot as { key?: unknown }).key === fallback.key
    );
    return {
      ...fallback,
      ...candidate,
      key: fallback.key,
      title: fallback.title,
      placeholder: fallback.placeholder,
      imageUrl: typeof candidate?.imageUrl === "string" ? candidate.imageUrl : fallback.imageUrl,
      ossId: typeof candidate?.ossId === "string" ? candidate.ossId : fallback.ossId,
      prompt: typeof candidate?.prompt === "string" ? candidate.prompt : fallback.prompt,
    };
  });
}

export function getVideoBatchReplacementSlots(node: GraphNode): VideoBatchReplacementSlot[] {
  return normalizeSlots(node.data?.batchReplacementSlots);
}

export function getVideoBatchReplacementMode(node: GraphNode): VideoBatchReplacementMode {
  return node.data?.batchReplacementMode === "scene" ? "scene" : "product";
}

export function getVideoBatchReplacementModeLabel(
  mode: VideoBatchReplacementMode,
  options: VideoBatchReplacementModeOption[]
): string {
  return options.find((option) => option.value === mode)?.label ?? "产品替换";
}

export function getVideoBatchReplacementModelId(node: GraphNode): string {
  return typeof node.data?.batchReplacementModelId === "string"
    ? node.data.batchReplacementModelId.trim()
    : "";
}

export function getVideoBatchReplacementModelLabel(modelId: string): string {
  return modelId || "请选择图片模型";
}

export function getVideoBatchReplacementResolution(node: GraphNode): string {
  return typeof node.data?.batchReplacementResolution === "string"
    ? node.data.batchReplacementResolution
    : "";
}

export function getVideoBatchReplacementAspectRatio(node: GraphNode): string {
  return typeof node.data?.batchReplacementAspectRatio === "string"
    ? node.data.batchReplacementAspectRatio
    : "";
}

export function getVideoBatchReplacementCustomSize(
  node: GraphNode,
  presetGroups?: ImageResolutionPresetGroup[]
): string {
  const resolution = getVideoBatchReplacementResolution(node);
  const aspectRatio = getVideoBatchReplacementAspectRatio(node);
  if (!resolution || !aspectRatio) return "";
  const preset = getImageResolutionPreset(resolution, aspectRatio, presetGroups);
  return preset && preset.width > 0 && preset.height > 0 ? `${preset.width}x${preset.height}` : "";
}

export function updateVideoBatchReplacementMode(
  _node: GraphNode,
  mode: VideoBatchReplacementMode
): Pick<NonNullable<GraphNode["data"]>, "batchReplacementMode"> {
  return {
    batchReplacementMode: mode,
  };
}

export function updateVideoBatchReplacementModel(
  _node: GraphNode,
  modelId: string
): Pick<NonNullable<GraphNode["data"]>, "batchReplacementModelId"> {
  return {
    batchReplacementModelId: modelId,
  };
}

export function updateVideoBatchReplacementSize(
  _node: GraphNode,
  resolution: string,
  aspectRatio: string
): Pick<
  NonNullable<GraphNode["data"]>,
  "batchReplacementAspectRatio" | "batchReplacementResolution"
> {
  return {
    batchReplacementAspectRatio: aspectRatio,
    batchReplacementResolution: resolution,
  };
}

export function updateVideoBatchReplacementSlot(
  node: GraphNode,
  key: VideoBatchReplacementSlotKey,
  patch: Partial<Pick<VideoBatchReplacementSlot, "imageUrl" | "ossId" | "prompt">>
): Pick<NonNullable<GraphNode["data"]>, "batchReplacementSlots"> {
  return {
    batchReplacementSlots: getVideoBatchReplacementSlots(node).map((slot) =>
      slot.key === key ? { ...slot, ...patch } : slot
    ),
  };
}

export function canSubmitVideoBatchReplacement(
  slots: VideoBatchReplacementSlot[],
  isBusy: boolean,
  customSize: string,
  modelId: string
) {
  return (
    !isBusy &&
    customSize.trim().length > 0 &&
    modelId.trim().length > 0 &&
    slots.some((slot) => slot.imageUrl.trim().length > 0 && (slot.ossId ?? "").trim().length > 0)
  );
}

export function formatVideoBatchReplacementElapsedTime(elapsedMs: number): string {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const seconds = Math.max(1, Math.floor(safeElapsedMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function getVideoBatchReplacementSlotPlaceholder(
  slot: VideoBatchReplacementSlot,
  _mode: VideoBatchReplacementMode
) {
  return `请上传${slot.title}图`;
}

export function getVideoBatchReplacementElapsedLabel({
  finishedAt,
  isSubmitting,
  now,
  startedAt,
}: {
  finishedAt?: number;
  isSubmitting: boolean;
  now: number;
  startedAt?: number;
}) {
  if (typeof startedAt !== "number" || startedAt <= 0) return "";
  const endAt = typeof finishedAt === "number" && finishedAt >= startedAt ? finishedAt : now;
  if (!isSubmitting && typeof finishedAt !== "number") return "";
  return formatVideoBatchReplacementElapsedTime(endAt - startedAt);
}

function getDroppedImageUrl(event: React.DragEvent) {
  return (
    event.dataTransfer.getData("text/uri-list").trim() ||
    event.dataTransfer.getData("text/plain").trim()
  );
}

export default function VideoBatchReplacementNodeCard({
  node,
  selected,
  onSelect,
  onDelete,
  onDragStart,
  onUpdateData,
  onSubmit,
  apiConfig,
  replacementModeOptions,
  resolutionPresetGroups,
  highlightedSlotKey,
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
}: VideoBatchReplacementNodeCardProps) {
  const [uploadingKey, setUploadingKey] = React.useState<VideoBatchReplacementSlotKey | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const modeMenuRef = React.useRef<HTMLDivElement | null>(null);
  const modeMenuPortalRef = React.useRef<HTMLDivElement | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);
  const [modeMenuPosition, setModeMenuPosition] = React.useState<FloatingMenuPosition | null>(null);
  const modelMenuRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuPortalRef = React.useRef<HTMLDivElement | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [modelMenuPosition, setModelMenuPosition] = React.useState<FloatingMenuPosition | null>(
    null
  );
  const fileInputRefs = React.useRef<Record<VideoBatchReplacementSlotKey, HTMLInputElement | null>>(
    {
      back: null,
      front: null,
      side: null,
    }
  );
  const slots = getVideoBatchReplacementSlots(node);
  const replacementMode = getVideoBatchReplacementMode(node);
  const selectedModelId = getVideoBatchReplacementModelId(node);
  const selectedResolution = getVideoBatchReplacementResolution(node);
  const selectedAspectRatio = getVideoBatchReplacementAspectRatio(node);
  const customSize = getVideoBatchReplacementCustomSize(node, resolutionPresetGroups);
  const imageModelOptions = apiConfig?.remoteModelsByType?.[AI_MODEL_TYPES[1]] ?? [];
  const isSubmitting =
    node.data?.loading === true && node.data.loadingOperation === "batch-replacement";
  const controlsDisabled = isSubmitting;
  const batchReplacementStartedAt =
    typeof node.data?.batchReplacementStartedAt === "number"
      ? node.data.batchReplacementStartedAt
      : undefined;
  const batchReplacementFinishedAt =
    typeof node.data?.batchReplacementFinishedAt === "number"
      ? node.data.batchReplacementFinishedAt
      : undefined;
  const [elapsedNow, setElapsedNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!isSubmitting) return;
    setElapsedNow(Date.now());
    const timerId = window.setInterval(() => setElapsedNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [isSubmitting]);
  React.useEffect(() => {
    if (!modeMenuOpen) return;
    const updateModeMenuPosition = () => {
      const rect = modeMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setModeMenuPosition(
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
        modeMenuRef.current &&
        !modeMenuRef.current.contains(target) &&
        !modeMenuPortalRef.current?.contains(target)
      ) {
        setModeMenuOpen(false);
        event.stopPropagation();
      }
    };
    const blockCanvasWheel = (event: WheelEvent) => {
      const target = event.target as Node | null;
      if (target && modeMenuPortalRef.current?.contains(target)) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModeMenuOpen(false);
    };
    updateModeMenuPosition();
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("wheel", blockCanvasWheel, { capture: true, passive: false });
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateModeMenuPosition);
    window.addEventListener("scroll", updateModeMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("wheel", blockCanvasWheel, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateModeMenuPosition);
      window.removeEventListener("scroll", updateModeMenuPosition, true);
    };
  }, [modeMenuOpen]);
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
        event.stopPropagation();
      }
    };
    const blockCanvasWheel = (event: WheelEvent) => {
      const target = event.target as Node | null;
      if (target && modelMenuPortalRef.current?.contains(target)) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelMenuOpen(false);
    };
    updateModelMenuPosition();
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("wheel", blockCanvasWheel, { capture: true, passive: false });
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateModelMenuPosition);
    window.addEventListener("scroll", updateModelMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("wheel", blockCanvasWheel, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateModelMenuPosition);
      window.removeEventListener("scroll", updateModelMenuPosition, true);
    };
  }, [modelMenuOpen]);
  React.useEffect(() => {
    if (controlsDisabled) {
      setModeMenuOpen(false);
      setModelMenuOpen(false);
    }
  }, [controlsDisabled]);
  const elapsedLabel = getVideoBatchReplacementElapsedLabel({
    finishedAt: batchReplacementFinishedAt,
    isSubmitting,
    now: elapsedNow,
    startedAt: batchReplacementStartedAt,
  });
  const modeOptions = replacementModeOptions?.length
    ? replacementModeOptions
    : DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS;
  const canSubmit = canSubmitVideoBatchReplacement(
    slots,
    uploadingKey !== null || isSubmitting,
    customSize,
    selectedModelId
  );

  const portHandles = (
    <AnimatePresence>
      {shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
        <>
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute -left-11 top-1/2 z-50 -translate-y-1/2"
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
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute -right-11 top-1/2 z-50 -translate-y-1/2"
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

  const writeSlotPatch = React.useCallback(
    (
      key: VideoBatchReplacementSlotKey,
      patch: Partial<Pick<VideoBatchReplacementSlot, "imageUrl" | "ossId" | "prompt">>
    ) => {
      onUpdateData?.(node.id, updateVideoBatchReplacementSlot(node, key, patch));
    },
    [node, onUpdateData]
  );

  const writeModePatch = React.useCallback(
    (mode: VideoBatchReplacementMode) => {
      onUpdateData?.(node.id, updateVideoBatchReplacementMode(node, mode));
      setModeMenuOpen(false);
    },
    [node, onUpdateData]
  );

  const writeModelPatch = React.useCallback(
    (modelId: string) => {
      onUpdateData?.(node.id, updateVideoBatchReplacementModel(node, modelId));
      setModelMenuOpen(false);
    },
    [node, onUpdateData]
  );

  const writeSizePatch = React.useCallback(
    (resolution: ImageResolution, aspectRatio: ImageAspectRatio) => {
      onUpdateData?.(node.id, updateVideoBatchReplacementSize(node, resolution, aspectRatio));
    },
    [node, onUpdateData]
  );

  const uploadFile = React.useCallback(
    async (key: VideoBatchReplacementSlotKey, file?: File | null) => {
      if (controlsDisabled) return;
      if (!file || !file.type.startsWith("image/")) return;
      setUploadingKey(key);
      try {
        const uploaded = await uploadFileToOss(file);
        writeSlotPatch(key, { imageUrl: uploaded.url, ossId: uploaded.ossId });
      } finally {
        setUploadingKey(null);
      }
    },
    [controlsDisabled, writeSlotPatch]
  );

  return (
    <div
      className="node-card relative w-[520px] cursor-grab rounded-[8px] border border-slate-500/20 bg-[#111722]/94 p-4 text-left shadow-[0_28px_70px_-30px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl active:cursor-grabbing"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (!target.closest("[data-node-action='true']")) onDragStart(event, node);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(event);
      }}
    >
      {portHandles}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ImageIcon className="h-4 w-4 shrink-0 text-cyan-100/70" />
          <span className="truncate text-[14px] font-semibold text-slate-100">批量替换</span>
        </div>
        <div className="flex items-center gap-1.5" data-node-action="true">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-400/12 hover:text-rose-100"
            aria-label="删除批量替换节点"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        aria-disabled={controlsDisabled}
        className={controlsDisabled ? "pointer-events-none opacity-60" : undefined}
      >
        <div
          ref={modeMenuRef}
          className="relative mb-3 flex h-9 w-full items-center rounded-[7px] border border-slate-500/18 bg-slate-950/28 px-3 text-[12px] font-semibold text-slate-200 transition"
          data-node-action="true"
        >
          <button
            type="button"
            disabled={controlsDisabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (controlsDisabled) return;
              const rect = modeMenuRef.current?.getBoundingClientRect();
              if (rect) {
                setModeMenuPosition(
                  getFloatingMenuPosition({
                    anchorRect: rect,
                    viewportHeight: window.innerHeight,
                    viewportWidth: window.innerWidth,
                  })
                );
              }
              setModelMenuOpen(false);
              setModeMenuOpen((open) => !open);
            }}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 bg-transparent text-left text-[12px] font-semibold text-inherit outline-none disabled:cursor-not-allowed"
          >
            <span className="min-w-0 flex-1 truncate">
              {getVideoBatchReplacementModeLabel(replacementMode, modeOptions)}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-300/56 transition-transform ${
                modeMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {modeMenuOpen && modeMenuPosition && (
                <motion.div
                  ref={modeMenuPortalRef}
                  initial={{
                    opacity: 0,
                    y: modeMenuPosition.placement === "bottom" ? 8 : -8,
                    scale: 0.98,
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: modeMenuPosition.placement === "bottom" ? 8 : -8,
                    scale: 0.98,
                  }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="fixed z-[240] overflow-y-auto rounded-2xl border border-slate-400/16 bg-[#121923]/96 p-1.5 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar"
                  style={{
                    left: modeMenuPosition.left,
                    maxHeight: modeMenuPosition.maxHeight,
                    top: modeMenuPosition.top,
                    bottom: modeMenuPosition.bottom,
                    width: modeMenuPosition.width,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                >
                  {modeOptions.map((option) => {
                    const isActive = replacementMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => writeModePatch(option.value)}
                        className={`flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[13px] font-medium transition-colors ${
                          isActive
                            ? "bg-violet-500/[0.16] text-violet-50"
                            : "text-slate-200/82 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

        <ImageResolutionPicker
          resolution={selectedResolution}
          aspectRatio={selectedAspectRatio}
          onChange={writeSizePatch}
          disabled={controlsDisabled}
          buttonClassName={`mb-3 flex h-9 w-full items-center gap-2 rounded-[7px] border px-3 text-[12px] font-semibold transition ${
            customSize
              ? "border-slate-500/22 bg-slate-950/26 text-slate-200 hover:border-cyan-200/36 hover:text-cyan-50"
              : "border-amber-300/32 bg-amber-400/[0.08] text-amber-100"
          }`}
          panelTitle="Image Size"
          presetGroups={resolutionPresetGroups}
        />

        <div
          ref={modelMenuRef}
          className={`relative mb-3 flex h-9 w-full items-center gap-2 rounded-[7px] border px-3 text-[12px] font-semibold transition ${
            selectedModelId
              ? "border-slate-500/22 bg-slate-950/26 text-slate-200"
              : "border-amber-300/32 bg-amber-400/[0.08] text-amber-100"
          }`}
          data-node-action="true"
        >
          <Wand2 className="h-3.5 w-3.5 shrink-0 text-violet-200/58" />
          <button
            type="button"
            disabled={controlsDisabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (controlsDisabled) return;
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
              setModeMenuOpen(false);
              setModelMenuOpen((open) => !open);
            }}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 bg-transparent text-left text-[12px] font-semibold text-inherit outline-none disabled:cursor-not-allowed"
          >
            <span className="min-w-0 flex-1 truncate">
              {getVideoBatchReplacementModelLabel(selectedModelId)}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-300/56 transition-transform ${
                modelMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
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
                  {imageModelOptions.length === 0 ? (
                    <div className="px-3 py-2 text-[12px] font-medium text-slate-300/58">
                      暂无可用图片模型
                    </div>
                  ) : (
                    <div className="py-0.5">
                      <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/44">
                        远程模型
                      </div>
                      {imageModelOptions.map((model) => {
                        const isActive = selectedModelId === model.modelId;
                        return (
                          <button
                            key={model.modelId}
                            type="button"
                            onClick={() => writeModelPatch(model.modelId)}
                            className={`flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[13px] font-medium transition-colors ${
                              isActive
                                ? "bg-violet-500/[0.16] text-violet-50"
                                : "text-slate-200/82 hover:bg-white/[0.05] hover:text-white"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {getVideoBatchReplacementModelLabel(model.modelId)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot) => {
            const isHighlightedDropTarget = highlightedSlotKey === slot.key;
            return (
              <div
                key={slot.key}
                role="button"
                tabIndex={controlsDisabled ? -1 : 0}
                data-node-action="true"
                data-video-batch-node-id={node.id}
                data-video-batch-slot-key={slot.key}
                className={`group flex min-h-[196px] cursor-pointer flex-col overflow-hidden rounded-[8px] border border-dashed p-2.5 transition ${
                  isHighlightedDropTarget
                    ? "border-cyan-100/78 bg-cyan-300/[0.12] ring-2 ring-cyan-100/70 shadow-[0_0_30px_rgba(103,232,249,0.22)]"
                    : selected
                      ? "border-cyan-300/38 bg-cyan-300/[0.045]"
                      : "border-slate-500/28 bg-slate-950/24 hover:border-cyan-200/42 hover:bg-cyan-300/[0.04]"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (controlsDisabled) return;
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    void uploadFile(slot.key, file);
                    return;
                  }
                  const imageUrl = getDroppedImageUrl(event);
                  if (imageUrl) writeSlotPatch(slot.key, { imageUrl });
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (controlsDisabled) return;
                  if (isHighlightedDropTarget) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("button,input,textarea,[contenteditable='true']")) return;
                  fileInputRefs.current[slot.key]?.click();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (controlsDisabled) return;
                  fileInputRefs.current[slot.key]?.click();
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  disabled={controlsDisabled}
                  className="hidden"
                  ref={(element) => {
                    fileInputRefs.current[slot.key] = element;
                  }}
                  onChange={(event) => void uploadFile(slot.key, event.currentTarget.files?.[0])}
                />
                <div className="relative flex h-[112px] items-center justify-center overflow-hidden rounded-[6px] bg-black/28">
                  {slot.imageUrl ? (
                    <>
                      <img
                        src={slot.imageUrl}
                        alt={slot.title}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                      <button
                        type="button"
                        disabled={controlsDisabled}
                        aria-label="清空已上传图片"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/76 text-slate-200 shadow-[0_8px_18px_-10px_rgba(0,0,0,0.9)] transition hover:bg-rose-500/80 hover:text-white"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (controlsDisabled) return;
                          writeSlotPatch(slot.key, { imageUrl: "", ossId: "" });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-2 text-center text-[12px] font-medium leading-5 text-slate-300/78">
                      <Upload className="h-5 w-5 text-cyan-100/64" />
                      <span>
                        {uploadingKey === slot.key
                          ? "正在上传"
                          : getVideoBatchReplacementSlotPlaceholder(slot, replacementMode)}
                      </span>
                    </div>
                  )}
                  {uploadingKey === slot.key && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/72 text-[12px] font-semibold text-cyan-50">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>正在上传</span>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  data-node-action="true"
                  disabled={controlsDisabled}
                  value={slot.prompt}
                  onChange={(event) =>
                    writeSlotPatch(slot.key, { prompt: event.currentTarget.value })
                  }
                  className="mt-2 h-8 rounded-[6px] border border-slate-500/20 bg-slate-950/42 px-2 text-center text-[12px] font-semibold text-slate-100 outline-none transition focus:border-cyan-200/50"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        data-node-action="true"
        disabled={!canSubmit}
        onClick={() => {
          if (!canSubmit) return;
          void onSubmit?.(node.id, slots, replacementMode);
        }}
        className={`mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[7px] text-[13px] font-semibold transition ${
          canSubmit
            ? "bg-cyan-300/14 text-cyan-50 hover:bg-cyan-300/20"
            : "cursor-not-allowed bg-slate-700/22 text-slate-400/64"
        }`}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {isSubmitting ? "提交中" : "提交"}
      </button>
    </div>
  );
}
