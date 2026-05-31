import React from "react";
import { ArrowUpRight, Check, Image as ImageIcon, PlaySquare, Sparkles, X } from "lucide-react";

interface TemplateCenterProps {
  activePresetId: string;
  onSelectPreset: (id: string) => void;
  onClose: () => void;
}

interface TemplateMetadata {
  id: string;
  category: "文生图" | "文生文" | "文生视频";
  badge: string;
  nodesCount: number;
  flowDirection: string;
  accentColor: string;
  hoverColor: string;
  description: string;
  targetIcon: React.ComponentType<{ className?: string }>;
}

const TEMPLATE_INFO: TemplateMetadata[] = [
  {
    id: "txt2img",
    category: "文生图",
    badge: "Stable 扩散链",
    nodesCount: 5,
    flowDirection: "正向提示词 -> KSampler -> VAE 解码",
    accentColor: "border-[#8b5cf6] text-[#8b5cf6] bg-[#8b5cf6]/10",
    hoverColor: "hover:border-[#8b5cf6]/50 hover:shadow-[#8b5cf6]/10",
    description: "经典文生图流程，组合提示词与采样参数，快速得到高质量图像输出。",
    targetIcon: ImageIcon,
  },
  {
    id: "txt2txt",
    category: "文生文",
    badge: "Gemini 深度推理",
    nodesCount: 4,
    flowDirection: "输入主题 -> 创意模板 -> Gemini 推理",
    accentColor: "border-[#84cc16] text-[#84cc16] bg-[#84cc16]/10",
    hoverColor: "hover:border-[#84cc16]/50 hover:shadow-[#84cc16]/10",
    description: "将简短想法扩展为结构化高质量文本，支持风格化创作与润色。",
    targetIcon: Sparkles,
  },
  {
    id: "txt2vid",
    category: "文生视频",
    badge: "时序光流合成",
    nodesCount: 5,
    flowDirection: "时序提示词 -> FPS/时长 -> 视频合成",
    accentColor: "border-[#f43f5e] text-[#f43f5e] bg-[#f43f5e]/10",
    hoverColor: "hover:border-[#f43f5e]/50 hover:shadow-[#f43f5e]/10",
    description: "通过提示词和时间参数生成可播放的视频结果，支持预览与参数迭代。",
    targetIcon: PlaySquare,
  },
];

export default function TemplateCenter({
  activePresetId,
  onSelectPreset,
  onClose,
}: TemplateCenterProps) {
  return (
    <div
      className="absolute top-5 left-1/2 -translate-x-1/2 z-50 w-[760px] max-w-[92vw] bg-[#161a24]/95 backdrop-blur-md border border-[#2a3040] rounded-xl p-4 shadow-2xl flex flex-col gap-3 text-xs"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[#252c3a] pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-extrabold text-white tracking-wide">旗舰多模态标准工作流导航仓</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-[#222735] text-gray-300 px-2 py-1 rounded border border-[#313a4f]">
            一键注入完整拓扑
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
            title="关闭模板面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-[#8e96aa] text-[12px] leading-relaxed">
        内置三套核心工作流模板。点击卡片后会将节点和连线加载到画布，随后点击顶部
        <strong className="text-white"> 运行 </strong>
        即可执行。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
        {TEMPLATE_INFO.map((tpl) => {
          const Icon = tpl.targetIcon;
          const isActive = activePresetId === tpl.id;

          return (
            <button
              key={tpl.id}
              onClick={() => onSelectPreset(tpl.id)}
              className={`group flex flex-col text-left rounded-xl p-3 bg-[#101521]/90 border transition-all duration-300 relative outline-none ${
                isActive
                  ? "border-[#4f46e5] shadow-[0_0_18px_rgba(79,70,229,0.35)]"
                  : `border-[#2a3040] ${tpl.hoverColor}`
              }`}
            >
              {isActive && (
                <div className="absolute -top-1.5 -right-1.5 bg-[#4f46e5] text-white p-0.5 rounded-full ring-2 ring-[#161a24]">
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                </div>
              )}

              <div className="flex items-center justify-between w-full pb-2 border-b border-[#252c3a]">
                <div className="flex items-center gap-1.5">
                  <div className={`p-1.5 rounded-md ${tpl.accentColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-gray-100 text-sm">{tpl.category}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b2232] border border-[#313a4f] text-gray-300">
                  {tpl.nodesCount} 节点
                </span>
              </div>

              <span className="mt-2 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[#20283a] text-indigo-300 w-fit">
                {tpl.badge}
              </span>

              <p className="text-[11px] text-gray-300 leading-relaxed mt-2 min-h-[48px]">{tpl.description}</p>

              <div className="mt-2 pt-2 border-t border-[#252c3a] text-[10px] text-gray-400 truncate">
                {tpl.flowDirection}
              </div>

              <div className="mt-2 flex items-center justify-between w-full text-[11px]">
                <span className={isActive ? "text-indigo-300" : "text-gray-400 group-hover:text-white"}>
                  {isActive ? "当前已加载" : "点击加载模板"}
                </span>
                <ArrowUpRight className={isActive ? "w-3.5 h-3.5 text-indigo-300" : "w-3.5 h-3.5 text-gray-500"} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

