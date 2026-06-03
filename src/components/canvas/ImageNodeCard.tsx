import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Camera, Check, Copy, Crop, Focus, Image as ImageIcon, Languages, Loader2, Maximize2, Plus, ScanSearch, Settings2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { Select } from "antd";
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

const IMAGE_MODELS = [
  { value: "lib-navo-pro", label: "Lib Navo Pro" },
  { value: "flux-1", label: "Flux.1 Pro" },
  { value: "sdxl", label: "SDXL Turbo" },
  { value: "midjourney", label: "Midjourney v6" },
];

const RATIO_OPTIONS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const RESOLUTION_OPTIONS = ["1K", "2K", "4K"];
const QUANTITY_OPTIONS = ["1张", "2张", "4张"];
const CAMERA_OPTIONS = ["摄像机", "肖像", "产品", "电影感"];

const QUICK_ACTIONS = [
  { key: "img2img", label: "图生图", icon: Upload },
  { key: "upscale", label: "图片高清", icon: ScanSearch },
];

const TOOL_TABS = [
  { key: "style", label: "风格", icon: Sparkles },
  { key: "mark", label: "标记", icon: Crop },
  { key: "focus", label: "聚焦", icon: Focus },
];

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
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const upstreamPrompt = findResolvedStringInput(resolvedInputs, ["prompt", "text", "原始提示词", "用户提示词"]);

  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";
  const imageUrl = (node.data?.imageUrl as string) || (node.properties.imageUrl as string) || "";
  const referenceImage = (node.properties.referenceImage as string) || "";
  const aspectRatio = (node.properties.aspect_ratio as string) || "16:9";
  const resolution = (node.properties.resolution as string) || "2K";
  const quantity = (node.properties.quantity as string) || "1张";
  const model = (node.properties.model as string) || "lib-navo-pro";
  const camera = (node.properties.camera as string) || "摄像机";
  const activeTool = (node.properties.imageTool as string) || "style";

  const handleRun = () => {
    if (isRunning) return;
    onRun?.(node.id);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    onUpdateProperty?.(node.id, "referenceImage", url);
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
      style={{ width: getNodeWidth(node) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

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
          <span className="text-[15px] font-medium tracking-tight">{node.title}</span>
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
                  {referenceImage ? (
                    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/10 bg-black/20 shadow-inner">
                      <img src={referenceImage} alt="引用素材" className="h-[110px] w-[180px] object-cover" />
                    </div>
                  ) : (
                    <ImageIcon className="mb-14 h-16 w-16" />
                  )}
                </div>
                <div className="w-full max-w-[220px]">
                  <div className="mb-4 text-[14px] text-slate-400/70">尝试:</div>
                  <div className="space-y-5">
                    {QUICK_ACTIONS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          data-node-action="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.key === "img2img") fileInputRef.current?.click();
                            if (item.key === "upscale") onUpdateProperty?.(node.id, "resolution", "4K");
                          }}
                          className="flex items-center gap-3 text-left text-slate-100/86 transition-colors hover:text-white"
                        >
                          <Icon className="h-4 w-4 text-cyan-100/64" />
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
            className="relative node-card left-1/2 mt-5 w-[560px] -translate-x-1/2 overflow-hidden rounded-[18px] border border-[#2b3142]/90 bg-[#121723]/88 px-4 pb-3 pt-3 shadow-[0_28px_70px_-26px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
          >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/22 to-transparent" />
        <div className="mb-4 flex items-center gap-2">
          <button
            data-node-action="true"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex h-[54px] w-[54px] flex-col items-center justify-center gap-1 rounded-[12px] border border-cyan-100/12 bg-cyan-100/[0.04] text-[11px] text-cyan-100/72 transition-colors hover:bg-cyan-100/[0.08] hover:text-cyan-50"
          >
            <Upload className="h-4 w-4" />
            <span>上传</span>
          </button>
          {TOOL_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTool === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateProperty?.(node.id, "imageTool", item.key);
                }}
                className={`flex h-[54px] w-[54px] flex-col items-center justify-center gap-1 rounded-[12px] border text-[11px] transition-colors ${
                  active
                    ? "border-cyan-100/16 bg-cyan-100/[0.06] text-cyan-50/90"
                    : "border-slate-200/10 bg-white/[0.02] text-slate-300/45 hover:bg-white/[0.05] hover:text-slate-100/75"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (imageUrl) onPreview?.(imageUrl, "图片节点输出", node.id);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300/45 transition-colors hover:bg-white/8 hover:text-slate-100/88"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <textarea
          value={upstreamPrompt ? "" : promptText}
          onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
          disabled={!!upstreamPrompt}
          placeholder={
            upstreamPrompt
              ? `已由上游节点 (${upstreamPrompt.key}) 提供提示词`
              : "描述你想要生成的画面内容，按/呼出指令，@引用素材"
          }
          className="h-[92px] w-full resize-none bg-transparent px-1 text-[15px] leading-7 text-slate-100/88 outline-none placeholder:text-slate-400/42 disabled:cursor-not-allowed disabled:text-slate-400/45 custom-scrollbar"
        />

        <div className="mt-3 flex items-center gap-2 border-t border-slate-200/8 pt-3">
          <div className="min-w-[170px]">
            <Select
              value={model}
              onChange={(value) => onUpdateProperty?.(node.id, "model", value)}
              className="w-full custom-select"
              variant="borderless"
              options={IMAGE_MODELS}
              suffixIcon={<Wand2 className="h-3.5 w-3.5 text-white/45" />}
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
            />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const index = RATIO_OPTIONS.indexOf(aspectRatio);
              onUpdateProperty?.(node.id, "aspect_ratio", RATIO_OPTIONS[(index + 1) % RATIO_OPTIONS.length]);
            }}
            className="rounded-full px-2.5 py-1 text-[12px] text-slate-100/82 transition-colors hover:bg-white/[0.06]"
          >
            {aspectRatio} · {resolution}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const index = CAMERA_OPTIONS.indexOf(camera);
              onUpdateProperty?.(node.id, "camera", CAMERA_OPTIONS[(index + 1) % CAMERA_OPTIONS.length]);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-slate-100/82 transition-colors hover:bg-white/[0.06]"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>{camera}</span>
          </button>

          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-slate-300/45 transition-colors hover:bg-white/[0.06] hover:text-slate-100/88"
            title="语言"
          >
            <Languages className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = RESOLUTION_OPTIONS[(RESOLUTION_OPTIONS.indexOf(resolution) + 1) % RESOLUTION_OPTIONS.length];
              onUpdateProperty?.(node.id, "resolution", next);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300/45 transition-colors hover:bg-white/[0.06] hover:text-slate-100/88"
            title="切换分辨率"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = QUANTITY_OPTIONS[(QUANTITY_OPTIONS.indexOf(quantity) + 1) % QUANTITY_OPTIONS.length];
              onUpdateProperty?.(node.id, "quantity", next);
            }}
            className="rounded-full px-2 py-1 text-[12px] text-slate-100/75 transition-colors hover:bg-white/[0.06]"
          >
            {quantity}
          </button>

          <div className="inline-flex items-center gap-1 text-[12px] text-slate-400/52">
            <span>↯</span>
            <span>14</span>
          </div>

          <Tooltip content="复制提示词" position="top">
            <button
              data-node-action="true"
              onClick={handleCopyPrompt}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] text-slate-300/42 transition-colors hover:bg-white/8 hover:text-slate-50/90"
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

const ImageNodeCard = React.memo(ImageNodeCardImpl, (prev, next) => prev.node === next.node && prev.selected === next.selected);

export default ImageNodeCard;
