import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, ChevronUp, Copy, Image as ImageIcon, Loader2, Maximize2, Plus, Wand2, X } from "lucide-react";
import { Tooltip } from "../common/Tooltip";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";

interface ImageNodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: unknown) => void;
  onPreview?: (content: string, title?: string, nodeId?: string, items?: string[], currentIndex?: number) => void;
  resolvedInputs?: Record<string, unknown>;
  onRun?: (nodeId: string) => void;
  // 连线相关
  isLinkingOnCanvas?: boolean;
  linkFromNodeId?: string | null;
  linkFromOutputIndex?: number | null;
  linkToNodeId?: string | null;
  linkToInputIndex?: number | null;
  onBeginCanvasLink?: (nodeId: string, outputIndex: number, clientX: number, clientY: number) => void;
  onFinishCanvasLink?: (nodeId?: string, inputIndex?: number) => void;
  onHoverCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  onLeaveCanvasLinkTarget?: (nodeId: string, inputIndex: number) => void;
  getCanvasLinkTargetIssue?: (nodeId: string, inputIndex: number) => string | null;
}

const RATIO_OPTIONS = [
  { value: "1:1", label: "1:1", icon: "square" },
  { value: "16:9", label: "16:9", icon: "landscape" },
  { value: "4:3", label: "4:3", icon: "landscape-soft" },
  { value: "3:2", label: "3:2", icon: "landscape-soft" },
  { value: "2:3", label: "2:3", icon: "portrait" },
  { value: "3:4", label: "3:4", icon: "portrait-soft" },
  { value: "9:16", label: "9:16", icon: "portrait" },
  { value: "21:9", label: "21:9", icon: "cinema" },
];
const QUANTITY_OPTIONS = ["1张", "2张", "3张", "4张"];

const MINIMAX_IMAGE_MODEL = "image-01";

const MINIMAX_RATIO_SIZE: Record<string, string> = {
  "1:1": "1024×1024",
  "16:9": "1280×720",
  "4:3": "1152×864",
  "3:2": "1248×832",
  "2:3": "832×1248",
  "3:4": "864×1152",
  "9:16": "720×1280",
  "21:9": "1344×576",
};

function RatioGlyph({ type, active = false }: { type: string; active?: boolean }) {
  const dims: Record<string, string> = {
    auto: "h-4 w-4",
    square: "h-4 w-4",
    portrait: "h-5 w-3",
    "portrait-soft": "h-[18px] w-3",
    landscape: "h-3 w-5",
    "landscape-soft": "h-3.5 w-[18px]",
    cinema: "h-2 w-6",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[4px] border ${
        dims[type] || dims.square
      } ${active ? "border-white/90 bg-white/10" : "border-slate-200/45 bg-slate-100/[0.03]"}`}
    />
  );
}

function ImageNodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onDragStart,
  onUpdateProperty,
  onPreview,
  resolvedInputs,
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
}: ImageNodeCardProps) {
  const isRunning = node.data?.loading === true;
  const [isHovered, setIsHovered] = React.useState(false);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = React.useState(false);
  const [isQuantityMenuOpen, setIsQuantityMenuOpen] = React.useState(false);
  const [sizeMenuPosition, setSizeMenuPosition] = React.useState({ left: 0, top: 0 });
  const [quantityMenuPosition, setQuantityMenuPosition] = React.useState({ left: 0, top: 0 });
  const sizeMenuRef = React.useRef<HTMLDivElement | null>(null);
  const sizeMenuPanelRef = React.useRef<HTMLDivElement | null>(null);
  const quantityMenuRef = React.useRef<HTMLDivElement | null>(null);
  const quantityMenuPanelRef = React.useRef<HTMLDivElement | null>(null);

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, ["prompt", "text", "原始提示词", "用户提示词"]);

  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
  const imageUrl = (node.data?.imageUrl as string) || (node.properties.imageUrl as string) || "";
  const aspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const quantity = (node.properties.quantity as string) || "1张";
  const promptOptimizer = node.properties.prompt_optimizer !== false;
  const nodeBadgeTitle = node.title === "图片节点" || node.title === "图片" ? "图片节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const currentRatio = RATIO_OPTIONS.find((option) => option.value === aspectRatio) || RATIO_OPTIONS[1];

  const updateSizeMenuPosition = React.useCallback(() => {
    const trigger = sizeMenuRef.current?.querySelector("button");
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = 500;
    const estimatedPanelHeight = 320;
    const gap = 10;
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - panelWidth - 12));
    const topAbove = rect.top - estimatedPanelHeight - gap;
    const top = topAbove > 12 ? topAbove : Math.min(rect.bottom + gap, window.innerHeight - estimatedPanelHeight - 12);

    setSizeMenuPosition({ left, top: Math.max(12, top) });
  }, []);

  const updateQuantityMenuPosition = React.useCallback(() => {
    const trigger = quantityMenuRef.current?.querySelector("button");
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = 180;
    const estimatedPanelHeight = 174;
    const gap = 10;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - panelWidth / 2), Math.max(12, window.innerWidth - panelWidth - 12));
    const topAbove = rect.top - estimatedPanelHeight - gap;
    const top = topAbove > 12 ? topAbove : Math.min(rect.bottom + gap, window.innerHeight - estimatedPanelHeight - 12);

    setQuantityMenuPosition({ left, top: Math.max(12, top) });
  }, []);

  React.useEffect(() => {
    if (!isSizeMenuOpen) return;
    updateSizeMenuPosition();

    const closeOnOutside = (event: PointerEvent) => {
      if (sizeMenuRef.current?.contains(event.target as Node)) return;
      if (sizeMenuPanelRef.current?.contains(event.target as Node)) return;
      setIsSizeMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSizeMenuOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutside, true);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateSizeMenuPosition);
    window.addEventListener("scroll", updateSizeMenuPosition, true);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutside, true);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateSizeMenuPosition);
      window.removeEventListener("scroll", updateSizeMenuPosition, true);
    };
  }, [isSizeMenuOpen, updateSizeMenuPosition]);

  React.useEffect(() => {
    if (!isQuantityMenuOpen) return;
    updateQuantityMenuPosition();

    const closeOnOutside = (event: PointerEvent) => {
      if (quantityMenuRef.current?.contains(event.target as Node)) return;
      if (quantityMenuPanelRef.current?.contains(event.target as Node)) return;
      setIsQuantityMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsQuantityMenuOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutside, true);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateQuantityMenuPosition);
    window.addEventListener("scroll", updateQuantityMenuPosition, true);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutside, true);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateQuantityMenuPosition);
      window.removeEventListener("scroll", updateQuantityMenuPosition, true);
    };
  }, [isQuantityMenuOpen, updateQuantityMenuPosition]);

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
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
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        onPointerDown={(e) => {
          if (e.button !== 0) {
            e.stopPropagation();
            return;
          }

          const target = e.target as HTMLElement;
          if (!target.closest("[data-node-action='true']") && !target.closest("textarea,button,input,.ant-select")) {
            onDragStart(e, node);
          } else {
            e.stopPropagation();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
        className={`group node-card relative rounded-[18px] border bg-[#121723]/88 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-all duration-300 cursor-grab active:cursor-grabbing ${
          selected ? "border-slate-200/50 ring-2 ring-cyan-200/10 shadow-[0_0_0_1px_rgba(148,163,184,0.12),0_30px_90px_-28px_rgba(56,189,248,0.34)]" : "border-[#2b3142]/90 hover:border-slate-300/35"
        }`}
        style={{ width: getNodeWidth(node), minHeight: 390 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
          </div>
        )}
        {/* Hover side icons */}
        <AnimatePresence>
          {shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
            <>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute -left-24 top-1/2 z-10 flex h-28 w-24 -translate-y-1/2 items-center justify-center"
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
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute -right-24 top-1/2 z-10 flex h-28 w-24 -translate-y-1/2 items-center justify-center"
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

        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip content="复制节点" position="top">
            <button
              data-node-action="true"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/8 bg-slate-950/18 text-cyan-100/46 backdrop-blur-md transition-all duration-200 hover:border-cyan-100/18 hover:bg-cyan-100/8 hover:text-cyan-50/92"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="删除节点" position="top">
            <button
              data-node-action="true"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/8 bg-slate-950/18 text-cyan-100/46 backdrop-blur-md transition-all duration-200 hover:border-rose-200/20 hover:bg-rose-500/10 hover:text-rose-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        <div className="relative px-5 pb-5 pt-8">
          <AnimatePresence mode="wait">
            {isRunning ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[350px] flex-col items-center justify-center gap-5 text-slate-300/60"
              >
                <Loader2 className="h-10 w-10 animate-spin" />
                <div className="text-center">
                  <div className="text-[13px] text-slate-100/80">正在绘制图片</div>
                  <div className="mt-2 text-[11px] text-slate-400/60">模型正在构建构图、风格和光线</div>
                </div>
              </motion.div>
            ) : imageUrl ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-slate-200/72">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                    <span className="text-[12px] uppercase tracking-[0.16em]">图片结果</span>
                  </div>
                  <button
                    data-node-action="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview?.(imageUrl, "图片节点输出", node.id);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/42 transition-colors hover:bg-white/8 hover:text-white/90"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="overflow-hidden rounded-[16px] border border-slate-200/10 bg-black/20 shadow-inner">
                  <img src={imageUrl} alt="生成图片" className="aspect-[16/9] w-full object-cover" />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex min-h-[350px] flex-col"
              >
                <div className="flex flex-1 flex-col items-center justify-center text-slate-300/18">
                  <ImageIcon className="mb-14 h-16 w-16" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {(isHovered || selected) && (
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
            className="relative node-card left-1/2 mt-5 w-[560px] -translate-x-1/2 rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-4 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
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

        <div className="mt-3 flex items-center gap-2 border-t border-cyan-100/8 pt-3">
          <div className="flex h-10 min-w-[172px] items-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
            <Wand2 className="h-3.5 w-3.5 text-cyan-100/50" />
            <span>MiniMax Image 01</span>
          </div>

          <div ref={sizeMenuRef} className="relative">
            <button
              data-node-action="true"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateSizeMenuPosition();
                setIsSizeMenuOpen((open) => !open);
              }}
              className={`inline-flex h-10 items-center gap-2 rounded-[14px] border px-3 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-all ${
                isSizeMenuOpen
                  ? "border-cyan-100/36 bg-cyan-100/[0.09] text-cyan-50 shadow-[0_12px_28px_-22px_rgba(34,211,238,0.78),inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-cyan-100/8 bg-slate-950/18 text-cyan-50/76 hover:border-cyan-100/18 hover:bg-cyan-100/[0.045] hover:text-cyan-50"
              }`}
            >
              <RatioGlyph type={currentRatio.icon} active={isSizeMenuOpen} />
              <span>{currentRatio.label} · {MINIMAX_RATIO_SIZE[currentRatio.value]}</span>
              <ChevronUp className={`h-3.5 w-3.5 text-slate-300/55 transition-transform ${isSizeMenuOpen ? "" : "rotate-180"}`} />
            </button>

            {createPortal(
              <AnimatePresence>
                {isSizeMenuOpen && (
                <motion.div
                  ref={sizeMenuPanelRef}
                  data-node-action="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  style={{ left: sizeMenuPosition.left, top: sizeMenuPosition.top }}
                  className="fixed z-[9999] w-[500px] overflow-hidden rounded-[20px] border border-[#334155]/85 bg-[#121723]/96 p-4 text-slate-200 shadow-[0_30px_90px_-24px_rgba(0,0,0,0.95),0_0_0_1px_rgba(34,211,238,0.05),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.11),transparent_36%),radial-gradient(circle_at_88%_8%,rgba(129,140,248,0.09),transparent_34%)]" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/24 to-transparent" />
                  <div className="relative flex items-center justify-between">
                    <div>
                      <div className="text-[15px] font-medium text-cyan-50/76">画幅比例</div>
                      <div className="mt-1 text-[11px] text-cyan-50/35">MiniMax 按比例自动匹配输出尺寸</div>
                    </div>
                    <div className="rounded-full border border-cyan-100/10 bg-slate-950/22 px-2.5 py-1 text-[11px] text-cyan-50/48">
                      {MINIMAX_IMAGE_MODEL}
                    </div>
                  </div>
                  <div className="relative mt-4 grid grid-cols-4 gap-3">
                    {RATIO_OPTIONS.map((option) => {
                      const active = aspectRatio === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateProperty?.(node.id, "aspect_ratio", option.value);
                          }}
                          className={`flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[12px] border transition-all ${
                            active
                              ? "border-cyan-100/70 bg-cyan-100/[0.095] text-cyan-50 shadow-[0_16px_35px_-26px_rgba(34,211,238,0.72)]"
                              : "border-cyan-100/10 bg-slate-950/18 text-cyan-50/46 hover:border-cyan-100/24 hover:bg-cyan-100/[0.055] hover:text-cyan-50/84"
                          }`}
                        >
                          <RatioGlyph type={option.icon} active={active} />
                          <span className="text-[14px] font-medium">{option.label}</span>
                          <span className="text-[10px] text-cyan-50/34">{MINIMAX_RATIO_SIZE[option.value]}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateProperty?.(node.id, "prompt_optimizer", !promptOptimizer);
            }}
            className={`inline-flex h-10 items-center gap-1.5 rounded-[14px] border px-3 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-all ${
              promptOptimizer
                ? "border-emerald-200/18 bg-emerald-300/[0.07] text-emerald-100/78 hover:bg-emerald-300/[0.1]"
                : "border-cyan-100/8 bg-slate-950/18 text-cyan-50/42 hover:border-cyan-100/18 hover:bg-cyan-100/[0.045] hover:text-cyan-50/72"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${promptOptimizer ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" : "bg-cyan-50/18"}`} />
            <span>优化</span>
          </button>

          <div ref={quantityMenuRef} className="relative">
            <button
              data-node-action="true"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateQuantityMenuPosition();
                setIsQuantityMenuOpen((open) => !open);
              }}
              className={`inline-flex h-10 min-w-[70px] items-center justify-center gap-1.5 rounded-[14px] border px-3 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-all ${
                isQuantityMenuOpen
                  ? "border-cyan-100/36 bg-cyan-100/[0.09] text-cyan-50 shadow-[0_12px_28px_-22px_rgba(34,211,238,0.78),inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-cyan-100/8 bg-slate-950/18 text-cyan-50/72 hover:border-cyan-100/18 hover:bg-cyan-100/[0.045] hover:text-cyan-50"
              }`}
            >
              <span>{quantity.replace("张", "")}</span>
              <span className="text-[11px] text-cyan-50/42">张</span>
              <ChevronUp className={`h-3.5 w-3.5 text-slate-300/55 transition-transform ${isQuantityMenuOpen ? "" : "rotate-180"}`} />
            </button>

            {createPortal(
              <AnimatePresence>
                {isQuantityMenuOpen && (
                  <motion.div
                    ref={quantityMenuPanelRef}
                    data-node-action="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    style={{ left: quantityMenuPosition.left, top: quantityMenuPosition.top }}
                    className="fixed z-[9999] w-[180px] overflow-hidden rounded-[18px] border border-[#334155]/85 bg-[#121723]/96 p-2 text-slate-200 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.95),0_0_0_1px_rgba(34,211,238,0.05),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.1),transparent_44%),radial-gradient(circle_at_86%_10%,rgba(129,140,248,0.08),transparent_42%)]" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/24 to-transparent" />
                    <div className="relative px-2 pb-1 pt-1 text-[12px] font-medium text-cyan-50/52">生成张数</div>
                    <div className="relative space-y-1">
                      {QUANTITY_OPTIONS.map((option) => {
                        const active = quantity === option;
                        const count = option.replace("张", "");
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateProperty?.(node.id, "quantity", option);
                              onUpdateProperty?.(node.id, "n", Number.parseInt(option, 10));
                              setIsQuantityMenuOpen(false);
                            }}
                            className={`flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-[13px] font-medium transition-all ${
                              active
                                ? "bg-cyan-100/[0.1] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(165,243,252,0.22)]"
                                : "text-cyan-50/58 hover:bg-cyan-100/[0.055] hover:text-cyan-50"
                            }`}
                          >
                            <span>{count} 张</span>
                            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.75)]" : "bg-cyan-50/18"}`} />
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}
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
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const ImageNodeCard = React.memo(ImageNodeCardImpl, (prev, next) => prev.node === next.node && prev.selected === next.selected);

export default ImageNodeCard;
