import { motion } from "motion/react";
import { Redo2, Trash2, Undo2 } from "lucide-react";
import { Tooltip } from "../common/Tooltip";

interface CanvasHistoryDockProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearCanvas: () => void;
}

export default function CanvasHistoryDock({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearCanvas,
}: CanvasHistoryDockProps) {
  const buttonClass =
    "grid h-10 w-10 place-items-center rounded-[13px] text-slate-300/62 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.075] hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-28 disabled:hover:translate-y-0 disabled:hover:bg-transparent";

  return (
    <motion.div
      data-node-action="true"
      initial={{ y: 20, opacity: 0, filter: "blur(8px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={{ delay: 0.18, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-[18px] border border-slate-200/8 bg-[#121723]/72 p-1.5 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/18 to-transparent" />
      <Tooltip content="撤销 (Ctrl+Z)" position="top">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={buttonClass}
          aria-label="撤销"
        >
          <Undo2 className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip content="重做 (Ctrl+Shift+Z)" position="top">
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={buttonClass}
          aria-label="重做"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </Tooltip>
      <div className="mx-1 h-5 w-px bg-slate-200/8" />
      <Tooltip content="清除画布" position="top">
        <button
          type="button"
          onClick={onClearCanvas}
          className={`${buttonClass} hover:bg-rose-500/10 hover:text-rose-200`}
          aria-label="清除画布"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </Tooltip>
    </motion.div>
  );
}
