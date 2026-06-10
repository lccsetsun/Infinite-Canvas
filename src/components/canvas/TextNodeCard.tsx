import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Cpu,
  Eye,
  FileText,
  Image,
  Loader2,
  MessageSquareText,
  Music4,
  Plus,
  SquarePen,
  Wand2,
} from "lucide-react";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { TEXT_NODE_MODEL } from "../../features/nodes/nodeExecutors";
import { getTextNodeViewState } from "../../utils/textNodeViewState";
import { getTextNodeInteractionState } from "../../utils/textNodeInteractionState";
import type { TextNodeReferenceItem } from "../../utils/textNodeReferences";
import { PROVIDER_PRESETS } from "../../features/api/apiSettings";
import { ReferencePreviewCard } from "./ReferencePreviewCard";
import { insertMentionLabel, shouldShowMentionMenu } from "../../utils/inputResourceMentions";
import { InputResourceMentionMenu } from "./InputResourceMentionMenu";

interface TextNodeCardProps {
  node: GraphNode;
  selected: boolean;
  apiConfig?: {
    providerModels?: Partial<Record<string, string>>;
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
  onReverseSegmentAnalysis?: (node: GraphNode) => Promise<void> | void;
  resolvedInputs?: Record<string, unknown>;
  references?: TextNodeReferenceItem[];
  hasConnectedLinks?: boolean;
  onRun?: (nodeId: string) => void;
  onCreateImagePromptStarter?: (nodeId: string) => void;
  onCreateTextStarterFlow?: (nodeId: string, action: "video" | "music") => void;
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

type StarterAction = "write" | "video" | "image-prompt" | "music";

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

function TextSkeleton({ active }: { active: boolean }) {
  return (
    <div className="flex w-full items-center justify-center">
      <div
        className={`relative flex h-[96px] w-[96px] items-center justify-center overflow-hidden text-cyan-100/58 ${
          active ? "animate-[text-node-skeleton-glow_2.8s_ease-in-out_infinite]" : ""
        }`}
      >
        <FileText className="h-14 w-14" strokeWidth={1.55} />
        {active && (
          <span className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.7s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-100/16 to-transparent" />
        )}
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
  onUpdateData: _onUpdateData,
  onPreview,
  onReverseSegmentAnalysis,
  resolvedInputs,
  references = [],
  hasConnectedLinks = false,
  onRun,
  onCreateImagePromptStarter,
  onCreateTextStarterFlow,
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
  const deepseekTextModels = PROVIDER_PRESETS.deepseek.models;
  const minimaxMultimodalModels = ["MiniMax-M3"];
  const starterActions = React.useMemo<
    Array<{ icon: typeof SquarePen; label: string; action: StarterAction }>
  >(
    () => [
      { icon: SquarePen, label: "自己编写内容", action: "write" },
      { icon: Clapperboard, label: "文生视频", action: "video" },
      { icon: Image, label: "图片反推提示词", action: "image-prompt" },
      { icon: Music4, label: "文字生音乐", action: "music" },
    ],
    []
  );
  const isRunning = node.properties.status === "loading" || node.data?.loading === true;
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isReversingSegments, setIsReversingSegments] = React.useState(false);
  const [outputMenuPos, setOutputMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [forceComposerOpen, setForceComposerOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const inlineTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [mentionMenuOpen, setMentionMenuOpen] = React.useState(false);
  const inputPortRef = React.useRef<HTMLDivElement | null>(null);
  const outputPortRef = React.useRef<HTMLDivElement | null>(null);
  const modelMenuRef = React.useRef<HTMLDivElement | null>(null);
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
  const modelOptions = isMultimodalMode ? minimaxMultimodalModels : deepseekTextModels;
  const providerLabel = isMultimodalMode ? "MiniMax" : "DeepSeek";
  const rawPreferredProviderModel = isMultimodalMode
    ? apiConfig?.providerModels?.minimax || minimaxMultimodalModels[0]
    : apiConfig?.providerModels?.deepseek || deepseekTextModels[0];
  const preferredProviderModel = modelOptions.includes(rawPreferredProviderModel)
    ? rawPreferredProviderModel
    : modelOptions[0];
  const currentModel =
    typeof node.properties.model === "string" && modelOptions.includes(node.properties.model)
      ? node.properties.model
      : preferredProviderModel;
  const viewState = getTextNodeViewState({
    errorText,
    isRunning,
    promptText: displayPromptText,
    responseText,
  });
  const contentViewKey = interactionState.contentViewKey || viewState.kind;
  const nodeBadgeTitle = node.title === "文本" ? "文本节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const showPortHandles = shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected });
  const hasCompactContent = Boolean(responseText || errorText || isPlainMode);
  const canReverseSegments =
    node.properties.isFullVideoAnalysisText === true &&
    typeof node.properties.frameAnalysisVideoUrl === "string" &&
    Array.isArray(node.properties.frameAnalysisSegments) &&
    node.properties.frameAnalysisSegments.length > 0;

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
  };

  const handleComposerPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateProperty?.(node.id, "text", event.target.value);
    setMentionMenuOpen(
      mentionableReferences.length > 0 &&
        shouldShowMentionMenu(event.target.value, event.target.selectionStart)
    );
  };

  const insertResourceMention = (label: string) => {
    const cursorIndex = textareaRef.current?.selectionStart ?? promptText.length;
    const { nextCursorIndex, nextValue } = insertMentionLabel(promptText, cursorIndex, label);
    onUpdateProperty?.(node.id, "text", nextValue);
    setMentionMenuOpen(false);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursorIndex, nextCursorIndex);
    });
  };

  const focusComposer = () => {
    setForceComposerOpen(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleStarterAction = (action: StarterAction) => {
    if (action === "write") {
      onUpdateProperty?.(node.id, "textMode", "plain");
      setForceComposerOpen(false);
      setInlineEditing(true);
      window.requestAnimationFrame(() => inlineTextareaRef.current?.focus());
      return;
    }
    if (action === "image-prompt") {
      onCreateImagePromptStarter?.(node.id);
      focusComposer();
      return;
    }
    onCreateTextStarterFlow?.(node.id, action);
    focusComposer();
  };

  const enterInlineEditMode = () => {
    if (!isPlainMode || upstreamTextPrompt) return;
    setInlineEditing(true);
    window.requestAnimationFrame(() => inlineTextareaRef.current?.focus());
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

  const handleReverseSegments = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canReverseSegments || isReversingSegments || !onReverseSegmentAnalysis) return;
    setIsReversingSegments(true);
    try {
      await onReverseSegmentAnalysis(node);
    } finally {
      setIsReversingSegments(false);
    }
  };

  const handleOutputContextMenu = (e: React.MouseEvent) => {
    if (!responseText) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(e);
    setOutputMenuPos({
      x: Math.min(e.clientX + 8, window.innerWidth - 156),
      y: Math.min(e.clientY + 8, window.innerHeight - 96),
    });
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
    }
  }, [selected]);

  React.useEffect(() => {
    if (node.data?.forceComposerOpen !== true) return;
    setForceComposerOpen(true);
    _onUpdateData?.(node.id, { forceComposerOpen: false });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [node.data?.forceComposerOpen, node.id, _onUpdateData]);

  React.useEffect(() => {
    if (node.data?.forceInlineEditing !== true) return;
    setInlineEditing(true);
    _onUpdateData?.(node.id, { forceInlineEditing: false });
    window.requestAnimationFrame(() => inlineTextareaRef.current?.focus());
  }, [node.data?.forceInlineEditing, node.id, _onUpdateData]);

  React.useEffect(() => {
    if (showInlineEditor) inlineTextareaRef.current?.focus();
  }, [showInlineEditor]);

  React.useEffect(() => {
    if (!modelMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (modelMenuRef.current && target && !modelMenuRef.current.contains(target)) {
        setModelMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
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
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="absolute text-left"
      style={{ width: getNodeWidth(node) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={updatePortMagnet}
      onMouseLeave={resetPortMagnet}
    >
      <motion.div
        onPointerDown={(e) => {
          if (e.button !== 0) {
            e.stopPropagation();
            return;
          }

          const target = e.target as HTMLElement;
          if (
            !target.closest("[data-node-action='true']") &&
            !target.closest("textarea,button,input,.ant-select")
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
            target.closest("textarea,button,input,.ant-select")
          )
            return;
          e.stopPropagation();
          onSelect(e);
          enterInlineEditMode();
        }}
        onContextMenu={handleOutputContextMenu}
        className={`group node-card relative rounded-[18px] border bg-[#121723]/88 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-all duration-300 cursor-grab active:cursor-grabbing ${
          selected
            ? "border-violet-300/26 -translate-y-[1px] shadow-[0_40px_100px_-34px_rgba(0,0,0,0.98),0_0_0_1px_rgba(196,181,253,0.2),0_0_0_7px_rgba(139,92,246,0.08),0_0_48px_rgba(109,40,217,0.18)]"
            : "border-[#2b3142]/90 hover:border-slate-300/35"
        }`}
        style={{ width: getNodeWidth(node), minHeight: 290 }}
      >
        <AnimatePresence>
          {selected && responseText && (
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
              {canReverseSegments && (
                <>
                  <div className="mx-1 h-7 w-px bg-slate-500/22" />
                  <button
                    type="button"
                    data-node-action="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      void handleReverseSegments(e);
                    }}
                    disabled={isReversingSegments}
                    className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-colors ${
                      isReversingSegments
                        ? "cursor-wait bg-cyan-100/10 text-cyan-100"
                        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                    }`}
                    title="反推分段分析"
                  >
                    {isReversingSegments ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Wand2 className="h-5 w-5" />
                    )}
                  </button>
                </>
              )}
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
            <motion.div
              ref={inputPortRef}
              role="button"
              tabIndex={-1}
              data-node-action="true"
              data-port-role="input"
              data-node-id={node.id}
              data-port-index={inputPortIndex}
              animate={{
                opacity: showPortHandles ? 1 : 0,
                scale: showPortHandles ? 1 : 0.72,
                x: portMagnet.input.x,
                y: portMagnet.input.y,
              }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 will-change-transform ${
                isLinkingOnCanvas && linkToNodeId === node.id && linkToInputIndex === inputPortIndex
                  ? "canvas-port-input canvas-port-hot scale-110"
                  : "canvas-port-input"
              }`}
              onPointerEnter={() => onHoverCanvasLinkTarget?.(node.id, inputPortIndex)}
              onPointerLeave={() => onLeaveCanvasLinkTarget?.(node.id, inputPortIndex)}
              onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onFinishCanvasLink?.(node.id, inputPortIndex);
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title={
                getCanvasLinkTargetIssue?.(node.id, inputPortIndex) || "输入端口: 点击此处完成连线"
              }
            >
              <Plus className="h-4 w-4 pointer-events-none" />
            </motion.div>
          </div>
        )}
        <div
          className="absolute -right-11 top-1/2 z-10 -translate-y-1/2"
          onMouseEnter={() => setIsHovered(true)}
        >
          <motion.div
            ref={outputPortRef}
            role="button"
            tabIndex={-1}
            data-node-action="true"
            data-port-role="output"
            data-node-id={node.id}
            data-port-index={0}
            animate={{
              opacity: showPortHandles ? 1 : 0,
              scale: showPortHandles ? 1 : 0.72,
              x: portMagnet.output.x,
              y: portMagnet.output.y,
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 will-change-transform ${
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
          </motion.div>
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
          className={`relative flex min-h-[250px] flex-col ${hasCompactContent ? "px-5 py-5" : "px-5 pb-5 pt-8"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={contentViewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-1 flex-col"
            >
              <div
                className={`relative flex flex-1 flex-col overflow-hidden transition-colors ${
                  hasCompactContent ? "justify-start" : "justify-center rounded-[14px] px-4 py-3"
                }`}
              >
                <div
                  className={`relative flex flex-1 ${hasCompactContent ? "items-start" : "items-center"}`}
                >
                  {viewState.kind === "error" ? (
                    <div className="flex items-start gap-3 text-[13px] leading-6 text-amber-100/86">
                      <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
                      <span className="line-clamp-6">{errorText}</span>
                    </div>
                  ) : responseText ? (
                    <div
                      data-canvas-passthrough="true"
                      className="custom-scrollbar max-h-[250px] w-full overflow-y-auto pr-2 text-[14px] leading-[1.78] text-slate-100/82"
                      onPointerDown={(e) => {
                        if (isPointerOnVerticalScrollbar(e)) e.stopPropagation();
                      }}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <div className="whitespace-pre-wrap">{renderMarkdown(responseText)}</div>
                    </div>
                  ) : showInlineEditor ? (
                    <textarea
                      ref={inlineTextareaRef}
                      data-node-action="true"
                      value={promptText}
                      onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
                      onBlur={() => setInlineEditing(false)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setInlineEditing(false);
                        }
                      }}
                      placeholder="直接写下文本内容，完成后点击空白处退出编辑。"
                      className="custom-scrollbar min-h-[210px] w-full resize-none bg-transparent text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/38"
                    />
                  ) : isPlainMode ? (
                    <div
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
                    <div className="flex min-h-[166px] w-full flex-col justify-between px-0.5 py-0.5">
                      <div className="flex justify-center pt-3">
                        <div className="w-[96px]">
                          <TextSkeleton active={isRunning} />
                        </div>
                      </div>
                      <div className="pb-0.5">
                        <div className="mb-1.5 text-[12px] font-medium tracking-tight text-slate-300/42">
                          尝试：
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {starterActions.map(({ icon: Icon, label, action }) => (
                            <div
                              key={label}
                              role="button"
                              tabIndex={0}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleStarterAction(action);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                event.stopPropagation();
                                handleStarterAction(action);
                              }}
                              className="group relative flex min-w-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-transparent px-2 py-1.5 text-slate-100/82 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300/18 hover:bg-violet-400/[0.075] hover:shadow-[0_12px_28px_-22px_rgba(139,92,246,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]"
                            >
                              <span className="pointer-events-none absolute inset-0 rounded-[10px] bg-[radial-gradient(circle_at_18%_20%,rgba(196,181,253,0.14),transparent_46%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                              <Icon className="relative h-[15px] w-[15px] shrink-0 text-violet-200/58 transition-all duration-200 group-hover:scale-110 group-hover:text-violet-100 group-hover:drop-shadow-[0_0_8px_rgba(167,139,250,0.55)]" />
                              <div className="relative truncate text-[12px] font-medium tracking-tight text-slate-100/82 transition-colors duration-200 group-hover:text-white">
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>
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
      </motion.div>

      <AnimatePresence>
        {showPromptComposer && (
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
            className="relative node-card left-1/2 mt-5 w-[690px] -translate-x-1/2 overflow-hidden rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-5 pb-3 pt-4 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
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
              <textarea
                ref={textareaRef}
                value={promptText}
                onChange={handleComposerPromptChange}
                onFocus={(event) =>
                  setMentionMenuOpen(
                    mentionableReferences.length > 0 &&
                      shouldShowMentionMenu(
                        event.currentTarget.value,
                        event.currentTarget.selectionStart
                      )
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMentionMenuOpen(false);
                }}
                placeholder={
                  upstreamTextPrompt
                    ? "输入你想如何处理上游内容，例如：总结、改写或回答它。"
                    : upstreamImageInput
                      ? "根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言与风格关键词。"
                      : "写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看着星星。"
                }
                className="relative h-[88px] w-full resize-none bg-transparent text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/42 custom-scrollbar"
              />
              {mentionMenuOpen && (
                <InputResourceMentionMenu
                  resources={mentionableReferences}
                  onPick={(label) => insertResourceMention(label)}
                />
              )}
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
                      setModelMenuOpen((open) => !open);
                    }}
                    className="flex h-9 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200/10 bg-[#0d1117]/42 px-3 text-[13px] font-medium text-slate-100/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-slate-200/16 hover:bg-[#101723]/64"
                  >
                    <Cpu
                      className={`h-3.5 w-3.5 ${isMultimodalMode ? "text-violet-200/56" : "text-slate-200/42"}`}
                    />
                    <span>{providerLabel}</span>
                    <span className="truncate text-slate-300/54">{currentModel}</span>
                    <span
                      className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                        isMultimodalMode
                          ? "border-violet-300/22 bg-violet-300/10 text-violet-100/76"
                          : "border-emerald-300/22 bg-emerald-300/10 text-emerald-100/76"
                      }`}
                    >
                      {isMultimodalMode ? "multi" : "text"}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-slate-300/56 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {modelMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="absolute left-0 top-[calc(100%+10px)] z-50 min-w-full overflow-hidden rounded-2xl border border-slate-400/16 bg-[#121923]/96 p-1.5 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/44">
                          {providerLabel}
                        </div>
                        {modelOptions.map((model) => {
                          const isActive = currentModel === model;
                          return (
                            <button
                              key={model}
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <input type="hidden" value={TEXT_NODE_MODEL} readOnly />
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
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default TextNodeCard;
