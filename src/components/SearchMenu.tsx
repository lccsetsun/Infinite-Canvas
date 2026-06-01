import React, { useEffect, useRef } from "react";
import { FileText, Sparkles, Video, ChevronRight, Image as ImageIcon, Film } from "lucide-react";
import { NodeClass } from "../types";
import { motion } from "motion/react";

interface SearchMenuProps {
  x: number;
  y: number;
  isContextMenu?: boolean;
  onAddNode: (type: NodeClass, x: number, y: number, initialProps?: Record<string, any>) => void;
  onClose: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const MenuItem = ({ 
  onClick, 
  icon: Icon, 
  label, 
  description,
  colorClass 
}: { 
  onClick: () => void; 
  icon: any; 
  label: string; 
  description: string;
  colorClass: string;
}) => (
  <motion.button
    whileHover={{ x: 4, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
    whileTap={{ scale: 0.98 }}
    type="button"
    onClick={onClick}
    className="w-full flex items-center p-2 rounded-xl transition-all text-left group border border-transparent hover:border-white/5"
  >
    <div className={`p-2 rounded-lg bg-white/5 ${colorClass} group-hover:scale-110 transition-transform`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 ml-3">
      <div className="text-[13px] font-bold text-gray-200 group-hover:text-white transition-colors">{label}</div>
      <div className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">{description}</div>
    </div>
    <ChevronRight className="w-3.5 h-3.5 text-gray-600 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
  </motion.button>
);

export default function SearchMenu({ x, y, isContextMenu, onAddNode, onClose, onHoverStart, onHoverEnd }: SearchMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [onClose]);

  const handleSelect = (type: NodeClass) => {
    if (type === "upload_image") {
      imageInputRef.current?.click();
      return;
    }
    if (type === "upload_video") {
      videoInputRef.current?.click();
      return;
    }
    onAddNode(type, x, y);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: NodeClass) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const propKey = type === "upload_image" ? "imageUrl" : "videoUrl";
    
    onAddNode(type, x, y, { [propKey]: url });
    e.target.value = "";
    onClose();
  };

  const style: React.CSSProperties = isContextMenu
    ? { left: x, top: y }
    : { left: 96, top: 24 };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="absolute z-[110] pointer-events-auto select-none"
      style={style}
      onMouseEnter={onHoverStart}
      onMouseLeave={isContextMenu ? undefined : onHoverEnd}
    >
      {/* Hidden File Inputs */}
      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, "upload_image")} />
      <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, "upload_video")} />

      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`${isContextMenu ? "" : "ml-[12px]"} w-[280px] flex flex-col gap-4 p-5 bg-[#0d1117]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)]`}
      >
        <div className="space-y-4">
          <section>
            <div className="px-2 mb-2 flex items-center justify-between">
              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.15em] font-sans">基础节点</span>
              <div className="h-px flex-1 ml-4 bg-gradient-to-r from-indigo-500/30 to-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <MenuItem 
                onClick={() => handleSelect("text_node")} 
                icon={FileText} 
                label="文本处理" 
                description="输入提示词并获取 AI 响应" 
                colorClass="text-amber-400 group-hover:text-amber-300" 
              />
              <MenuItem 
                onClick={() => handleSelect("image_node")} 
                icon={Sparkles} 
                label="图像生成" 
                description="通过文本生成高质量图像" 
                colorClass="text-indigo-400 group-hover:text-indigo-300" 
              />
              <MenuItem 
                onClick={() => handleSelect("video_node")} 
                icon={Video} 
                label="视频创作" 
                description="生成动态视频内容" 
                colorClass="text-rose-400 group-hover:text-rose-300" 
              />
            </div>
          </section>

          <section>
            <div className="px-2 mb-2 flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.15em] font-sans">本地资源</span>
              <div className="h-px flex-1 ml-4 bg-gradient-to-r from-emerald-500/30 to-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <MenuItem 
                onClick={() => handleSelect("upload_image")} 
                icon={ImageIcon} 
                label="上传图片" 
                description="从本地导入图片素材" 
                colorClass="text-cyan-400 group-hover:text-cyan-300" 
              />
              <MenuItem 
                onClick={() => handleSelect("upload_video")} 
                icon={Film} 
                label="上传视频" 
                description="从本地导入视频素材" 
                colorClass="text-teal-400 group-hover:text-teal-300" 
              />
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
