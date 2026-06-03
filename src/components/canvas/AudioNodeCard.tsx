import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowUp, 
  Check, 
  Copy, 
  Languages, 
  Loader2, 
  Maximize2,
  Music2, 
  Play, 
  Settings2, 
  Upload, 
  Volume2, 
  X,
  Plus
} from "lucide-react";
import { Select } from "antd";
import { Tooltip } from "../common/Tooltip";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { findResolvedStringInput } from "../../utils/resolvedInputs";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";

interface AudioNodeCardProps {
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

const AUDIO_MODELS = [
  { value: "minimax-speech-2.8-hd", label: "Minimax-speech-2.8-hd" },
  { value: "tts-1-hd", label: "OpenAI TTS HD" },
  { value: "eleven-labs", label: "Eleven Labs v2" },
  { value: "bark", label: "Bark AI" },
];

const QUICK_ACTIONS = [
  { key: "audio-to-video", label: "音频生视频", icon: Play },
];

function AudioNodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onDragStart,
  onUpdateProperty,
  onPreview: _onPreview,
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
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, ["prompt", "text", "提示词", "用户提示词"]);

  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
  const audioUrl = (node.data?.audioUrl as string) || (node.properties.audioUrl as string) || "";
  const model = (node.properties.model as string) || "minimax-speech-2.8-hd";
  const energy = (node.properties.energy as number) || 1;

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onUpdateProperty?.(node.id, "audioUrl", url);
    event.target.value = "";
  };

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!promptText) return;
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="absolute text-left"
      style={{ width: 560 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Upload Floating Button */}
      <div className="mb-4 flex justify-center">
        <button
          data-node-action="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="inline-flex items-center gap-1.5 rounded-[14px] border border-white/10 bg-[#202020]/96 px-4 py-2 text-[15px] text-white/88 shadow-[0_14px_32px_-20px_rgba(0,0,0,0.85)] transition-colors hover:bg-[#272727]"
        >
          <Upload className="h-4 w-4" />
          <span>上传</span>
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
      </div>

      {/* Main Node Card */}
      <motion.div
        onPointerDown={(e) => {
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
        className={`group node-card relative rounded-[18px] border bg-[#252525]/97 shadow-[0_24px_80px_-22px_rgba(0,0,0,0.85)] backdrop-blur-sm transition-all duration-300 cursor-grab active:cursor-grabbing ${
          selected ? "border-white/60" : "border-white/35 hover:border-white/50"
        }`}
        style={{ width: getNodeWidth(node), minHeight: 390 }}
      >
        {/* Hover side icons */}
        <AnimatePresence>
          {shouldShowInlinePortHandles({ isHovered, isLinkingOnCanvas, selected }) && (
            <>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute -left-4 top-[145px] -translate-y-1/2 z-10"
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
                className="absolute -right-4 top-[145px] -translate-y-1/2 z-10"
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
        <div className="absolute -top-8 left-0 flex items-center gap-1.5 text-white/70">
          <Music2 className="h-3.5 w-3.5" />
          <span className="text-[13px] tracking-tight">{node.title}</span>
        </div>

        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip content="复制节点" position="top">
            <button
              data-node-action="true"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white/90"
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
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white/90"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        <div className="px-6 pb-6 pt-8">
          <AnimatePresence mode="wait">
            {isRunning ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[350px] flex-col items-center justify-center gap-5 text-white/50"
              >
                <Loader2 className="h-10 w-10 animate-spin" />
                <div className="text-center">
                  <div className="text-[13px] text-white/80">正在合成音频</div>
                  <div className="mt-2 text-[11px] text-white/38">正在根据文本生成高质量语音</div>
                </div>
              </motion.div>
            ) : audioUrl ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-white/72">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                    <span className="text-[12px] uppercase tracking-[0.16em]">音频结果</span>
                  </div>
                </div>
                <div className="p-6 rounded-[16px] border border-white/10 bg-black/20 shadow-inner flex flex-col items-center gap-4">
                  <Volume2 className="h-12 w-12 text-white/20" />
                  <audio src={audioUrl} controls className="w-full" />
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
                <div className="flex flex-1 flex-col items-center justify-center text-white/24">
                   <div className="w-[180px] h-[110px] rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-center">
                      <Volume2 className="h-12 w-12 opacity-20" />
                   </div>
                </div>
                <div className="w-full">
                  <div className="mb-4 text-[14px] text-white/45">尝试:</div>
                  <div className="space-y-5">
                    {QUICK_ACTIONS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          data-node-action="true"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="flex items-center gap-3 text-left text-white/92 transition-colors hover:text-white"
                        >
                          <Icon className="h-4 w-4 text-white/78" />
                          <span className="text-[15px] tracking-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Input & Settings Panel */}
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
            className="relative node-card left-1/2 mt-5 w-[560px] -translate-x-1/2 rounded-[18px] border border-white/10 bg-[#1f1f1f]/97 px-4 pb-3 pt-3 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.92)] backdrop-blur-sm"
          >
        {/* Placeholder / Input Area */}
        <div className="flex justify-between items-start mb-2">
           <span className="text-white/36 text-[15px]">输入要合成的文本</span>
           <Maximize2 className="h-4 w-4 text-white/45 cursor-pointer hover:text-white/80" />
        </div>

        <textarea
          value={upstreamPrompt ? "" : promptText}
          onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
          disabled={!!upstreamPrompt}
          placeholder={
            upstreamPrompt
              ? `已由上游节点 (${upstreamPrompt.key}) 提供文本内容`
              : ""
          }
          className="h-[92px] w-full resize-none bg-transparent px-1 text-[15px] leading-7 text-white/88 outline-none placeholder:text-white/36 disabled:cursor-not-allowed disabled:text-white/40 custom-scrollbar"
        />

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
           <button className="px-3 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-[12px] text-white/80 hover:bg-white/10 transition-colors">
             &lt;#&gt; 停顿
           </button>
           <button className="px-3 py-1.5 rounded-[10px] bg-white/5 border border-white/10 text-[12px] text-white/80 hover:bg-white/10 transition-colors">
             () 语气词
           </button>
        </div>

        {/* Bottom Bar */}
        <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
          <div className="min-w-[170px]">
            <Select
              value={model}
              onChange={(value) => onUpdateProperty?.(node.id, "model", value)}
              className="w-full custom-select"
              variant="borderless"
              options={AUDIO_MODELS}
              suffixIcon={<Volume2 className="h-3.5 w-3.5 text-white/45" />}
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
            />
          </div>

          <button
            type="button"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/88"
            title="语言"
          >
            <Languages className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/88"
            title="设置"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          <div className="rounded-full px-2 py-1 text-[12px] text-white/75">
            {promptText.length}/50000
          </div>

          <div className="inline-flex items-center gap-1 text-[12px] text-white/42">
            <span>⚡</span>
            <span>{energy}</span>
          </div>

          <Tooltip content="复制文本" position="top">
            <button
              data-node-action="true"
              onClick={handleCopyPrompt}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] text-white/42 transition-colors hover:bg-white/8 hover:text-white/90"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </Tooltip>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRun();
            }}
            disabled={isRunning || (!upstreamPrompt && !promptText.trim())}
            className={`flex h-10 w-10 items-center justify-center rounded-[12px] transition-all ${
              isRunning || (!upstreamPrompt && !promptText.trim())
                ? "bg-white/8 text-white/28 cursor-not-allowed"
                : "bg-white/90 text-[#222] hover:bg-white"
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

const AudioNodeCard = React.memo(AudioNodeCardImpl, (prev, next) => prev.node === next.node && prev.selected === next.selected);

export default AudioNodeCard;
