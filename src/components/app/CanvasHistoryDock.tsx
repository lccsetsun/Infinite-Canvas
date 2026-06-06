import { Redo2, Trash2, Undo2 } from "lucide-react";
import { motion } from "motion/react";
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
    "grid h-8 w-8 place-items-center rounded-xl text-slate-500/80 transition-all hover:bg-white/[0.04] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500/80";

  return (
    <motion.div
      data-node-action="true"
      data-no-canvas-context-menu="true"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 0.58 }}
      whileHover={{ opacity: 1 }}
      transition={{ delay: 0.18, duration: 0.28 }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[#141923]/32 px-2 py-1.5 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.92)] backdrop-blur-xl"
    >
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
      <div className="mx-1 h-4 w-px bg-white/[0.06]" />
      <Tooltip content="清除画布" position="top">
        <button
          type="button"
          onClick={onClearCanvas}
          className={`${buttonClass} hover:text-rose-200`}
          aria-label="清除画布"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </Tooltip>
    </motion.div>
  );
}
