import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Tooltip } from "./common/Tooltip";
import { AnimatePresence, motion } from "motion/react";

interface FloatingToolbarProps {
  menuOpen: boolean;
  activeTool: "workflow" | null;
  onOpenQuickMenu: () => void;
  onCloseQuickMenu: () => void;
  onScheduleQuickMenuClose: () => void;
  onOpenWorkflow: () => void;
}

export default function FloatingToolbar({
  menuOpen,
  activeTool,
  onOpenQuickMenu,
  onCloseQuickMenu,
  onScheduleQuickMenuClose,
  onOpenWorkflow,
}: FloatingToolbarProps) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute left-6 top-44 z-[110] flex w-[76px] flex-col items-center gap-4 rounded-[38px] border border-white/10 bg-[#0d1117]/80 p-2.5 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-xl"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-no-canvas-drag="true"
        onMouseEnter={(event) => {
          event.stopPropagation();
          onOpenQuickMenu();
        }}
        onMouseLeave={onScheduleQuickMenuClose}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (menuOpen) onCloseQuickMenu();
          else onOpenQuickMenu();
        }}
        className={`relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
          menuOpen
            ? "rotate-45 bg-rose-500 text-white shadow-rose-500/20"
            : "bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-500/30"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={menuOpen ? "close" : "plus"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {menuOpen ? <X className="h-7 w-7 stroke-[2.5]" /> : <Plus className="h-7 w-7 stroke-[2.5]" />}
          </motion.div>
        </AnimatePresence>

        {!menuOpen ? <div className="absolute inset-0 -z-10 animate-ping rounded-full bg-indigo-500/20" /> : null}
      </motion.button>

      <div className="h-px w-8 bg-white/5" />

      <div className="flex flex-col gap-3">
        <Tooltip content="项目设置" position="right">
          <motion.button
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.9 }}
            data-no-canvas-drag="true"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenWorkflow();
            }}
            className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border transition-all duration-300 ${
              activeTool === "workflow"
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "border-white/5 bg-white/5 text-gray-400 hover:border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </motion.button>
        </Tooltip>
      </div>
    </motion.div>
  );
}
