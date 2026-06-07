import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  ChevronUp,
  Download,
  Eye,
  Loader2,
  Music2,
  Plus,
  Volume2,
  Wand2,
} from "lucide-react";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { Tooltip } from "../common/Tooltip";
import { downloadMediaAsset, extensionFromAssetUrl } from "../../utils/mediaAssets";

interface AudioNodeCardProps {
  node: GraphNode;
  selected: boolean;
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
  resolvedInputs?: Record<string, unknown>;
  onRun?: (nodeId: string) => void;
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

const AUDIO_MODEL = "speech-2.8-hd";
const VOICE_OPTIONS = [
  { value: "male-qn-qingse", label: "男声 清澈" },
  { value: "female-shaonv", label: "女声 少女" },
  { value: "female-yujie", label: "女声 御姐" },
  { value: "male-qn-jingying", label: "男声 精英" },
];
const EMOTION_OPTIONS = [
  { value: "auto", label: "自动情绪" },
  { value: "happy", label: "开心" },
  { value: "sad", label: "悲伤" },
  { value: "angry", label: "愤怒" },
  { value: "fearful", label: "紧张" },
];
const SPEED_OPTIONS = [0.8, 1, 1.2, 1.5];

function formatDuration(value: unknown) {
  const seconds = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remain = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remain}`;
}

type AudioOptionMenu = "voice" | "emotion" | "speed" | null;

function AudioNodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
  onDragStart,
  onUpdateProperty,
  onUpdateData,
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
}: AudioNodeCardProps) {
  const isRunning = node.data?.loading === true;
  const [isHovered, setIsHovered] = React.useState(false);
  const [optionMenuOpen, setOptionMenuOpen] = React.useState<AudioOptionMenu>(null);
  const upstreamPrompt = findResolvedStringInput(resolvedInputs, [
    "prompt",
    "text",
    "提示词",
    "用户提示词",
  ]);

  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
  const audioUrl = (node.data?.audioUrl as string) || (node.properties.audioUrl as string) || "";
  const nodeWidth = getNodeWidth(node);
  const voiceId = (node.properties.voice_id as string) || "male-qn-qingse";
  const emotion = (node.properties.emotion as string) || "auto";
  const speed = Number(node.properties.speed ?? 1);
  const durationLabel = formatDuration(node.data?.audioDuration);
  const nodeBadgeTitle = node.title === "音频" ? "音频节点 1" : node.title;
  const nodeBadgeMatch = nodeBadgeTitle.match(/^(.*?)(\s+\d+)$/);

  const handleRun = () => {
    if (isRunning) return;
    setOptionMenuOpen(null);
    onRun?.(node.id);
  };

  const downloadAudio = async () => {
    if (!audioUrl) return;
    const filename = `${nodeBadgeTitle.replace(/\s+/g, "-") || "audio-node"}-${Date.now()}.${extensionFromAssetUrl(audioUrl, "mp3")}`;
    await downloadMediaAsset(audioUrl, filename);
  };

  const hasInputPorts = node.inputs.length > 0;
  const portHandles = (
    <AnimatePresence>
      {shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
        <>
          {hasInputPorts && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute -left-11 top-1/2 z-10 -translate-y-1/2"
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
            className="absolute -right-11 top-1/2 z-10 -translate-y-1/2"
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

  if (audioUrl && !isRunning) {
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
          style={{ width: nodeWidth }}
        >
          {portHandles}
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
                <Tooltip content="下载音频" position="top">
                  <button
                    type="button"
                    onClick={downloadAudio}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </Tooltip>
                <div className="mx-1 h-7 w-px bg-slate-500/22" />
                <Tooltip content="全屏预览" position="top">
                  <button
                    type="button"
                    onClick={() => onPreview?.(audioUrl, "音频节点预览", node.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mb-2 flex items-center justify-between gap-4 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
            <div className="flex min-w-0 items-center gap-1.5">
              <Music2 className="h-4 w-4 shrink-0 text-slate-300/72" />
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
            {durationLabel && (
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-400/72">
                {durationLabel}
              </span>
            )}
          </div>
          <div
            className={`rounded-[10px] border border-slate-500/22 bg-[#0b0f17] px-4 py-5 shadow-[0_24px_58px_-34px_rgba(0,0,0,0.9)] ${selected ? "shadow-[0_0_0_1.5px_rgba(192,132,252,0.58),0_0_0_6px_rgba(139,92,246,0.14),0_0_38px_rgba(109,40,217,0.18)]" : ""}`}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-cyan-100/8 text-cyan-100/62">
                <Volume2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-100/86">MiniMax 音频结果</div>
                <div className="mt-1 truncate text-[11px] text-slate-400/70">
                  {voiceId} · {AUDIO_MODEL}
                </div>
              </div>
            </div>
            <audio
              src={audioUrl}
              controls
              className="w-full"
              onLoadedMetadata={(e) => {
                const duration = e.currentTarget.duration;
                if (Number.isFinite(duration) && node.data?.audioDuration !== duration) {
                  onUpdateData?.(node.id, { audioDuration: duration });
                }
              }}
            />
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
        {portHandles}
        <div className="absolute -top-8 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)]">
          <Music2 className="h-4 w-4 text-cyan-100/58" />
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
          {isRunning ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-5 text-slate-300/60">
              <Loader2 className="h-10 w-10 animate-spin" />
              <div className="text-center">
                <div className="text-[13px] text-slate-100/80">正在生成音频</div>
                <div className="mt-2 text-[11px] text-slate-400/60">MiniMax 正在合成语音</div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[250px] flex-col items-center justify-center">
              <div className="mb-8 flex h-[96px] w-[96px] items-center justify-center rounded-[28px] bg-slate-950/[0.12] text-cyan-50/[0.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_22px_55px_-40px_rgba(34,211,238,0.55)] backdrop-blur-sm">
                <Volume2 className="h-14 w-14" strokeWidth={1.55} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {(isHovered || selected) && !audioUrl && (
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
                  ? `已由上游节点 (${upstreamPrompt.key}) 提供文本`
                  : "输入要合成的语音文本"
              }
              className="h-[92px] w-full resize-none bg-transparent px-1 text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/42 disabled:cursor-not-allowed disabled:text-slate-400/45 custom-scrollbar"
            />
            <div className="mt-3 flex items-center gap-2 border-t border-cyan-100/8 pt-3">
              <div className="flex h-10 min-w-[156px] items-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <Wand2 className="h-3.5 w-3.5 text-cyan-100/50" />
                <span>MiniMax Audio</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptionMenuOpen((open) => (open === "voice" ? null : "voice"));
                  }}
                  className="inline-flex h-10 min-w-[116px] items-center justify-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/76 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
                >
                  <span>
                    {VOICE_OPTIONS.find((item) => item.value === voiceId)?.label || "默认音色"}
                  </span>
                  <ChevronUp className="h-3.5 w-3.5 rotate-180 text-slate-300/55" />
                </button>
                <AnimatePresence>
                  {optionMenuOpen === "voice" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute bottom-12 left-0 z-50 w-[144px] overflow-hidden rounded-[10px] border border-cyan-100/10 bg-[#111827]/96 py-1.5 text-[13px] text-slate-100 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
                    >
                      {VOICE_OPTIONS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`block w-full px-3 py-2 text-left transition hover:bg-cyan-100/10 ${item.value === voiceId ? "text-cyan-100" : "text-slate-300/86"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateProperty?.(node.id, "voice_id", item.value);
                            setOptionMenuOpen(null);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptionMenuOpen((open) => (open === "emotion" ? null : "emotion"));
                  }}
                  className="inline-flex h-10 min-w-[92px] items-center justify-center gap-2 rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/68 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
                >
                  <span>
                    {EMOTION_OPTIONS.find((item) => item.value === emotion)?.label || "自动情绪"}
                  </span>
                  <ChevronUp className="h-3.5 w-3.5 rotate-180 text-slate-300/55" />
                </button>
                <AnimatePresence>
                  {optionMenuOpen === "emotion" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute bottom-12 left-0 z-50 w-[120px] overflow-hidden rounded-[10px] border border-cyan-100/10 bg-[#111827]/96 py-1.5 text-[13px] text-slate-100 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
                    >
                      {EMOTION_OPTIONS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`block w-full px-3 py-2 text-left transition hover:bg-cyan-100/10 ${item.value === emotion ? "text-cyan-100" : "text-slate-300/86"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateProperty?.(node.id, "emotion", item.value);
                            setOptionMenuOpen(null);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptionMenuOpen((open) => (open === "speed" ? null : "speed"));
                  }}
                  className="inline-flex h-10 min-w-[76px] items-center justify-center rounded-[14px] border border-cyan-100/8 bg-slate-950/18 px-3 text-[13px] font-medium text-cyan-50/68 transition-colors hover:border-cyan-100/18 hover:bg-cyan-100/[0.045]"
                >
                  {speed}x
                </button>
                <AnimatePresence>
                  {optionMenuOpen === "speed" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute bottom-12 left-0 z-50 w-[84px] overflow-hidden rounded-[10px] border border-cyan-100/10 bg-[#111827]/96 py-1.5 text-[13px] text-slate-100 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
                    >
                      {SPEED_OPTIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`block w-full px-3 py-2 text-left transition hover:bg-cyan-100/10 ${item === speed ? "text-cyan-100" : "text-slate-300/86"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateProperty?.(node.id, "speed", item);
                            setOptionMenuOpen(null);
                          }}
                        >
                          {item}x
                        </button>
                      ))}
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

const AudioNodeCard = React.memo(
  AudioNodeCardImpl,
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default AudioNodeCard;
