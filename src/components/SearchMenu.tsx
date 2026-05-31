import React, { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, Sparkles, Video } from "lucide-react";
import { NodeClass } from "../types";

interface SearchMenuProps {
  x: number;
  y: number;
  onAddNode: (type: NodeClass, x: number, y: number) => void;
  onClose: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export default function SearchMenu({ x, y, onAddNode, onClose, onHoverStart, onHoverEnd }: SearchMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    onAddNode(type, x, y);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-[96px] top-4 z-40 pointer-events-auto select-none"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="ml-[16px] w-[252px] flex flex-col gap-3.5 p-4 bg-[#121723]/95 backdrop-blur-md border border-[#2b3142] rounded-2xl shadow-2xl"
      >
        <div>
          <div className="text-[10px] text-[#7f8aa3] font-extrabold tracking-wider mb-2.5 uppercase font-sans">画布自由生成</div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleSelect("gemini_assistant")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-amber-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <FileText className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">生成文本</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("clip_text")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-indigo-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">生成图像</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("text_to_video")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-rose-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Video className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">生成视频</span>
            </button>
          </div>
        </div>

        <div className="h-px bg-[#2b3142]" />

        <div>
          <div className="text-[10px] text-[#7f8aa3] font-extrabold tracking-wider mb-2.5 uppercase font-sans">添加资源</div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleSelect("load_image")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-indigo-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <ImageIcon className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">上传图像</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("video_viewer")}
              className="w-full flex items-center px-1.5 py-1.5 rounded-lg hover:bg-[#1b2233] text-gray-300 hover:text-white transition-all text-left group"
            >
              <span className="p-1.5 rounded-lg bg-[#1b2233] text-gray-400 group-hover:bg-[#263149] group-hover:text-rose-300 w-8 h-8 flex items-center justify-center shrink-0 mr-3 transition-colors">
                <Video className="w-4 h-4" />
              </span>
              <span className="text-[12px] font-bold">上传视频</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
