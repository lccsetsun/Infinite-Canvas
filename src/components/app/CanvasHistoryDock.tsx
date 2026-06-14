import { Redo2, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "../common/Tooltip";

interface CanvasHistoryDockProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function CanvasHistoryDock({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CanvasHistoryDockProps) {
  void canUndo;
  void canRedo;
  void onUndo;
  void onRedo;
  void motion;
  void Tooltip;
  void Undo2;
  void Redo2;

  return null;

  /*
  const buttonClass =
    "grid h-8 w-8 place-items-center rounded-xl text-slate-400/90 transition-all hover:bg-violet-300/[0.065] hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500/80";

  return (
    <motion.div
      data-node-action="true"
      data-no-canvas-context-menu="true"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.18, duration: 0.28 }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-violet-200/[0.10] bg-[#151d2b]/88 px-2 py-1.5 shadow-[0_16px_34px_-24px_rgba(8,13,24,0.96),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl"
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
    </motion.div>
  );
  */
}
