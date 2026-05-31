import React from "react";
import { Copy, X, Send, Loader2, Check, Maximize2 } from "lucide-react";
import { Tooltip } from "../common/Tooltip";
import { GraphNode } from "../../types";
import { NODE_WIDTH } from "./geometry";
import { motion, AnimatePresence } from "motion/react";

interface NodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onUpdateProperty?: (nodeId: string, key: string, value: any) => void;
  onUpdateData?: (nodeId: string, data: any) => void;
  apiConfig?: {
    baseUrl: string;
    apiKey: string;
  };
  onPreview?: (content: string) => void;
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

function NodeCardImpl({ 
  node, 
  selected, 
  onSelect, 
  onDelete, 
  onDuplicate, 
  onDragStart,
  onUpdateProperty,
  onUpdateData: _onUpdateData,
  apiConfig,
  onPreview,
  style,
}: NodeCardProps) {
  const isRunning = node.properties.status === "loading";
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.properties.response) return;
    navigator.clipboard.writeText(node.properties.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    if (!onUpdateProperty || isRunning) return;
    
    onUpdateProperty(node.id, "status", "loading");
    onUpdateProperty(node.id, "response", "");

    // Use real API if config is available
    if (apiConfig?.apiKey) {
      try {
        const baseUrl = apiConfig.baseUrl || "https://api.deepseek.com/v1";
        const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: node.properties.model || "deepseek-chat",
            messages: [
              { role: "user", content: node.properties.text }
            ],
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "无返回结果";
        
        onUpdateProperty(node.id, "response", content);
        onUpdateProperty(node.id, "status", "success");
      } catch (error: any) {
        console.error("API Call Error:", error);
        onUpdateProperty(node.id, "response", `错误: ${error.message}`);
        onUpdateProperty(node.id, "status", "error");
      }
      return;
    }

    // Fallback to simulation if no API key
    setTimeout(() => {
      const responses: Record<string, string> = {
        "gpt-4o": `[GPT-4o] 基于您的提示词 "${node.properties.text}"，我为您生成了相关的文本内容。这是一个高质量的 AI 响应。`,
        "deepseek": `[DeepSeek] 深度思考中... 已完成对 "${node.properties.text}" 的处理。DeepSeek 为您提供精准的分析结果。`,
        "claude-3.5": `[Claude 3.5] 收到。关于 "${node.properties.text}"，以下是我的详细见解和生成内容。`
      };
      
      const res = responses[node.properties.model] || "AI 已完成响应。";
      onUpdateProperty(node.id, "response", res);
      onUpdateProperty(node.id, "status", "success");
    }, 1500);
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
        onSelect();
      }}
      className={`absolute text-left rounded-xl border bg-[#131722]/95 shadow-[0_18px_44px_rgba(2,8,23,0.38)] backdrop-blur-sm transition-[border-color,box-shadow,background-color] cursor-grab active:cursor-grabbing will-change-transform ${
        selected
          ? "border-indigo-400/80 shadow-[0_0_0_1px_rgba(129,140,248,0.35),0_22px_54px_rgba(2,8,23,0.44)]"
          : "border-[#2a3040]/95"
      }`}
      style={{ width: NODE_WIDTH, ...style }}
    >
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#252c3a]">
        <span className={`text-[17px] font-semibold ${selected ? "text-white" : "text-gray-100"}`}>{node.title}</span>
        <span className="inline-flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{node.type}</span>
          <Tooltip content="复制节点">
            <button
              data-node-action="true"
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="text-gray-500 hover:text-white cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="删除节点">
            <button
              data-node-action="true"
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-gray-500 hover:text-rose-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </span>
      </div>

      <div className="px-4 py-3 min-h-[126px]">
        {/* Node Content Preview & Interactive UI */}
        {node.type === "text_node" && (
          <div className="mb-3 space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">选择模型</span>
                <select
                  data-node-action="true"
                  value={node.properties.model}
                  onChange={(e) => onUpdateProperty?.(node.id, "model", e.target.value)}
                  className="bg-[#1c2230] border border-[#2b3142] rounded px-1.5 py-0.5 text-[10px] text-indigo-300 outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="deepseek-v4-flash">DeepSeek-V4-Flash</option>
                  <option value="deepseek-chat">DeepSeek-V3</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              </div>
              <textarea
                data-node-action="true"
                value={node.properties.text}
                onChange={(e) => onUpdateProperty?.(node.id, "text", e.target.value)}
                placeholder="在此输入提示词..."
                className="w-full h-24 bg-[#0d1017] border border-[#252c3a] rounded-lg p-2.5 text-[12px] text-gray-300 outline-none focus:border-indigo-500/50 transition-all resize-none leading-relaxed placeholder:text-gray-600"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                data-node-action="true"
                onClick={handleRun}
                disabled={isRunning || !node.properties.text.trim()}
                className={`flex-1 h-8 rounded-lg flex items-center justify-center gap-2 text-[11px] font-bold transition-all ${
                  isRunning 
                    ? "bg-indigo-500/20 text-indigo-400 cursor-not-allowed" 
                    : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                }`}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    执行中...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    确认生成
                  </>
                )}
              </button>
            </div>

            {node.properties.response && (
              <div className="group/res relative p-3 rounded-lg bg-[#0d1017] border border-emerald-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">输出结果</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/res:opacity-100 transition-opacity">
                    <Tooltip content="复制内容">
                      <button
                        data-node-action="true"
                        onClick={handleCopy}
                        className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </Tooltip>
                    <Tooltip content="全屏预览">
                      <button
                        data-node-action="true"
                        onClick={() => onPreview?.(node.properties.response)}
                        className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                
                <div 
                  className="text-[11px] text-gray-300 leading-[1.6] font-sans h-[52px] overflow-hidden line-clamp-3"
                >
                  {renderMarkdown(node.properties.response)}
                </div>
              </div>
            )}
          </div>
        )}
        {node.type === "image_node" && (
          <div className="mb-3 rounded-lg overflow-hidden border border-[#252c3a] aspect-video bg-[#0d1017]">
            <img src={node.properties.imageUrl} alt="preview" className="w-full h-full object-cover opacity-80" />
          </div>
        )}
        {node.type === "upload_image" && (
          <div className="mb-3 space-y-2">
            <div className="rounded-lg overflow-hidden border border-indigo-500/30 aspect-video bg-[#0d1017] relative group/img">
              {node.properties.imageUrl ? (
                <img src={node.properties.imageUrl} alt="uploaded" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px]">待上传</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">图片资源</span>
            </div>
          </div>
        )}
        {node.type === "upload_video" && (
          <div className="mb-3 space-y-2">
            <div className="rounded-lg overflow-hidden border border-rose-500/30 aspect-video bg-[#0d1017] relative group/vid">
              {node.properties.videoUrl ? (
                <video 
                  src={node.properties.videoUrl} 
                  controls 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px]">待上传</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">视频资源</span>
            </div>
          </div>
        )}
        {node.type === "video_node" && (
          <div className="mb-3 rounded-lg border border-[#252c3a] aspect-video bg-[#0d1017] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <div className="w-8 h-8 rounded-full bg-[#1c2230] flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <span className="text-[10px]">视频节点</span>
            </div>
          </div>
        )}

        <div className="border-t border-[#252c3a] pt-3 space-y-2 min-h-[84px]">
          {node.inputs.map((input) => (
            <div key={`${node.id}_input_${input.name}`} className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-lime-400 inline-block" />
              <span className="text-[14px] text-gray-200 font-semibold">{input.name}</span>
              <span className="text-[10px] text-[#6c7da2]">({input.type})</span>
            </div>
          ))}
          {node.inputs.length === 0 && <div className="h-3" />}
        </div>
        <div className="mt-3 pt-2 border-t border-[#252c3a] flex items-center justify-between text-[10px] text-gray-400">
          <span>输入 {node.inputs.length}</span>
          <span>输出 {node.outputs.length}</span>
        </div>
      </div>

      {node.outputs.length > 0 && (
        <div className="absolute right-5 bottom-12 text-right">
          <span className="text-[10px] text-[#6c7da2] mr-2">({node.outputs[0].type})</span>
          <span className="text-[14px] text-gray-200 font-semibold">{node.outputs[0].name}</span>
        </div>
      )}
    </motion.div>
  );
}

const NodeCard = React.memo(
  NodeCardImpl,
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default NodeCard;
