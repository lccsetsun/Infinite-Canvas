import { LayoutGrid, Plus } from "lucide-react";

interface EmptyCanvasStateProps {
  onDismiss: () => void;
}

export default function EmptyCanvasState({ onDismiss }: EmptyCanvasStateProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center backdrop-blur-xl shadow-2xl">
          <LayoutGrid className="w-10 h-10 text-indigo-400 opacity-80" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white/90 tracking-tight">准备好开始创作了吗？</h2>
          <p className="text-gray-400 text-sm">点击下方按钮或使用左侧工具栏开启你的第一个画布</p>
        </div>
        <button
          data-no-canvas-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="pointer-events-auto px-8 py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-xl shadow-indigo-500/25 active:scale-95 flex items-center gap-2.5 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          新建画布
        </button>
      </div>
    </div>
  );
}
