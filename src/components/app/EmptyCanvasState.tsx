import { Sparkles } from "lucide-react";

interface EmptyCanvasStateProps {
  mode: "welcome" | "empty-project";
  onPrimaryAction: () => void;
}

export default function EmptyCanvasState({ mode: _mode, onPrimaryAction: _onPrimaryAction }: EmptyCanvasStateProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="animate-in fade-in zoom-in-95 duration-500 rounded-full border border-violet-200/12 bg-[#111827]/42 px-5 py-3 shadow-[0_18px_54px_-28px_rgba(124,58,237,0.72),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/12 bg-violet-300/[0.075] text-violet-100/78 shadow-[0_0_26px_rgba(139,92,246,0.16)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-200/88">
              双击画布，生成第一个节点
            </p>
            <p className="mt-0.5 text-[12px] text-slate-400/66">
              文本、图片、音频都可以从这里开始
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
