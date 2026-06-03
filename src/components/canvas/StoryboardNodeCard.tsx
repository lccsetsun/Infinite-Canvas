import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clapperboard,
  Copy,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Video as VideoIcon,
  Wand2,
  Play,
  Check,
  AlertTriangle,
  X,
  Settings2,
} from "lucide-react";
import { GraphNode, StoryboardRow } from "../../types";
import { getNodeWidth } from "./geometry";
import { shouldShowInlinePortHandles } from "../../utils/portHandleVisibility";
import { Select } from "antd";

interface StoryboardNodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: unknown) => void;
  onPreview?: (content: string, title?: string, nodeId?: string, items?: string[], currentIndex?: number) => void;
  onGenerateRowImage?: (nodeId: string, rowId: string) => void;
  onGenerateRowVideo?: (nodeId: string, rowId: string) => void;
  onGenerateAllImages?: (nodeId: string) => void;
  onGenerateAllVideos?: (nodeId: string) => void;
  onRerunNode?: (nodeId: string) => void;
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
  { value: "flux-1", label: "Flux.1 Pro" },
  { value: "sdxl", label: "SDXL Turbo" },
  { value: "midjourney", label: "Midjourney v6" },
  { value: "dall-e-3", label: "DALL-E 3" },
  { value: "qwen-image", label: "Qwen Image" },
  { value: "seedream", label: "Seedream 5.0" },
];

const VIDEO_MODELS = [
  { value: "sora", label: "Sora" },
  { value: "runway-gen3", label: "Runway Gen-3" },
  { value: "kling", label: "Kling AI" },
  { value: "luma", label: "Luma Dream" },
  { value: "seedance", label: "Seedance 1.5" },
];

const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function StoryboardNodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onDragStart,
  onUpdateProperty,
  onPreview,
  onGenerateRowImage,
  onGenerateRowVideo,
  onGenerateAllImages,
  onGenerateAllVideos,
  onRerunNode,
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
}: StoryboardNodeCardProps) {
  const [showConfig, setShowConfig] = React.useState(false);
  const [generatingAll, setGeneratingAll] = React.useState<"image" | "video" | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  const rows: StoryboardRow[] = React.useMemo(() => {
    if (node.data?.storyboard && node.data.storyboard.length > 0) {
      return node.data.storyboard;
    }
    const stored = (node.properties.rows as StoryboardRow[]) ?? [];
    return stored;
  }, [node.data?.storyboard, node.properties.rows]);

  const setRows = (next: StoryboardRow[]) => {
    onUpdateProperty?.(node.id, "rows", next);
  };

  const aspectRatio = (node.properties.aspectRatio as string) || "16:9";

  const imageStats = React.useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.imageStatus === "success").length;
    const loading = rows.filter((r) => r.imageStatus === "loading").length;
    return { total, done, loading, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [rows]);

  const videoStats = React.useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.videoStatus === "success").length;
    const loading = rows.filter((r) => r.videoStatus === "loading").length;
    return { total, done, loading, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [rows]);

  const addRow = () => {
    const nextNum = rows.length + 1;
    const newRow: StoryboardRow = {
      id: makeId("row"),
      title: `分镜 ${nextNum}`,
      prompt: "",
      duration: Number(node.properties.defaultDuration ?? 5),
      imageStatus: "idle",
      videoStatus: "idle",
      aspectRatio,
    };
    setRows([...rows, newRow]);
  };

  const updateRow = (rowId: string, patch: Partial<StoryboardRow>) => {
    setRows(rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const removeRow = (rowId: string) => {
    setRows(rows.filter((r) => r.id !== rowId));
  };

  const handleGenerateAllImages = async () => {
    if (!onGenerateAllImages || rows.length === 0) return;
    setGeneratingAll("image");
    onGenerateAllImages(node.id);
    setTimeout(() => setGeneratingAll(null), 1500);
  };

  const handleGenerateAllVideos = async () => {
    if (!onGenerateAllVideos || rows.length === 0) return;
    setGeneratingAll("video");
    onGenerateAllVideos(node.id);
    setTimeout(() => setGeneratingAll(null), 1500);
  };

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 24, stiffness: 280 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-node-action='true']") && !target.closest("input,textarea,select,button")) {
          onDragStart(e, node);
        } else {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      className={`absolute node-card text-left rounded-2xl border bg-[#0b0e14]/92 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-500 cursor-grab active:cursor-grabbing will-change-transform ${
        selected
          ? "border-violet-500/55 ring-1 ring-violet-500/25 shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_32px_64px_-16px_rgba(0,0,0,0.6)]"
          : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
      style={{ width: getNodeWidth(node) }}
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
                title="输出端口: 按住并拖拽进行连线"
              >
                <Plus className="h-4 w-4 pointer-events-none" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className={`h-11 px-4 flex items-center justify-between border-b transition-colors ${
        selected ? "border-violet-400/30 bg-violet-500/5" : "border-[#252c3a] bg-white/[0.02]"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${selected ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-gray-400"}`}>
            <Clapperboard className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <span className={`text-[13px] font-bold tracking-tight ${selected ? "text-white" : "text-gray-200"}`}>
              {node.title}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-violet-300/70">
              {rows.length} 镜 · {aspectRatio}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-node-action="true"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all cursor-pointer"
            aria-label="复制"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            data-node-action="true"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-gray-500 hover:text-rose-400 transition-all cursor-pointer"
            aria-label="删除"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Toolbar: Batch actions + Stats */}
      <div className="px-4 py-3 border-b border-[#252c3a] bg-gradient-to-b from-violet-500/[0.04] to-transparent space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em]">
            <div className="flex items-center gap-1.5 text-indigo-300/80">
              <ImageIcon className="w-3 h-3" />
              <span>图像</span>
              <span className="text-gray-500 ml-1">
                {imageStats.done}/{imageStats.total}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-300/80">
              <span className="text-gray-500 mr-1">
                {videoStats.done}/{videoStats.total}
              </span>
              <span>视频</span>
              <VideoIcon className="w-3 h-3" />
            </div>
          </div>
          <div className="relative h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500"
              initial={false}
              animate={{ width: `${imageStats.percent}%` }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-500 to-amber-500"
              initial={false}
              animate={{ width: `${videoStats.percent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Batch action buttons */}
        <div className="flex items-center gap-2">
          <button
            data-node-action="true"
            onClick={handleGenerateAllImages}
            disabled={rows.length === 0 || generatingAll !== null}
            className="flex-1 h-9 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAll === "image" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            批量生图
          </button>
          <button
            data-node-action="true"
            onClick={handleGenerateAllVideos}
            disabled={rows.length === 0 || generatingAll !== null}
            className="flex-1 h-9 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAll === "video" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            批量生视频
          </button>
          <button
            data-node-action="true"
            onClick={() => setShowConfig(!showConfig)}
            className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-colors ${
              showConfig
                ? "bg-violet-500/15 border-violet-500/40 text-violet-200"
                : "bg-white/[0.03] border-white/5 text-gray-500 hover:bg-white/5 hover:text-white"
            }`}
            aria-label="节点配置"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            data-node-action="true"
            onClick={() => onRerunNode?.(node.id)}
            disabled={!onRerunNode}
            className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/5 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="一键重跑"
            title="一键重跑"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Config panel */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5" data-node-action="true" onPointerDown={(e) => e.stopPropagation()}>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.18em] ml-1">图像模型</label>
                    <Select
                      value={(node.properties.imageModel as string) || "flux-1"}
                      onChange={(v) => onUpdateProperty?.(node.id, "imageModel", v)}
                      className="w-full custom-select"
                      variant="filled"
                      options={IMAGE_MODELS}
                      style={{ backgroundColor: "#0d1117", borderRadius: 10 }}
                    />
                  </div>
                  <div className="space-y-1.5" data-node-action="true" onPointerDown={(e) => e.stopPropagation()}>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.18em] ml-1">视频模型</label>
                    <Select
                      value={(node.properties.videoModel as string) || "sora"}
                      onChange={(v) => onUpdateProperty?.(node.id, "videoModel", v)}
                      className="w-full custom-select"
                      variant="filled"
                      options={VIDEO_MODELS}
                      style={{ backgroundColor: "#0d1117", borderRadius: 10 }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.18em] ml-1">画面比例</label>
                  <div className="grid grid-cols-5 gap-1.5" data-node-action="true">
                    {RATIOS.map((r) => (
                      <button
                        key={r}
                        onClick={() => onUpdateProperty?.(node.id, "aspectRatio", r)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                          aspectRatio === r
                            ? "bg-violet-500/20 text-violet-200 border-violet-500/40"
                            : "bg-white/[0.02] text-gray-500 border-transparent hover:bg-white/5"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Storyboard Table */}
      <div className="px-4 py-3 space-y-2 max-h-[640px] overflow-y-auto custom-scrollbar">
        {rows.length === 0 ? (
          <button
            data-node-action="true"
            onClick={addRow}
            className="w-full p-6 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-violet-300 hover:border-violet-500/40 transition-colors flex flex-col items-center gap-2"
          >
            <Clapperboard className="w-6 h-6 opacity-50" />
            <span className="text-[12px] font-bold">添加第一个分镜</span>
            <span className="text-[10px] text-gray-600">每一行都是一段镜头描述</span>
          </button>
        ) : (
          <AnimatePresence initial={false}>
            {rows.map((row, idx) => (
              <StoryboardRowItem
                key={row.id}
                row={row}
                index={idx}
                onChange={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
                onPreview={(url) => onPreview?.(url, `${row.title} 预览`)}
                onGenerateImage={() => onGenerateRowImage?.(node.id, row.id)}
                onGenerateVideo={() => onGenerateRowVideo?.(node.id, row.id)}
              />
            ))}
          </AnimatePresence>
        )}

        {rows.length > 0 && (
          <button
            data-node-action="true"
            onClick={addRow}
            className="w-full p-2.5 rounded-lg border border-dashed border-white/10 text-gray-500 hover:text-violet-300 hover:border-violet-500/40 transition-colors flex items-center justify-center gap-1.5 text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            添加分镜
          </button>
        )}
      </div>
    </motion.div>
  );
}

function StatusBadge({ status, type }: { status: StoryboardRow["imageStatus"]; type: "image" | "video" }) {
  const colorMap = {
    image: {
      idle: "bg-white/5 text-gray-500",
      loading: "bg-indigo-500/15 text-indigo-300",
      success: "bg-emerald-500/15 text-emerald-300",
      error: "bg-rose-500/15 text-rose-300",
    },
    video: {
      idle: "bg-white/5 text-gray-500",
      loading: "bg-rose-500/15 text-rose-300",
      success: "bg-emerald-500/15 text-emerald-300",
      error: "bg-rose-500/15 text-rose-300",
    },
  } as const;
  const labelMap = {
    idle: "待生成",
    loading: "生成中",
    success: "已完成",
    error: "失败",
  } as const;
  const cls = colorMap[type][status];
  return (
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${cls}`}>
      {status === "loading" ? <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-0.5" /> : null}
      {status === "success" ? <Check className="w-2.5 h-2.5 inline mr-0.5" /> : null}
      {status === "error" ? <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" /> : null}
      {labelMap[status]}
    </span>
  );
}

function StoryboardRowItem({
  row,
  index,
  onChange,
  onRemove,
  onPreview,
  onGenerateImage,
  onGenerateVideo,
}: {
  key?: string;
  row: StoryboardRow;
  index: number;
  onChange: (patch: Partial<StoryboardRow>) => void;
  onRemove: () => void;
  onPreview: (url: string) => void;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      className="group/row relative p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 transition-colors"
    >
      <div className="flex items-start gap-2.5">
        {/* Index Badge */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-black text-violet-200">
            #{String(index + 1).padStart(2, "0")}
          </div>
          <StatusBadge status={row.imageStatus} type="image" />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              data-node-action="true"
              value={row.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="flex-1 bg-transparent text-[12px] font-bold text-gray-200 outline-none border-b border-transparent focus:border-violet-500/40 transition-colors px-0.5"
              placeholder="镜头标题"
            />
            <input
              data-node-action="true"
              type="number"
              min={1}
              max={60}
              value={row.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) || 5 })}
              className="w-12 bg-[#0a0d14] border border-white/5 rounded px-1.5 py-0.5 text-[10px] text-gray-300 outline-none focus:border-violet-500/40 tabular-nums"
              title="时长(秒)"
            />
            <span className="text-[9px] text-gray-500 font-mono">s</span>
          </div>
          <textarea
            data-node-action="true"
            value={row.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder="镜头描述,如:夕阳下海浪拍打礁石的慢动作..."
            rows={2}
            className="w-full bg-[#0a0d14] border border-white/5 rounded-lg p-2 text-[11px] text-gray-200 outline-none focus:border-violet-500/40 resize-none leading-relaxed placeholder:text-gray-700 custom-scrollbar"
          />

          {/* Media previews */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="relative aspect-video rounded-md overflow-hidden border border-white/5 bg-black/40">
              {row.imageStatus === "loading" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                </div>
              ) : row.imageUrl ? (
                <>
                  <img src={row.imageUrl} alt={row.title} className="w-full h-full object-cover" />
                  <button
                    data-node-action="true"
                    onClick={() => onPreview(row.imageUrl!)}
                    className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white/80 hover:text-white opacity-0 group-hover/row:opacity-100 transition-opacity"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                  <ImageIcon className="w-4 h-4 opacity-40" />
                </div>
              )}
            </div>
            <div className="relative aspect-video rounded-md overflow-hidden border border-white/5 bg-black/40">
              {row.videoStatus === "loading" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                </div>
              ) : row.videoUrl ? (
                <>
                  <video src={row.videoUrl} className="w-full h-full object-cover" muted />
                  <button
                    data-node-action="true"
                    onClick={() => onPreview(row.videoUrl!)}
                    className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white/80 hover:text-white opacity-0 group-hover/row:opacity-100 transition-opacity"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                  <VideoIcon className="w-4 h-4 opacity-40" />
                </div>
              )}
            </div>
          </div>

          {/* Per-row action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              data-node-action="true"
              onClick={onGenerateImage}
              disabled={!row.prompt?.trim() || row.imageStatus === "loading"}
              className="flex-1 h-7 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {row.imageStatus === "loading" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              重跑图像
            </button>
            <button
              data-node-action="true"
              onClick={onGenerateVideo}
              disabled={!row.prompt?.trim() || row.videoStatus === "loading"}
              className="flex-1 h-7 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {row.videoStatus === "loading" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              重跑视频
            </button>
            <button
              data-node-action="true"
              onClick={onRemove}
              className="h-7 w-7 rounded-md hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 flex items-center justify-center transition-colors"
              title="删除分镜"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const StoryboardNodeCard = React.memo(StoryboardNodeCardImpl, (prev, next) => prev.node === next.node && prev.selected === next.selected);

export default StoryboardNodeCard;
