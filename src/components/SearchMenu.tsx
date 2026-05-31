import React, { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, Sparkles, Video, Upload } from "lucide-react";
import { NodeClass } from "../types";

interface SearchMenuProps {
  x: number;
  y: number;
  isContextMenu?: boolean;
  onAddNode: (type: NodeClass, x: number, y: number, initialProps?: Record<string, any>) => void;
  onClose: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

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
    onClose();
  };

  const style: React.CSSProperties = isContextMenu
    ? { left: x, top: y }
    : { left: 96, top: 16 };

  return (
    <div
      ref={containerRef}
      className="absolute z-[60] pointer-events-auto select-none"
      style={style}
      onMouseEnter={onHoverStart}
      onMouseLeave={isContextMenu ? undefined : onHoverEnd}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileChange(e, "upload_image")}
      />
      <input
        type="file"
        ref={videoInputRef}
        className="hidden"
        accept="video/*"
        onChange={(e) => handleFileChange(e, "upload_video")}
      />

      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`${isContextMenu ? "" : "ml-[16px]"} w-[252px] flex flex-col gap-3.5 p-4 bg-[#121723]/95 backdrop-blur-md border border-[#2b3142] rounded-2xl shadow-2xl`}
      >
        <div>
          <div className="text-[10px] text-[#7f8aa3] font-extrabold tracking-wider mb-2.5 uppercase font-sans">基础节点</div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleSelect("text_node")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-amber-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <FileText className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">文本</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("image_node")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-indigo-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">图片</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("video_node")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-rose-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Video className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">视频</span>
            </button>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-[#7f8aa3] font-extrabold tracking-wider mb-2.5 uppercase font-sans">上传资源</div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleSelect("upload_image")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-indigo-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Upload className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">上传图片</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("upload_video")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-rose-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Upload className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">上传视频</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
