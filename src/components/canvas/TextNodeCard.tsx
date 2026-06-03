import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ArrowUp, Check, Copy, Cpu, FileText, Loader2, MessageSquareText, Plus } from "lucide-react";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { TEXT_NODE_MODEL } from "../../features/nodes/nodeExecutors";
import { getTextNodeViewState } from "../../utils/textNodeViewState";

interface TextNodeCardProps {
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

function TextSkeleton({ active }: { active: boolean }) {
  const rows = ["w-[84%]", "w-full", "w-[92%]", "w-full", "w-[64%]"];

  return (
    <div className="w-full space-y-5">
      {rows.map((width, index) => (
        <div
          key={`${width}-${index}`}
          className={`relative h-4 origin-left overflow-hidden rounded-full bg-slate-300/12 ${width} ${active ? "animate-[text-node-skeleton-width_2.2s_ease-in-out_infinite]" : ""}`}
          style={{ animationDelay: `${index * 120}ms` }}
        >
          {active && (
            <span className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-slate-100/16 to-transparent" />
          )}
        </div>
      ))}
    </div>
  );
}

function TextNodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
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
}: TextNodeCardProps) {
  const isRunning = node.properties.status === "loading" || node.data?.loading === true;
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [outputMenuPos, setOutputMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const inputPortRef = React.useRef<HTMLDivElement | null>(null);
  const outputPortRef = React.useRef<HTMLDivElement | null>(null);
  const [portMagnet, setPortMagnet] = React.useState({
    input: { x: 0, y: 0 },
    output: { x: 0, y: 0 },
  });

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, ["prompt", "user_prompt", "text", "原始提示词", "用户提示词"]);

  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
  const responseText = (node.data?.response as string) || (node.properties.response as string) || "";
  const errorText = typeof node.data?.error === "string" ? node.data.error : "";
  const viewState = getTextNodeViewState({ errorText, isRunning, promptText, responseText });
  const nodeBadgeTitle = node.title === "文本" ? "文本节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);
  const showPortHandles = shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected });
  const hasCompactContent = Boolean(responseText || errorText);
  const showPromptComposer = (isHovered || selected) && !hasCompactContent;

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
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
      const distance = sideZoneX && sideZoneY ? Math.abs(dx) * 0.45 + Math.abs(dy) * 0.25 : Math.hypot(dx, dy);
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
        onContextMenu={handleOutputContextMenu}
        className={`group node-card relative rounded-[18px] border bg-[#121723]/88 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition-all duration-300 cursor-grab active:cursor-grabbing ${
          selected ? "border-slate-200/50 ring-2 ring-cyan-200/10 shadow-[0_0_0_1px_rgba(148,163,184,0.12),0_30px_90px_-28px_rgba(56,189,248,0.34)]" : "border-[#2b3142]/90 hover:border-slate-300/35"
        }`}
        style={{ width: getNodeWidth(node), minHeight: 290 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[18px] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_34%)]" />
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute inset-0 -translate-x-full animate-[text-node-shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan-200/12 to-transparent" />
          </div>
        )}
        {/* Hover side icons */}
        <div
          className="absolute -left-24 top-1/2 z-10 flex h-28 w-24 -translate-y-1/2 items-center justify-center"
          onMouseEnter={() => setIsHovered(true)}
        >
          <motion.div
            ref={inputPortRef}
            role="button"
            tabIndex={-1}
            data-node-action="true"
            data-port-role="input"
            data-node-id={node.id}
            data-port-index={0}
            animate={{
              opacity: showPortHandles ? 1 : 0,
              scale: showPortHandles ? 1 : 0.72,
              x: portMagnet.input.x,
              y: portMagnet.input.y,
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`canvas-port-handle flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 will-change-transform ${
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
          </motion.div>
        </div>
        <div
          className="absolute -right-24 top-1/2 z-10 flex h-28 w-24 -translate-y-1/2 items-center justify-center"
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
                    {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4 text-cyan-100/58" />}
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

        <div className={`relative flex min-h-[290px] flex-col ${hasCompactContent ? "px-5 py-5" : "px-5 pb-5 pt-5"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={viewState.kind}
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
                <div className={`relative flex flex-1 ${hasCompactContent ? "items-start" : "items-center"}`}>
                  {viewState.kind === "error" ? (
                    <div className="flex items-start gap-3 text-[13px] leading-6 text-amber-100/86">
                      <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
                      <span className="line-clamp-6">{errorText}</span>
                    </div>
                  ) : responseText ? (
                    <div className="w-full text-[14px] leading-[1.78] text-slate-100/82">
                      <div className="line-clamp-7">{renderMarkdown(responseText)}</div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <TextSkeleton active={isRunning} />
                    </div>
                  )}
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
            className="relative node-card left-1/2 mt-5 w-[430px] -translate-x-1/2 overflow-hidden rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-5 pb-3 pt-4 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
            <textarea
              value={upstreamPrompt ? "" : promptText}
              onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
              disabled={!!upstreamPrompt}
              placeholder={
                upstreamPrompt
                  ? `已由上游节点 (${upstreamPrompt.key}) 提供输入`
                  : "写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看着星星。"
              }
              className="relative h-[88px] w-full resize-none bg-transparent text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/42 disabled:cursor-not-allowed disabled:text-slate-400/45 custom-scrollbar"
            />
            <div className="relative mt-3 flex items-center gap-3 border-t border-slate-200/8 pt-3">
              <div className="min-w-0 flex-1">
                <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200/10 bg-[#0d1117]/42 px-3 text-[13px] font-medium text-slate-100/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <Cpu className="h-3.5 w-3.5 text-slate-200/42" />
                  <span>DeepSeek V4 Flash</span>
                  <span className="ml-auto rounded-full border border-emerald-300/22 bg-emerald-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-100/76">
                    fixed
                  </span>
                </div>
                <input type="hidden" value={TEXT_NODE_MODEL} readOnly />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
                disabled={isRunning || (!upstreamPrompt && !promptText.trim())}
                className={`flex h-10 w-10 items-center justify-center rounded-[12px] transition-all ${
                  isRunning || (!upstreamPrompt && !promptText.trim())
                    ? "bg-slate-200/8 text-slate-200/28 cursor-not-allowed"
                    : "bg-slate-100 text-[#111827] shadow-[0_12px_28px_-16px_rgba(226,232,240,0.8)] hover:bg-white"
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

const TextNodeCard = React.memo(TextNodeCardImpl, (prev, next) => prev.node === next.node && prev.selected === next.selected);

export default TextNodeCard;
