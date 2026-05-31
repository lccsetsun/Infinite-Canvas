import React, { useState, useEffect, useRef } from "react";
import { Search, Sparkles, Sliders, Type, Upload, Plus, Calculator, Image as ImageIcon, Eye, PlaySquare } from "lucide-react";
import { NodeClass } from "../types";

interface SearchMenuProps {
  x: number;
  y: number;
  onAddNode: (type: NodeClass, x: number, y: number) => void;
  onClose: () => void;
}

interface NodeDefinition {
  type: NodeClass;
  title: string;
  category: "输入" | "AI 核心" | "算数与逻辑" | "图像与视频特效" | "输出预览";
  description: string;
  icon: React.ComponentType<any>;
}

const ALL_NODES: NodeDefinition[] = [
  {
    type: "load_image",
    title: "上传图像/加载源 (Load Image)",
    category: "输入",
    description: "从本地上传任何参考图像或加载系统内置的预置插图。",
    icon: Upload
  },
  {
    type: "video_viewer",
    title: "上传视频/播放预览 (Load Video)",
    category: "输入",
    description: "从本地直接上传时序视频文件，或者接收系统视频流提供一键逐帧分析与循环播放。",
    icon: PlaySquare
  }
];

export default function SearchMenu({ x, y, onAddNode, onClose }: SearchMenuProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = ALL_NODES.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.category.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex].type);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSelect = (type: NodeClass) => {
    onAddNode(type, x, y);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-80 bg-[#1b1b1f] border border-[#2b2b35] rounded-lg shadow-2xl flex flex-col pointer-events-auto search-menu"
      style={{ left: x + 15, top: y + 15 }}
      onKeyDown={handleKeyDown}
    >
      {/* 搜索框头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2b2b35] bg-[#141416] rounded-t-lg">
        <Search className="w-4 h-4 text-[#8e8ebd]" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索算子节点名称或拼音关键字..."
          className="w-full text-xs text-gray-200 bg-transparent border-none outline-none focus:ring-0 placeholder-gray-500"
        />
        <span className="text-[10px] bg-[#222] text-gray-500 px-1.5 py-0.5 rounded border border-[#333]">ESC 关闭</span>
      </div>

      {/* 分类及匹配列表 */}
      <div className="max-h-80 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-[11px] text-gray-500 py-6 text-center">未检索到任何符合条件的算子</div>
        ) : (
          filtered.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.type}
                onClick={() => handleSelect(item.type)}
                className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded text-left transition-colors ${
                  isSelected
                    ? "bg-[#3e3edd] text-white"
                    : "hover:bg-[#25252b] text-gray-300"
                }`}
              >
                <div
                  className={`mt-0.5 p-1 rounded ${
                    isSelected ? "bg-indigo-700 text-white" : "bg-[#141416] text-[#8e8ebd]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[11.5px] font-bold truncate">{item.title}</span>
                    <span
                      className={`text-[8.5px] uppercase px-1 py-0.2 rounded font-black tracking-wider ${
                        isSelected ? "text-indigo-200" : "text-[#8a8afd] bg-[#1d1d24]"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>
                  <p
                    className={`text-[9.5px] mt-0.5 line-clamp-1 leading-snug ${
                      isSelected ? "text-indigo-100" : "text-gray-400"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
      
      {/* 底部提示 */}
      <div className="px-3 py-1.5 border-t border-[#2b2b35] bg-[#141416] rounded-b-lg flex justify-between items-center text-[9px] text-[#8e8e9f]">
        <span>双击或右击空白区域可快速召唤此菜单</span>
        <span className="text-gray-500 flex items-center gap-1 font-mono hover:text-white transition-colors">
          <Plus className="w-2.5 h-2.5" /> 快捷新建算子
        </span>
      </div>
    </div>
  );
}
