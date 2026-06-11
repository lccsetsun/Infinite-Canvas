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
  disabled = false,
  badge,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  colorClass: string;
  disabled?: boolean;
  badge?: string;
}) => (
  <motion.button
    whileHover={disabled ? undefined : { x: 4, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
    whileTap={disabled ? undefined : { scale: 0.98 }}
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`group flex w-full items-center rounded-[11px] border border-transparent p-1.5 text-left transition-all ${
      disabled
        ? "cursor-not-allowed opacity-45"
        : "hover:border-cyan-100/10"
    }`}
  >
    <div className={`rounded-[10px] bg-slate-100/[0.055] p-1.5 ${colorClass} transition-transform group-hover:scale-110`}>
      <Icon className="h-[17px] w-[17px]" />
    </div>
    <div className="ml-2.5 min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-slate-100/90 transition-colors group-hover:text-white">
        {label}
        {badge ? (
          <span className="rounded-full border border-slate-300/10 bg-slate-100/[0.055] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="truncate text-[10px] text-slate-500 transition-colors group-hover:text-slate-400">
        {description}
      </div>
    </div>
    {!disabled ? (
      <ChevronRight className="h-3.5 w-3.5 -translate-x-2 text-gray-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    ) : null}
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
  const [menuSize, setMenuSize] = React.useState({ width: 244, height: 430 });

  useEffect(() => {
    const handlePointerDownOutside = (event: Event) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    document.addEventListener("mousedown", handlePointerDownOutside, true);
    document.addEventListener("auxclick", handlePointerDownOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
      document.removeEventListener("mousedown", handlePointerDownOutside, true);
      document.removeEventListener("auxclick", handlePointerDownOutside, true);
    };
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const syncMenuSize = () => {
      setMenuSize({
        width: panel.offsetWidth || 244,
        height: panel.offsetHeight || 430,
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
        className={`${isContextMenu ? "" : "ml-[12px]"} flex max-h-[calc(100vh-144px)] w-[244px] flex-col gap-3 overflow-y-auto rounded-[20px] border border-slate-400/10 bg-[#121923]/94 p-4 shadow-[0_24px_56px_-24px_rgba(0,0,0,0.92),0_0_34px_rgba(99,102,241,0.08),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-2xl`}
      >
        <div className="space-y-3">
          <section>
            <div className="mb-1.5 flex items-center justify-between px-1.5">
              <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">
                基础节点
              </span>
              <div className="ml-3 h-px flex-1 bg-gradient-to-r from-violet-400/25 to-transparent" />
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
                onClick={() => onNotice?.("音频生成开发中")}
                icon={Music2}
                label="音频生成"
                description="音频生成接口开发中"
                colorClass="text-amber-400"
                disabled
                badge="开发中"
              />
            </div>
          </section>

          <section>
            <div className="mb-1.5 flex items-center justify-between px-1.5">
              <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                本地资源
              </span>
              <div className="ml-3 h-px flex-1 bg-gradient-to-r from-cyan-300/25 to-transparent" />
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
