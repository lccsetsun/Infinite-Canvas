import React, { useEffect, useRef } from "react";
import {
  ChevronRight,
  FileText,
  FileUp,
  Image as ImageIcon,
  Music2,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { GraphNode, NodeClass } from "../types";
import { getSearchMenuPosition } from "../utils/searchMenuPosition";
import { uploadCanvasFileAsNode } from "../utils/canvasFileUpload";

interface SearchMenuProps {
  x: number;
  y: number;
  isContextMenu?: boolean;
  onAddNode: (
    type: NodeClass,
    x: number,
    y: number,
    initialProps?: Record<string, unknown>
  ) => string | undefined;
  onUpdateNodeData?: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onUpdateNodeProperty?: (nodeId: string, key: string, value: unknown) => void;
  onClose: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onNotice?: (message: string) => void;
}

type SearchMenuAction = NodeClass | "upload_file";

const MenuItem = ({
  onClick,
  icon: Icon,
  label,
  description,
  colorClass,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  colorClass: string;
}) => (
  <motion.button
    whileHover={{ x: 4, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
    whileTap={{ scale: 0.98 }}
    type="button"
    onClick={onClick}
    className="group flex w-full items-center rounded-xl border border-transparent p-2 text-left transition-all hover:border-white/5"
  >
    <div className={`rounded-lg bg-white/5 p-2 ${colorClass} transition-transform group-hover:scale-110`}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="ml-3 flex-1">
      <div className="text-[13px] font-bold text-gray-200 transition-colors group-hover:text-white">
        {label}
      </div>
      <div className="text-[10px] text-gray-500 transition-colors group-hover:text-gray-400">
        {description}
      </div>
    </div>
    <ChevronRight className="h-3.5 w-3.5 -translate-x-2 text-gray-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
  </motion.button>
);

export default function SearchMenu({
  x,
  y,
  isContextMenu,
  onAddNode,
  onClose,
  onHoverStart,
  onHoverEnd,
  onNotice,
  onUpdateNodeData,
  onUpdateNodeProperty,
}: SearchMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuSize, setMenuSize] = React.useState({ width: 280, height: 520 });

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const syncMenuSize = () => {
      setMenuSize({
        width: panel.offsetWidth || 280,
        height: panel.offsetHeight || 520,
      });
    };

    syncMenuSize();

    const resizeObserver = new ResizeObserver(syncMenuSize);
    resizeObserver.observe(panel);

    return () => resizeObserver.disconnect();
  }, []);

  const handleSelect = (type: SearchMenuAction) => {
    if (type === "upload_file") {
      fileInputRef.current?.click();
      return;
    }
    onAddNode(type, x, y);
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    void uploadCanvasFileAsNode({
      file,
      position: { clientX: x, clientY: y },
      addNode: onAddNode,
      onUpdateNodeData,
      onUpdateNodeProperty,
      onNotice,
    });
    onClose();
  };

  const style: React.CSSProperties = isContextMenu
    ? getSearchMenuPosition(
        { x, y },
        menuSize,
        {
          width: typeof window === "undefined" ? 0 : window.innerWidth,
          height: typeof window === "undefined" ? 0 : window.innerHeight,
        },
        { bottomMargin: 120 }
      )
    : { left: 96, top: 24 };

  return (
    <motion.div
      ref={containerRef}
      data-no-canvas-context-menu="true"
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="pointer-events-auto absolute z-[110] select-none"
      style={style}
      onContextMenu={(event) => event.stopPropagation()}
      onMouseEnter={onHoverStart}
      onMouseLeave={isContextMenu ? undefined : onHoverEnd}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*,audio/*"
        onChange={handleFileChange}
      />

      <div
        ref={panelRef}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className={`${isContextMenu ? "" : "ml-[12px]"} flex max-h-[calc(100vh-144px)] w-[280px] flex-col gap-4 overflow-y-auto rounded-[24px] border border-white/10 bg-[#0d1117]/90 p-5 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-2xl`}
      >
        <div className="space-y-4">
          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-sans text-[10px] font-black uppercase tracking-[0.15em] text-indigo-400">
                基础节点
              </span>
              <div className="ml-4 h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
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
                icon={ImageIcon}
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
              <MenuItem
                onClick={() => handleSelect("audio_node")}
                icon={Music2}
                label="音频生成"
                description="生成语音、音乐或音效"
                colorClass="text-amber-400 group-hover:text-amber-300"
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-sans text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400">
                本地资源
              </span>
              <div className="ml-4 h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <MenuItem
                onClick={() => handleSelect("upload_file")}
                icon={FileUp}
                label="上传文件"
                description="支持图片、视频、音频文件"
                colorClass="text-cyan-400 group-hover:text-cyan-300"
              />
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
