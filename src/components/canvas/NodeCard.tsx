import React from "react";
import { Copy, X, Loader2, Check, Maximize2, Sparkles, MessageSquare, Cpu, Image as ImageIcon, Video as VideoIcon, Play, Wand2, RectangleHorizontal, RectangleVertical, Square, ChevronDown } from "lucide-react";
import { Select } from "antd";
import { Tooltip } from "../common/Tooltip";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { motion, AnimatePresence } from "motion/react";

interface NodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: any) => void;
  onUpdateData?: (nodeId: string, data: any) => void;
  apiConfig?: {
    baseUrl: string;
    apiKey: string;
  };
  onPreview?: (content: string, title?: string, nodeId?: string, items?: string[], currentIndex?: number) => void;
  resolvedInputs?: Record<string, unknown>;
  onRun?: (nodeId: string) => void;
  style?: React.CSSProperties;
}

// Simple Markdown-ish renderer to handle bold and newlines
const renderMarkdown = (text: string) => {
  if (!text) return null;
  
  // Replace **bold** with <strong>
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const RESOLUTIONS = ["1K", "2K", "4K"];
const RATIOS = [
  { label: "自适应", value: "auto", icon: Square },
  { label: "1:1", value: "1:1", icon: Square },
  { label: "9:16", value: "9:16", icon: RectangleVertical },
  { label: "16:9", value: "16:9", icon: RectangleHorizontal },
  { label: "3:4", value: "3:4", icon: RectangleVertical },
  { label: "4:3", value: "4:3", icon: RectangleHorizontal },
  { label: "3:2", value: "3:2", icon: RectangleHorizontal },
  { label: "2:3", value: "2:3", icon: RectangleVertical },
  { label: "4:5", value: "4:5", icon: RectangleVertical },
  { label: "5:4", value: "5:4", icon: RectangleHorizontal },
  { label: "21:9", value: "21:9", icon: RectangleHorizontal },
];
const QUANTITIES = ["1张", "2张", "4张"];
const VIDEO_RESOLUTIONS = ["480P", "720P", "1080P"];
const VIDEO_QUANTITIES = ["1个", "2个", "4个"];

function NodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onDragStart,
  onUpdateProperty,
  onUpdateData: _onUpdateData,
  apiConfig: _apiConfig,
  onPreview,
  resolvedInputs,
  onRun,
  style,
}: NodeCardProps) {
  const isRunning = node.properties.status === "loading" || node.data?.loading === true;
  const [copied, setCopied] = React.useState(false);
  const [promptCopied, setPromptCopied] = React.useState(false);
  const [showConfig, setShowConfig] = React.useState(false);

  const upstreamPrompt = (() => {
    if (!resolvedInputs) return null;
    const candidates = ["prompt", "user_prompt", "text", "原始提示词", "用户提示词", "视频提示词", "正向提示词"];
    for (const k of candidates) {
      const v = resolvedInputs[k];
      if (typeof v === "string" && v.trim()) return { value: v, key: k };
    }
    return null;
  })();

  const responseText = (node.data?.response as string) || (node.properties.response as string) || "";
  const imageUrl = (node.data?.imageUrl as string) || (node.properties.imageUrl as string) || "";
  const videoUrl = (node.data?.videoUrl as string) || (node.properties.videoUrl as string) || "";
  const promptText = upstreamPrompt?.value || (node.properties.text as string) || "";

  const activeRatio = RATIOS.find(r => r.value === (node.properties.aspect_ratio || (node.type === "video_node" ? "16:9" : "1:1"))) || (node.type === "video_node" ? RATIOS[3] : RATIOS[1]);
  const ActiveRatioIcon = activeRatio.icon;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = node.data?.response || node.properties.response;
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = upstreamPrompt?.value || node.properties.text;
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleRun = () => {
    if (isRunning) return;
    if (onUpdateProperty && !upstreamPrompt && node.properties.text) {
      onUpdateProperty(node.id, "status", "loading");
    }
    onRun?.(node.id);
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-node-action='true']")) {
          onDragStart(e, node);
        } else {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      className={`absolute node-card text-left rounded-2xl border bg-[#0b0e14]/90 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-500 cursor-grab active:cursor-grabbing will-change-transform ${
        selected
          ? "border-violet-300/24 -translate-y-[1px] shadow-[0_40px_82px_-24px_rgba(0,0,0,0.78),0_0_0_1px_rgba(196,181,253,0.18),0_0_0_7px_rgba(139,92,246,0.08),0_0_42px_rgba(109,40,217,0.16)]"
          : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
      style={{ width: getNodeWidth(node), ...style }}
    >
      <div className={`h-11 px-4 flex items-center justify-between border-b transition-colors ${
        selected ? "border-violet-400/20 bg-violet-500/[0.04]" : "border-[#252c3a] bg-white/[0.02]"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${selected ? "bg-violet-500/18 text-violet-300" : "bg-white/5 text-gray-400"}`}>
            {node.type === "text_node" && <MessageSquare className="w-3.5 h-3.5" />}
            {node.type === "image_node" && <ImageIcon className="w-3.5 h-3.5" />}
            {node.type === "video_node" && <VideoIcon className="w-3.5 h-3.5" />}
          </div>
          <span className={`text-[13px] font-bold tracking-tight ${selected ? "text-violet-50" : "text-gray-200"}`}>
            {node.title}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Tooltip content="复制节点" position="top">
            <button
              data-node-action="true"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="删除节点" position="top">
            <button
              data-node-action="true"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-gray-500 hover:text-rose-400 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="px-4 py-3 min-h-[126px] space-y-4">
        {/* Result Stage: High priority after generation */}
        {(node.type === "text_node" || node.type === "image_node" || node.type === "video_node") && (
          <AnimatePresence mode="wait">
            {isRunning ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative p-8 rounded-xl bg-white/[0.02] border border-dashed border-indigo-500/20 flex flex-col items-center justify-center gap-3 overflow-hidden"
              >
                <div className="relative">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                  <div className="absolute inset-0 blur-md bg-indigo-500/30 animate-pulse" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/60">正在深度推理中...</span>
                {/* Background pulse effect */}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-indigo-500/5"
                />
              </motion.div>
            ) : ((node.type === "text_node" && responseText) ||
                (node.type === "image_node" && imageUrl) ||
                (node.type === "video_node" && videoUrl)) ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group/res relative"
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                      {node.type === "text_node" ? "智能生成结果" : node.type === "image_node" ? "图像生成结果" : "视频创作结果"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/res:opacity-100 transition-all translate-x-2 group-hover/res:translate-x-0">
                    {node.type === "text_node" && (
                      <Tooltip content="复制内容" position="top">
                        <button
                          data-node-action="true"
                          onClick={handleCopy}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content={node.type === "text_node" ? "全屏预览" : "全屏查看"} position="top">
                      <button
                        data-node-action="true"
                        onClick={() => onPreview?.(node.type === "text_node" ? responseText : node.type === "image_node" ? imageUrl : videoUrl, node.type === "text_node" ? "生成结果" : "多媒体预览")}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                
                <div className="relative p-3.5 rounded-xl bg-gradient-to-b from-indigo-500/[0.05] to-transparent border border-indigo-500/10 overflow-hidden shadow-inner">
                  {node.type === "text_node" ? (
                    <div className="text-[12px] text-gray-300 leading-relaxed font-sans max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                      {renderMarkdown(responseText)}
                    </div>
                  ) : node.type === "image_node" ? (
                    <div className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-video shadow-2xl">
                      <img src={imageUrl} alt="Generated" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-video shadow-2xl">
                      <video src={videoUrl} controls className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Success highlight effect */}
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "200%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-indigo-400/10 to-transparent skew-x-[-20deg]"
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}

        {/* Input & Studio Stage */}
        {(node.type === "text_node" || node.type === "image_node" || node.type === "video_node") && (
          <div className="space-y-4 pt-1">
            {/* Prompt Input */}
            <div className="space-y-1.5 group/prompt">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] flex items-center gap-1.5">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                  提示词
                </label>
                <div className="flex items-center gap-1 opacity-0 group-hover/prompt:opacity-100 transition-all translate-x-2 group-hover/prompt:translate-x-0">
                  <Tooltip content="复制提示词" position="top">
                    <button
                      data-node-action="true"
                      onClick={handleCopyPrompt}
                      className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {promptCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </Tooltip>
                  <Tooltip content="全屏编辑" position="top">
                    <button
                      data-node-action="true"
                      onClick={() => onPreview?.(promptText, "提示词编辑", node.id)}
                      className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="relative">
                <textarea
                  data-node-action="true"
                  value={upstreamPrompt ? "" : promptText}
                  onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
                  placeholder={
                    upstreamPrompt
                      ? `已由上游节点 (${upstreamPrompt.key}) 提供提示词,无需输入`
                      : node.type === "text_node"
                        ? "请输入您的任务描述..."
                        : node.type === "image_node"
                          ? "描述您想要生成的画面..."
                          : "描述您想要创作的视频内容..."
                  }
                  disabled={!!upstreamPrompt}
                  className="w-full h-24 bg-[#0d1117] border border-white/5 rounded-xl p-3 text-[12px] text-gray-200 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed placeholder:text-gray-700 custom-scrollbar disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {upstreamPrompt ? (
                  <div className="absolute bottom-2 right-3 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-mono select-none">
                    ⇣ {upstreamPrompt.key}
                  </div>
                ) : (
                  <div className="absolute bottom-2 right-3 text-[9px] font-mono text-gray-700 select-none">
                    {promptText.length} 字符
                  </div>
                )}
              </div>
            </div>
            
            {/* Image Specific Controls: Resolution and Aspect Ratio */}
            {node.type === "image_node" && (
              <div className="space-y-3">
                {/* Config Summary Bar */}
                <button
                  data-node-action="true"
                  onClick={() => setShowConfig(!showConfig)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    showConfig 
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" 
                      : "bg-white/[0.03] border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold">
                      <ActiveRatioIcon className="w-3 h-3" />
                      <span>{activeRatio.label}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[10px] font-bold tracking-wider">{node.properties.resolution || "2K"} 分辨率</span>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[10px] font-bold tracking-wider">{node.properties.quantity || "1张"}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showConfig ? "rotate-180" : ""}`} />
                </button>

                {/* Expandable Config Panel */}
                <AnimatePresence>
                  {showConfig && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-4 mb-2">
                        {/* Resolution */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">分辨率</label>
                          <div className="flex gap-1.5" data-node-action="true">
                            {RESOLUTIONS.map(res => (
                              <button
                                key={res}
                                onClick={() => onUpdateProperty?.(node.id, "resolution", res)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  (node.properties.resolution || "2K") === res
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
                                    : "bg-white/[0.02] text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-400"
                                }`}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Aspect Ratio */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">画面比例</label>
                          <div className="grid grid-cols-4 gap-1.5" data-node-action="true">
                            {RATIOS.map(ratio => {
                              const Icon = ratio.icon;
                              const isActive = (node.properties.aspect_ratio || "1:1") === ratio.value;
                              return (
                                <button
                                  key={ratio.value}
                                  onClick={() => onUpdateProperty?.(node.id, "aspect_ratio", ratio.value)}
                                  className={`flex flex-col items-center justify-center py-2 rounded-lg gap-1 transition-all border ${
                                    isActive
                                      ? "bg-indigo-500/20 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
                                      : "bg-white/[0.01] border-transparent hover:bg-white/5 hover:border-white/10"
                                  }`}
                                >
                                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-300" : "text-gray-600"}`} />
                                  <span className={`text-[8px] font-bold ${isActive ? "text-indigo-300" : "text-gray-500"}`}>{ratio.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Quantity in expanded view */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">生成张数</label>
                          <div className="flex gap-1.5" data-node-action="true">
                            {QUANTITIES.map(q => (
                              <button
                                key={q}
                                onClick={() => onUpdateProperty?.(node.id, "quantity", q)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  (node.properties.quantity || "1张") === q
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                                    : "bg-white/[0.02] text-gray-500 border-transparent hover:bg-white/5"
                                }`}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Video Specific Controls */}
            {node.type === "video_node" && (
              <div className="space-y-3">
                {/* Config Summary Bar */}
                <button
                  data-node-action="true"
                  onClick={() => setShowConfig(!showConfig)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    showConfig 
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300" 
                      : "bg-white/[0.03] border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold">
                      <ActiveRatioIcon className="w-3 h-3" />
                      <span>{activeRatio.label}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[10px] font-bold tracking-wider">{node.properties.resolution || "720P"}</span>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[10px] font-bold tracking-wider">{node.properties.duration || "5s"}</span>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[10px] font-bold tracking-wider">{node.properties.quantity || "1个"}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showConfig ? "rotate-180" : ""}`} />
                </button>

                {/* Expandable Config Panel */}
                <AnimatePresence>
                  {showConfig && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-4 mb-2">
                        {/* Aspect Ratio */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">画面比例</label>
                          <div className="grid grid-cols-4 gap-1.5" data-node-action="true">
                            {RATIOS.map(ratio => {
                              const Icon = ratio.icon;
                              const isActive = (node.properties.aspect_ratio || "16:9") === ratio.value;
                              return (
                                <button
                                  key={ratio.value}
                                  onClick={() => onUpdateProperty?.(node.id, "aspect_ratio", ratio.value)}
                                  className={`flex flex-col items-center justify-center py-2 rounded-lg gap-1 transition-all border ${
                                    isActive
                                      ? "bg-rose-500/20 border-rose-500/40 shadow-lg shadow-rose-500/10"
                                      : "bg-white/[0.01] border-transparent hover:bg-white/5 hover:border-white/10"
                                  }`}
                                >
                                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-rose-300" : "text-gray-600"}`} />
                                  <span className={`text-[8px] font-bold ${isActive ? "text-rose-300" : "text-gray-500"}`}>{ratio.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Resolution */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">清晰度</label>
                          <div className="flex gap-1.5" data-node-action="true">
                            {VIDEO_RESOLUTIONS.map(res => (
                              <button
                                key={res}
                                onClick={() => onUpdateProperty?.(node.id, "resolution", res)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  (node.properties.resolution || "720P") === res
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/10"
                                    : "bg-white/[0.02] text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-400"
                                }`}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center ml-1">
                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">视频时长</label>
                            <span className="text-[10px] font-mono text-rose-400">{node.properties.duration || "5s"}</span>
                          </div>
                          <div className="px-1" data-node-action="true">
                            <input 
                              type="range" 
                              min="1" 
                              max="10" 
                              step="1"
                              value={parseInt(node.properties.duration || "5")}
                              onChange={(e) => onUpdateProperty?.(node.id, "duration", `${e.target.value}s`)}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                          </div>
                        </div>

                        {/* Audio & Quantity */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">生成音频</label>
                            <div className="flex gap-1" data-node-action="true">
                              {["开启", "关闭"].map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => onUpdateProperty?.(node.id, "audio", opt === "开启")}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                    (node.properties.audio === undefined ? opt === "开启" : (node.properties.audio ? opt === "开启" : opt === "关闭"))
                                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                      : "bg-white/[0.02] text-gray-500 border-transparent hover:bg-white/5"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">视频数量</label>
                            <div className="flex gap-1" data-node-action="true">
                              {VIDEO_QUANTITIES.map(q => (
                                <button
                                  key={q}
                                  onClick={() => onUpdateProperty?.(node.id, "quantity", q)}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                    (node.properties.quantity || "1个") === q
                                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                      : "bg-white/[0.02] text-gray-500 border-transparent hover:bg-white/5"
                                  }`}
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            {/* Model Selection & Action Button merged into one row */}
            <div className="flex items-center gap-2">
              <div 
                className="flex-1" 
                data-node-action="true"
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Select
                  value={node.properties.model}
                  onChange={(value) => onUpdateProperty?.(node.id, "model", value)}
                  className="w-full custom-select"
                  styles={{ popup: { root: { backgroundColor: "#1c2230", border: "1px solid rgba(255, 255, 255, 0.1)" } } }}
                  variant="filled"
                  getPopupContainer={(trigger) => trigger.parentElement}
                  options={
                    node.type === "text_node" ? [
                      { value: "deepseek-chat", label: <div className="flex items-center gap-2"><MessageSquare className="w-3 h-3 text-cyan-400" /> DeepSeek Chat</div> },
                      { value: "deepseek-reasoner", label: <div className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-indigo-400" /> DeepSeek Reasoner</div> },
                    ] : node.type === "image_node" ? [
                      { value: "flux-1", label: <div className="flex items-center gap-2"><Wand2 className="w-3 h-3 text-indigo-400" /> Flux.1 Pro</div> },
                      { value: "sdxl", label: <div className="flex items-center gap-2"><ImageIcon className="w-3 h-3 text-cyan-400" /> SDXL Turbo</div> },
                      { value: "midjourney", label: <div className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-400" /> Midjourney v6</div> },
                      { value: "dall-e-3", label: <div className="flex items-center gap-2"><ImageIcon className="w-3 h-3 text-violet-400" /> DALL-E 3</div> },
                    ] : [
                      { value: "sora", label: <div className="flex items-center gap-2"><VideoIcon className="w-3 h-3 text-indigo-400" /> Sora</div> },
                      { value: "runway-gen3", label: <div className="flex items-center gap-2"><Play className="w-3 h-3 text-cyan-400" /> Runway Gen-3</div> },
                      { value: "luma", label: <div className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-400" /> Luma Dream</div> },
                      { value: "kling", label: <div className="flex items-center gap-2"><VideoIcon className="w-3 h-3 text-violet-400" /> Kling AI</div> },
                    ]
                  }
                  style={{ 
                    backgroundColor: "#0d1117",
                    borderRadius: "12px",
                  }}
                />
              </div>

              <motion.button
                data-node-action="true"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRun}
                disabled={isRunning || (!upstreamPrompt && !node.properties.text?.trim())}
                title={upstreamPrompt ? `由上游 ${upstreamPrompt.key} 提供输入` : "需要先输入提示词"}
                className={`h-[38px] px-4 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wider transition-all shrink-0 ${
                  isRunning
                    ? "bg-indigo-500/10 text-indigo-400 cursor-not-allowed border border-indigo-500/20"
                    : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.4)] cursor-pointer"
                }`}
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    {node.type === "text_node" ? <Cpu className="w-3.5 h-3.5" /> : node.type === "image_node" ? <ImageIcon className="w-3.5 h-3.5" /> : <VideoIcon className="w-3.5 h-3.5" />}
                    <span>{node.type === "text_node" ? "生成" : node.type === "image_node" ? "绘制" : "创作"}</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        )}
        {/* Footer Ports & Metadata - Only show for non-text/generative nodes */}
        {node.type !== "text_node" && node.type !== "image_node" && node.type !== "video_node" && (
          <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-3">
            {node.inputs.map((input) => (
              <div key={`${node.id}_input_${input.name}`} className="flex items-center gap-3 group/port">
                <div className="relative">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  </div>
                  <div className="absolute inset-0 bg-emerald-400 blur-sm opacity-0 group-hover/port:opacity-40 transition-opacity" />
                </div>
                <div className="flex flex-col -space-y-0.5">
                  <span className="text-[12px] text-gray-200 font-bold tracking-tight">{input.name}</span>
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{input.type}</span>
                </div>
              </div>
            ))}
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-600 uppercase tracking-tighter">
                  <div className="w-1 h-1 rounded-full bg-gray-700" />
                  In: <span className="text-gray-400">{node.inputs.length}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-600 uppercase tracking-tighter">
                  <div className="w-1 h-1 rounded-full bg-gray-700" />
                  Out: <span className="text-gray-400">{node.outputs.length}</span>
                </div>
              </div>
              
              {node.outputs.length > 0 && (
                <div className="flex items-center gap-2 group/port-out">
                  <div className="flex flex-col -space-y-0.5 text-right">
                    <span className="text-[12px] text-gray-200 font-bold tracking-tight">{node.outputs[0].name}</span>
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{node.outputs[0].type}</span>
                  </div>
                  <div className="relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]" />
                    </div>
                    <div className="absolute inset-0 bg-indigo-400 blur-sm opacity-0 group-hover/port-out:opacity-40 transition-opacity" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const NodeCard = React.memo(
  NodeCardImpl,
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default NodeCard;
