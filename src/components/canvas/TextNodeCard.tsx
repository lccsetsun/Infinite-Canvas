import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { GraphNode } from "../../types";
import { getNodeHeight, getNodeWidth } from "./geometry";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { getTextNodeViewState } from "../../utils/textNodeViewState";
import { getTextNodeInteractionState } from "../../utils/textNodeInteractionState";
import type { TextNodeReferenceItem } from "../../utils/textNodeReferences";
import {
  AI_MODEL_TYPES,
  getModelOptionGroups,
  type AiModelsByType,
} from "../../features/api/aiModelCatalog";
import {
  getFloatingMenuPosition,
  type FloatingMenuPosition,
} from "../../utils/floatingMenuPosition";
import { ReferencePreviewCard } from "./ReferencePreviewCard";
import { calculateTextNodeResize } from "../../utils/textNodeResize";
import { PromptTokenEditor, type PromptTokenEditorHandle } from "./PromptTokenEditor";
import { InlineNodePortHandle } from "./InlineNodePortHandle";

interface TextNodeCardProps {
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
  onUpdateData?: (nodeId: string, data: Partial<NonNullable<GraphNode["data"]>>) => void;
  onPreview?: (
    content: string,
    title?: string,
    nodeId?: string,
    items?: string[],
    currentIndex?: number
  ) => void;
  resolvedInputs?: Record<string, unknown>;
  references?: TextNodeReferenceItem[];
  hasConnectedLinks?: boolean;
  onRun?: (nodeId: string) => void;
  // 连线相关
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

const DEFAULT_TEXT_REMOTE_MODEL = "qwen3.7-plus";
const LEGACY_TEXT_REMOTE_DEFAULT_MODEL = "qwen3.6-plus";
const TEXT_NODE_MIN_WIDTH = 360;
const TEXT_NODE_MIN_HEIGHT = 250;
const TEXT_NODE_MAX_WIDTH = 860;
const TEXT_NODE_MAX_HEIGHT = 760;

function renderMarkdown(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function looksLikeImageAsset(value: string) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(normalized) ||
    normalized.includes("image") ||
    normalized.includes("oss-") ||
    normalized.includes("blob:")
  );
}

function stripReasoningBlocks(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function TextSkeleton({ active: _active }: { active: boolean }) {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="relative flex h-[96px] w-[96px] items-center justify-center text-cyan-100/58">
        <FileText className="h-14 w-14" strokeWidth={1.55} />
      </div>
    </div>
  );
}

function isPointerOnVerticalScrollbar(event: React.PointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  if (target.scrollHeight <= target.clientHeight) return false;
  const scrollbarWidth = Math.max(10, target.offsetWidth - target.clientWidth);
  const rect = target.getBoundingClientRect();
  return event.clientX >= rect.right - scrollbarWidth - 2;
}

function TextNodeCardImpl({
  node,
  selected,
  apiConfig,
  onSelect,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
  onDragStart,
  onUpdateProperty,
  onUpdateData,
  onPreview,
  resolvedInputs,
  references = [],
  hasConnectedLinks = false,
  onRun,
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
}: TextNodeCardProps) {
  const isRunning = node.properties.status === "loading" || node.data?.loading === true;
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [outputMenuPos, setOutputMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [forceComposerOpen, setForceComposerOpen] = React.useState(false);
  const promptEditorRef = React.useRef<PromptTokenEditorHandle | null>(null);
  const inlineEditorRef = React.useRef<PromptTokenEditorHandle | null>(null);
  const responseEditorRef = React.useRef<PromptTokenEditorHandle | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [responseEditing, setResponseEditing] = React.useState(false);
  const [isResizingTextNode, setIsResizingTextNode] = React.useState(false);
  const [resizeDraftSize, setResizeDraftSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const inputPortRef = React.useRef<HTMLDivElement | null>(null);
  const outputPortRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuPortalRef = React.useRef<HTMLDivElement | null>(null);
  const [modelMenuPosition, setModelMenuPosition] = React.useState<FloatingMenuPosition | null>(
    null
  );
  const [inlineEditing, setInlineEditing] = React.useState(
    () => node.data?.forceInlineEditing === true
  );
  const [portMagnet, setPortMagnet] = React.useState({
    input: { x: 0, y: 0 },
    output: { x: 0, y: 0 },
  });

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, [
    "prompt",
    "user_prompt",
    "text",
    "原始提示词",
    "用户提示词",
  ]);
  const upstreamImageInput =
    upstreamPrompt && looksLikeImageAsset(upstreamPrompt.value) ? upstreamPrompt : null;
  const composerReferences = React.useMemo<TextNodeReferenceItem[]>(() => {
    const merged = [...references];
    if (
      upstreamImageInput?.value &&
      !merged.some((reference) => reference.value === upstreamImageInput.value)
    ) {
      merged.unshift({
        id: `${node.id}-inline-image-reference`,
        kind: "image",
        label: "Image",
        title: "上游图片",
        value: upstreamImageInput.value,
      });
    }
    return merged;
  }, [node.id, references, upstreamImageInput]);
  const upstreamTextPrompt = upstreamImageInput ? null : upstreamPrompt;
  const mentionableReferences = React.useMemo(
    () =>
      composerReferences.filter(
        (
          reference
        ): reference is TextNodeReferenceItem & { kind: "text" | "image" | "video" | "audio" } =>
          ["text", "image", "video", "audio"].includes(reference.kind)
      ),
    [composerReferences]
  );

  const promptText = (node.properties.text as string) || "";
  const displayPromptText = promptText || upstreamTextPrompt?.value || "";
  const canRunPrompt = Boolean(
    promptText.trim() || upstreamTextPrompt?.value.trim() || upstreamImageInput?.value.trim()
  );
  const rawResponseText =
    (node.data?.response as string) || (node.properties.response as string) || "";
  const responseText = stripReasoningBlocks(rawResponseText);
  const errorText = typeof node.data?.error === "string" ? node.data.error : "";
  const composerReferenceImages = composerReferences.filter(
    (reference) => reference.kind === "image"
  );
  const isMultimodalMode = composerReferenceImages.length > 0;
  const interactionState = getTextNodeInteractionState({
    errorText,
    forceComposerOpen,
    hasConnectedLinks,
    hasReferences: composerReferences.length > 0,
    inlineEditing,
    isHovered,
    isMultimodalMode,
    isRunning,
    responseText,
    selected,
    textMode: node.properties.textMode,
  });
  const { isPlainMode, showInlineEditor, showPromptComposer, showSkeleton, showStarterGuide } =
    interactionState;
  const hasInputPorts = node.inputs.length > 0;
  const inputPortIndex = Math.max(
    0,
    node.inputs.findIndex((input) => input.name === "user_prompt")
  );
  const modelOptionGroups = React.useMemo(
    () => getModelOptionGroups([], apiConfig?.remoteModelsByType?.[AI_MODEL_TYPES[0]] ?? []),
    [apiConfig?.remoteModelsByType]
  );
  const modelOptions = React.useMemo(
    () => [...modelOptionGroups.builtIn, ...modelOptionGroups.remote],
    [modelOptionGroups]
  );
  const selectedModel = typeof node.properties.model === "string" ? node.properties.model : "";
  const hasPreferredTextModel = modelOptions.includes(DEFAULT_TEXT_REMOTE_MODEL);
  const currentModel =
    selectedModel &&
    modelOptions.includes(selectedModel) &&
    !(selectedModel === LEGACY_TEXT_REMOTE_DEFAULT_MODEL && hasPreferredTextModel)
      ? selectedModel
      : hasPreferredTextModel
        ? DEFAULT_TEXT_REMOTE_MODEL
        : modelOptions[0] || "";
  const viewState = getTextNodeViewState({
    errorText,
    isRunning,
    promptText: displayPromptText,
    responseText,
  });
  const contentViewKey = interactionState.contentViewKey || viewState.kind;
  const nodeWidth = getNodeWidth(node);
  const nodeHeight = getNodeHeight(node);
  const renderedNodeWidth = resizeDraftSize?.width ?? nodeWidth;
  const renderedNodeHeight = resizeDraftSize?.height ?? nodeHeight;
  const responseAreaMaxHeight = Math.max(132, renderedNodeHeight - 72);
  const nodeBadgeTitle = node.title === "文本" ? "文本节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const showPortHandles =
    !isRunning && shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected });
  const hasCompactContent = Boolean(responseText || errorText || isPlainMode);
  const promptComposerVisible =
    showPromptComposer && !responseEditing && !isResizingTextNode && !isRunning;

  React.useEffect(() => {
    if (!resizeDraftSize) return;
    if (nodeWidth === resizeDraftSize.width && nodeHeight === resizeDraftSize.height) {
      setResizeDraftSize(null);
    }
  }, [nodeHeight, nodeWidth, resizeDraftSize]);

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
  };

  const handleComposerPromptChange = (value: string) => {
    onUpdateProperty?.(node.id, "text", value);
  };

  const enterResponseEditMode = () => {
    if (!responseText) return;
    setForceComposerOpen(false);
    setOutputMenuPos(null);
    setResponseEditing(true);
    window.requestAnimationFrame(() => responseEditorRef.current?.focus());
  };

  const handleResponseTextChange = (value: string) => {
    onUpdateData?.(node.id, { response: value, status: "success" });
  };

  const enterInlineEditMode = () => {
    if (!isPlainMode || upstreamTextPrompt) return;
    setInlineEditing(true);
    window.requestAnimationFrame(() => inlineEditorRef.current?.focus());
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!responseText) return;
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setOutputMenuPos(null);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!responseText) return;
    setOutputMenuPos(null);
    onPreview?.(responseText, "文本节点输出", node.id);
  };

  const handleOutputContextMenu = (e: React.MouseEvent) => {
    if (responseEditing) return;
    if (!responseText) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(e);
    setOutputMenuPos({
      x: Math.min(e.clientX + 8, window.innerWidth - 156),
      y: Math.min(e.clientY + 8, window.innerHeight - 96),
    });
  };

  const applyTextNodeResizeSize = (size: { width: number; height: number }) => {
    const width = `${size.width}px`;
    const height = `${size.height}px`;
    const responseHeight = `${Math.max(132, size.height - 72)}px`;

    if (rootRef.current) {
      rootRef.current.style.width = width;
    }
    if (cardRef.current) {
      cardRef.current.style.width = width;
      cardRef.current.style.height = height;
      cardRef.current.style.setProperty("--text-node-response-height", responseHeight);
    }
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    setIsResizingTextNode(true);

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = renderedNodeWidth;
    const startHeight = renderedNodeHeight;
    const rect = cardRef.current?.getBoundingClientRect();
    const scale = rect?.width ? rect.width / startWidth : 1;
    let latestSize = { width: Math.round(startWidth), height: Math.round(startHeight) };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const previousCardTransition = cardRef.current?.style.transition ?? "";

    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    if (cardRef.current) {
      cardRef.current.style.transition = "none";
    }
    applyTextNodeResizeSize(latestSize);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      latestSize = calculateTextNodeResize(
        {
          startClientX: startX,
          startClientY: startY,
          currentClientX: moveEvent.clientX,
          currentClientY: moveEvent.clientY,
          startWidth,
          startHeight,
          scale,
        },
        {
          minWidth: TEXT_NODE_MIN_WIDTH,
          minHeight: TEXT_NODE_MIN_HEIGHT,
          maxWidth: TEXT_NODE_MAX_WIDTH,
          maxHeight: TEXT_NODE_MAX_HEIGHT,
        }
      );
      applyTextNodeResizeSize(latestSize);
    };

    const finishResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (cardRef.current) {
        cardRef.current.style.transition = previousCardTransition;
      }
      setResizeDraftSize(latestSize);
      onUpdateData?.(node.id, {
        textNodeWidth: latestSize.width,
        textNodeHeight: latestSize.height,
      });
      setIsResizingTextNode(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
  };

  React.useEffect(() => {
    if (!outputMenuPos) return;

    const closeMenu = () => setOutputMenuPos(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [outputMenuPos]);

  React.useEffect(() => {
    if (node.properties.model !== currentModel) {
      onUpdateProperty?.(node.id, "model", currentModel);
    }
  }, [currentModel, node.id, node.properties.model, onUpdateProperty]);

  React.useEffect(() => {
    if (!selected) {
      setForceComposerOpen(false);
      setInlineEditing(false);
      setResponseEditing(false);
    }
  }, [selected]);

  React.useEffect(() => {
    if (!isRunning) return;
    setForceComposerOpen(false);
    setInlineEditing(false);
    setModelMenuOpen(false);
    setOutputMenuPos(null);
    setResponseEditing(false);
  }, [isRunning]);

  React.useEffect(() => {
    if (node.data?.forceComposerOpen !== true) return;
    setForceComposerOpen(true);
    onUpdateData?.(node.id, { forceComposerOpen: false });
    window.requestAnimationFrame(() => promptEditorRef.current?.focus());
  }, [node.data?.forceComposerOpen, node.id, onUpdateData]);

  React.useEffect(() => {
    if (node.data?.forceInlineEditing !== true) return;
    setInlineEditing(true);
    onUpdateData?.(node.id, { forceInlineEditing: false });
    window.requestAnimationFrame(() => inlineEditorRef.current?.focus());
  }, [node.data?.forceInlineEditing, node.id, onUpdateData]);

  React.useEffect(() => {
    if (showInlineEditor) window.requestAnimationFrame(() => inlineEditorRef.current?.focus());
  }, [showInlineEditor]);

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

  const updatePortMagnet = (event: React.MouseEvent) => {
    const radius = 136;
    const maxOffset = 18;
    const calculateOffset = (element: HTMLDivElement | null) => {
      if (!element) return { x: 0, y: 0 };
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const sideZoneX = Math.abs(dx) <= 112;
      const sideZoneY = Math.abs(dy) <= 92;
      const distance =
        sideZoneX && sideZoneY ? Math.abs(dx) * 0.45 + Math.abs(dy) * 0.25 : Math.hypot(dx, dy);
      if (distance > radius) return { x: 0, y: 0 };
      const strength = 1 - distance / radius;
      return {
        x: Math.max(-maxOffset, Math.min(maxOffset, dx * strength * 0.45)),
        y: Math.max(-maxOffset, Math.min(maxOffset, dy * strength * 0.45)),
      };
    };
    setPortMagnet({
      input: calculateOffset(inputPortRef.current),
      output: calculateOffset(outputPortRef.current),
    });
  };

  const resetPortMagnet = () => {
    setIsHovered(false);
    setPortMagnet({ input: { x: 0, y: 0 }, output: { x: 0, y: 0 } });
  };

  return (
    <motion.div
      ref={rootRef}
      className="absolute text-left"
      style={{ width: renderedNodeWidth }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={updatePortMagnet}
      onMouseLeave={resetPortMagnet}
    >
      <motion.div
        ref={cardRef}
        onPointerDown={(e) => {
          if (e.button !== 0) {
            return;
          }

          const target = e.target as HTMLElement;
          if (
            !target.closest("[data-node-action='true']") &&
            !target.closest(
              "textarea,button,input,[contenteditable='true'],[role='textbox'],.ant-select"
            )
          ) {
            onDragStart(e, node);
          } else {
            e.stopPropagation();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest("[data-node-action='true']") ||
            target.closest(
              "textarea,button,input,[contenteditable='true'],[role='textbox'],.ant-select"
            )
          )
            return;
          e.stopPropagation();
          onSelect(e);
          if (responseText) {
            enterResponseEditMode();
          } else {
            enterInlineEditMode();
          }
        }}
        onContextMenu={handleOutputContextMenu}
        className={`group node-card relative rounded-[18px] border bg-[#121723]/88 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-all duration-300 cursor-grab active:cursor-grabbing ${
          selected
            ? "border-violet-300/26 -translate-y-[1px] shadow-[0_40px_100px_-34px_rgba(0,0,0,0.98),0_0_0_1px_rgba(196,181,253,0.2),0_0_0_7px_rgba(139,92,246,0.08),0_0_48px_rgba(109,40,217,0.18)]"
            : "border-[#2b3142]/90 hover:border-slate-300/35"
        }`}
        style={
          {
            width: renderedNodeWidth,
            height: renderedNodeHeight,
            minHeight: TEXT_NODE_MIN_HEIGHT,
            "--text-node-response-height": `${responseAreaMaxHeight}px`,
          } as React.CSSProperties
        }
      >
        <AnimatePresence>
          {selected && responseText && !responseEditing && !isRunning && (
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
              <button
                type="button"
                onClick={handlePreview}
                className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                title="全屏预览"
              >
                <Eye className="h-5 w-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
          </div>
        )}
        {/* Hover side icons */}
        {hasInputPorts && (
          <div
            className="absolute -left-11 top-1/2 z-10 -translate-y-1/2"
            onMouseEnter={() => setIsHovered(true)}
          >
            <InlineNodePortHandle
              handleRef={inputPortRef}
              role="input"
              nodeId={node.id}
              portIndex={inputPortIndex}
              active={Boolean(
                isLinkingOnCanvas && linkToNodeId === node.id && linkToInputIndex === inputPortIndex
              )}
              animate={{
                opacity: showPortHandles ? 1 : 0,
                scale: showPortHandles ? 1 : 0.72,
                x: portMagnet.input.x,
                y: portMagnet.input.y,
              }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onHoverCanvasLinkTarget={onHoverCanvasLinkTarget}
              onLeaveCanvasLinkTarget={onLeaveCanvasLinkTarget}
              onFinishCanvasLink={onFinishCanvasLink}
              inputIssue={getCanvasLinkTargetIssue?.(node.id, inputPortIndex)}
            />
          </div>
        )}
        <div
          className="absolute -right-11 top-1/2 z-10 -translate-y-1/2"
          onMouseEnter={() => setIsHovered(true)}
        >
          <InlineNodePortHandle
            handleRef={outputPortRef}
            role="output"
            nodeId={node.id}
            portIndex={0}
            active={Boolean(
              isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === 0
            )}
            animate={{
              opacity: showPortHandles ? 1 : 0,
              scale: showPortHandles ? 1 : 0.72,
              x: portMagnet.output.x,
              y: portMagnet.output.y,
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onBeginCanvasLink={onBeginCanvasLink}
          />
        </div>

        <div className="absolute -top-8 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
          <FileText className="h-4 w-4 text-cyan-100/58" />
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
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {outputMenuPos && responseText && (
                <motion.div
                  data-node-action="true"
                  initial={{ opacity: 0, scale: 0.96, y: 4, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.96, y: 4, filter: "blur(6px)" }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="fixed z-[120] min-w-[132px] overflow-hidden rounded-2xl border border-cyan-100/10 bg-[#111827]/92 p-1.5 shadow-[0_24px_60px_-26px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
                  style={{ left: outputMenuPos.x, top: outputMenuPos.y }}
                >
                  <button
                    data-node-action="true"
                    onClick={handleCopy}
                    className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-medium text-slate-200/82 transition-colors hover:bg-cyan-100/8 hover:text-cyan-50"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Copy className="h-4 w-4 text-cyan-100/58" />
                    )}
                    <span>{copied ? "已复制" : "复制内容"}</span>
                  </button>
                  <button
                    data-node-action="true"
                    onClick={handlePreview}
                    className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-medium text-slate-200/82 transition-colors hover:bg-cyan-100/8 hover:text-cyan-50"
                  >
                    <MessageSquareText className="h-4 w-4 text-cyan-100/58" />
                    <span>展开查看</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

        <div
          className={`relative flex h-full min-h-[250px] flex-col ${hasCompactContent ? "px-5 py-5" : "px-5 pb-5 pt-8"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div key={contentViewKey} className="flex flex-1 flex-col">
              <div
                className={`relative flex flex-1 flex-col overflow-hidden transition-colors ${
                  hasCompactContent ? "justify-start" : "justify-center rounded-[14px] px-4 py-3"
                }`}
              >
                <div
                  className={`relative flex flex-1 ${hasCompactContent ? "items-start" : "items-center"}`}
                >
                  {isRunning ? (
                    <div className="flex min-h-[210px] w-full flex-col items-center justify-center gap-5 text-slate-300/60">
                      <div className="w-[96px]">
                        <TextSkeleton active />
                      </div>
                      <div className="flex items-center gap-2 text-[13px] font-medium text-slate-100/80">
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-100/72" />
                        <span>正在请求大模型</span>
                      </div>
                    </div>
                  ) : viewState.kind === "error" ? (
                    <div className="flex items-start gap-3 text-[13px] leading-6 text-amber-100/86">
                      <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
                      <span className="line-clamp-6">{errorText}</span>
                    </div>
                  ) : responseText || responseEditing ? (
                    responseEditing ? (
                      <PromptTokenEditor
                        ref={responseEditorRef}
                        value={responseText}
                        onChange={handleResponseTextChange}
                        resources={[]}
                        onBlur={() => setResponseEditing(false)}
                        onEscape={() => setResponseEditing(false)}
                        className="custom-scrollbar w-full pr-2 text-[14px] leading-[1.78]"
                        style={{ height: "var(--text-node-response-height)" }}
                      />
                    ) : (
                      <div
                        data-canvas-passthrough="true"
                        role="button"
                        tabIndex={0}
                        className="custom-scrollbar w-full overflow-y-auto pr-2 text-[14px] leading-[1.78] text-slate-100/82 outline-none"
                        style={{ maxHeight: "var(--text-node-response-height)" }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          enterResponseEditMode();
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          enterResponseEditMode();
                        }}
                        onPointerDown={(e) => {
                          if (isPointerOnVerticalScrollbar(e)) e.stopPropagation();
                        }}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <div className="whitespace-pre-wrap">{renderMarkdown(responseText)}</div>
                      </div>
                    )
                  ) : showInlineEditor ? (
                    <PromptTokenEditor
                      ref={inlineEditorRef}
                      value={promptText}
                      resources={mentionableReferences}
                      onChange={(value) => onUpdateProperty?.(node.id, "text", value)}
                      onBlur={() => setInlineEditing(false)}
                      onEscape={() => setInlineEditing(false)}
                      placeholder="直接写下文本内容，完成后点击空白处退出编辑。"
                      className="custom-scrollbar min-h-[210px] w-full text-[15px] leading-7"
                    />
                  ) : isPlainMode ? (
                    <div
                      data-canvas-passthrough="true"
                      role="button"
                      tabIndex={0}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        enterInlineEditMode();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        enterInlineEditMode();
                      }}
                      className="custom-scrollbar min-h-[210px] w-full overflow-y-auto pr-2 text-[15px] leading-7 text-slate-100/82 outline-none"
                      onWheel={(event) => event.stopPropagation()}
                    >
                      {displayPromptText.trim() ? (
                        <div className="whitespace-pre-wrap">{displayPromptText}</div>
                      ) : (
                        <div className="flex h-full min-h-[210px] items-center justify-center text-[14px] text-slate-400/38">
                          双击输入文本内容
                        </div>
                      )}
                    </div>
                  ) : showStarterGuide ? (
                    <div className="flex min-h-[166px] w-full items-center justify-center px-1 py-1">
                      <div className="flex h-[116px] w-[116px] items-center justify-center text-cyan-100/58">
                        <FileText className="h-16 w-16" strokeWidth={1.55} />
                      </div>
                    </div>
                  ) : showSkeleton && isMultimodalMode ? (
                    <div className="flex min-h-[166px] w-full flex-1 items-center justify-center">
                      <div className="w-[96px]">
                        <TextSkeleton active={isRunning} />
                      </div>
                    </div>
                  ) : showSkeleton ? (
                    <div className="flex w-full justify-center">
                      <div className="w-[96px]">
                        <TextSkeleton active={isRunning} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        {!isRunning && (
          <button
            type="button"
            data-node-action="true"
            aria-label="调整文本节点大小"
            title="拖拽调整文本节点大小"
            onPointerDown={handleResizePointerDown}
            className={`absolute bottom-0 right-0 z-30 h-14 w-14 cursor-nwse-resize rounded-br-[18px] rounded-tl-[30px] text-slate-300/42 opacity-0 transition-all duration-200 hover:bg-[#0a1019]/62 hover:text-cyan-100/74 focus-visible:bg-[#0a1019]/72 focus-visible:text-cyan-100/78 focus-visible:opacity-100 group-hover:opacity-100 ${
              selected ? "opacity-100" : ""
            }`}
          >
            <span className="pointer-events-none absolute bottom-[17px] right-[14px] h-[2px] w-[14px] -rotate-45 rounded-full bg-current" />
            <span className="pointer-events-none absolute bottom-[22px] right-[20px] h-[2px] w-[11px] -rotate-45 rounded-full bg-current" />
          </button>
        )}
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
            className="relative node-card left-1/2 mt-5 w-[690px] -translate-x-1/2 overflow-visible rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-5 pb-3 pt-4 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
            {composerReferences.length > 0 && (
              <div className="mb-3 rounded-2xl border border-white/6 bg-[#0d1117]/46 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex flex-wrap items-center gap-2">
                  {composerReferences.map((reference, index) => (
                    <React.Fragment key={`${reference.id}-${reference.value}-${index}`}>
                      <ReferencePreviewCard reference={reference} index={index} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            <div className="relative">
              <PromptTokenEditor
                ref={promptEditorRef}
                value={promptText}
                resources={mentionableReferences}
                onChange={handleComposerPromptChange}
                placeholder={
                  upstreamTextPrompt
                    ? "输入你想如何处理上游内容，例如：总结、改写或回答它。"
                    : upstreamImageInput
                      ? "根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言与风格关键词。"
                      : "写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看着星星。"
                }
                className="h-[88px] text-[15px] leading-7 custom-scrollbar"
              />
            </div>
            <div className="relative mt-3 flex flex-nowrap items-center gap-2 border-t border-slate-200/8 pt-3">
              <div className="min-w-0 flex-[1_1_230px]">
                <div className="relative" ref={modelMenuRef}>
                  <button
                    type="button"
                    data-node-action="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
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
                    className="flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200/10 bg-[#0d1117]/42 px-3 text-[13px] font-medium text-slate-100/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-slate-200/16 hover:bg-[#101723]/64"
                  >
                    <span className="min-w-0 flex-1 truncate text-left text-slate-300/72">
                      {currentModel}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-slate-300/56 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}
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
                          className="fixed z-[160] overflow-y-auto rounded-2xl border border-slate-400/16 bg-[#121923]/96 p-1.5 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar"
                          style={{
                            left: modelMenuPosition.left,
                            maxHeight: modelMenuPosition.maxHeight,
                            top: modelMenuPosition.top,
                            bottom: modelMenuPosition.bottom,
                            width: modelMenuPosition.width,
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {[
                            { label: "内置模型", models: modelOptionGroups.builtIn },
                            { label: "远程模型", models: modelOptionGroups.remote },
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
                                      className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-[13px] font-medium transition-colors ${
                                        isActive
                                          ? "bg-violet-500/[0.12] text-violet-50"
                                          : "text-slate-200/82 hover:bg-white/[0.05] hover:text-white"
                                      }`}
                                    >
                                      <span className="truncate">{model}</span>
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
                disabled={isRunning || !canRunPrompt}
                className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all ${
                  isRunning || !canRunPrompt
                    ? "bg-slate-200/8 text-slate-200/28 cursor-not-allowed"
                    : "bg-slate-100 text-[#111827] shadow-[0_12px_28px_-16px_rgba(226,232,240,0.8)] hover:bg-white"
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

const TextNodeCard = React.memo(
  TextNodeCardImpl,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.apiConfig?.remoteModelsByType === next.apiConfig?.remoteModelsByType
);

export default TextNodeCard;
