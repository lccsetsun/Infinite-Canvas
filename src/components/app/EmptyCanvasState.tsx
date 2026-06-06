interface EmptyCanvasStateProps {
  mode: "welcome" | "empty-project";
  onPrimaryAction: () => void;
}

export default function EmptyCanvasState({ mode: _mode, onPrimaryAction: _onPrimaryAction }: EmptyCanvasStateProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="animate-in fade-in duration-500 rounded-full border border-white/[0.06] bg-black/10 px-5 py-2.5 backdrop-blur-sm">
        <p className="text-sm font-medium tracking-[-0.01em] text-slate-400">双击画布 自由生成节点</p>
      </div>
    </div>
  );
}
