import React from "react";
import { Sparkles, Image as ImageIcon, PlaySquare, ArrowUpRight, Check, CheckCircle2 } from "lucide-react";
import { WorkflowPreset } from "../types";

interface TemplateCenterProps {
  activePresetId: string;
  onSelectPreset: (id: string) => void;
  onClose: () => void;
}

interface TemplateMetadata {
  id: string;
  category: "文生图" | "文生文" | "文生视频" | "特效处理";
  badge: string;
  nodesCount: number;
  linksCount: number;
  flowDirection: string;
  accentColor: string;
  hoverColor: string;
  description: string;
  targetIcon: React.ComponentType<any>;
}

const TEMPLATE_INFO: TemplateMetadata[] = [
  {
    id: "txt2img",
    category: "文生图",
    badge: "潜空间扩散渲染",
    nodesCount: 5,
    linksCount: 3,
    flowDirection: "正反文本提示词 ➜ KSampler ➜ VAE解码",
    accentColor: "border-[#c084fc] text-[#c084fc] bg-[#c084fc]/5",
    hoverColor: "hover:border-[#c084fc]/50 hover:shadow-[#c084fc]/10",
    description: "经典扩散管线。由高清 CLIP 正反向文本双核提示词驱动，辅以去噪步数滑动条，经由核心扩散数学采样器输出高清赛博朋克猫咪太空插画。",
    targetIcon: ImageIcon
  },
  {
    id: "txt2txt",
    category: "文生文",
    badge: "Gemini 深度推理",
    nodesCount: 4,
    linksCount: 2,
    flowDirection: "简易点子 ➜ 创意模板 ➜ Gemini推理助手 ➜ 高保真预览",
    accentColor: "border-[#a3e635] text-[#a3e635] bg-[#a3e635]/5",
    hoverColor: "hover:border-[#a3e635]/50 hover:shadow-[#a3e635]/10",
    description: "高智能语言分析。挂载大语言模型 Gemini AI，支持将输入的简白灵感进行中式绝句诗歌扩写创作，即时推理出极高素质大作。",
    targetIcon: Sparkles
  },
  {
    id: "txt2vid",
    category: "文生视频",
    badge: "时序光流帧合成",
    nodesCount: 5,
    linksCount: 3,
    flowDirection: "时序分镜提示词 ➜ FPS/秒数控制 ➜ 视频合成扩散器 ➜ html5播放器",
    accentColor: "border-[#f43f5e] text-[#f43f5e] bg-[#f43f5e]/5",
    hoverColor: "hover:border-[#f43f5e]/50 hover:shadow-[#f43f5e]/10",
    description: "视频 AIGC 多模态复合。通过分镜词控制以及帧增益、播放秒数约束算法，串联解码生成可循环播放、支持倍速的高清动态行星宇宙奇观。",
    targetIcon: PlaySquare
  }
];

export default function TemplateCenter({ activePresetId, onSelectPreset, onClose }: TemplateCenterProps) {
  return (
    <div className="absolute top-4 left-[370px] z-40 max-w-[650px] bg-[#161619]/95 backdrop-blur-md border border-[#2b2b35] rounded-lg p-4 shadow-2xl hidden xl:flex flex-col gap-3 text-[12px]">
      <div className="flex items-center justify-between border-b border-[#25252b] pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-extrabold text-white tracking-wider flex items-center gap-1.5 font-sans">
            🎨 旗舰多模态标准工作流导航仓
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-[#222] text-gray-400 px-2 py-0.5 rounded border border-[#333] font-mono hidden sm:inline">
            一键注入完整拓扑组
          </span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white font-extrabold cursor-pointer transition-colors text-sm px-1"
            title="关闭面板"
          >
            ✕
          </button>
        </div>
      </div>

      <p className="text-[#8e8e9f] text-[11px] leading-relaxed">
        我们为三个核心功能预置了完整的工业级 ComfyUI 拓扑连线模板，点击卡片一键即在画布中展现连线流，直接点击顶部 <strong className="text-white">运行工作流</strong> 即可开启实时演算和推理。
      </p>

      <div className="grid grid-cols-3 gap-3.5 mt-1">
        {TEMPLATE_INFO.map((tpl) => {
          const Icon = tpl.targetIcon;
          const isActive = activePresetId === tpl.id;

          return (
            <button
              key={tpl.id}
              onClick={() => onSelectPreset(tpl.id)}
              className={`flex flex-col text-left rounded-lg p-3 bg-[#111113]/80 border transition-all duration-300 relative select-none outline-none cursor-pointer ${
                isActive 
                  ? "border-[#3e3edd] shadow-[0_0_15px_rgba(62,62,221,0.25)] bg-[#1c1c24]/50" 
                  : `border-[#292934] ${tpl.hoverColor}`
              }`}
            >
              {/* Highlight Ring/Indicator on Loaded template card */}
              {isActive && (
                <div className="absolute -top-1.5 -right-1.5 bg-[#3e3edd] text-white p-0.5 rounded-full ring-2 ring-[#161619]">
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                </div>
              )}

              {/* Card Title Header with custom badging and layout */}
              <div className="flex items-center justify-between w-full pb-1.5 border-b border-[#25252d]">
                <div className="flex items-center gap-1.5">
                  <div className={`p-1.5 rounded-md ${tpl.accentColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-gray-100 text-[12px]">{tpl.category}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1b1b22] border border-[#2d2d3c] text-gray-400 font-mono scale-90">
                  {tpl.nodesCount}算子
                </span>
              </div>

              {/* Subtitle badge or description details */}
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[9px] px-1 py-0.2 rounded font-black bg-[#1d1d24] text-indigo-400 border border-[#2c2c38] uppercase tracking-wider scale-95">
                  {tpl.badge}
                </span>
              </div>

              <p className="text-[9.5px] text-gray-400 leading-relaxed mt-2 line-clamp-3 min-h-[42px]">
                {tpl.description}
              </p>

              {/* Connected flowchart preview route line with font mono */}
              <div className="mt-2.5 pt-2 border-t border-[#25252d] w-full text-[8px] text-gray-500 truncate font-mono">
                {tpl.flowDirection}
              </div>

              {/* Prompt to highlight actions */}
              <div className="mt-3 flex items-center justify-between w-full">
                <span className={`text-[9px] font-black uppercase text-gray-400 ${isActive ? "text-[#8a8afd]" : "text-gray-500"}`}>
                  {isActive ? "当前加载中" : "点击展现模版"}
                </span>
                <ArrowUpRight className={`w-3.5 h-3.5 ${isActive ? "text-[#8a8afd] rotate-45" : "text-gray-600 transition-transform group-hover:translate-x-0.5"}`} />
              </div>

            </button>
          );
        })}
      </div>
    </div>
  );
}
