import { KeyRound, Plus, SlidersHorizontal, X } from "lucide-react";
import { Tooltip } from "./common/Tooltip";
import { motion, AnimatePresence } from "motion/react";

interface FloatingToolbarProps {
  menuOpen: boolean;
  activeTool: "api" | "workflow" | null;
  onOpenQuickMenu: () => void;
  onCloseQuickMenu: () => void;
  onScheduleQuickMenuClose: () => void;
  onOpenApi: () => void;
  onOpenWorkflow: () => void;
}

export default function FloatingToolbar({
  menuOpen,
  activeTool,
  onOpenQuickMenu,
  onCloseQuickMenu,
  onScheduleQuickMenuClose,
  onOpenApi,
  onOpenWorkflow,
}: FloatingToolbarProps) {
  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute left-6 top-24 z-[70] w-[76px] rounded-[38px] border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] p-2.5 flex flex-col items-center gap-4"
    >
      <Tooltip content={menuOpen ? "关闭菜单" : "添加节点"} position="right">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          data-no-canvas-drag="true"
          onMouseEnter={(e) => {
            e.stopPropagation();
            onOpenQuickMenu();
          }}
          onMouseLeave={onScheduleQuickMenuClose}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen) onCloseQuickMenu();
            else onOpenQuickMenu();
          }}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
            menuOpen 
              ? "bg-rose-500 text-white shadow-rose-500/20 rotate-45" 
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
              {menuOpen ? <X className="w-7 h-7 stroke-[2.5]" /> : <Plus className="w-7 h-7 stroke-[2.5]" />}
            </motion.div>
          </AnimatePresence>
          
          {/* Pulsing ring when closed */}
          {!menuOpen && (
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping -z-10" />
          )}
        </motion.button>
      </Tooltip>

      <div className="w-8 h-px bg-white/5" />

      <div className="flex flex-col gap-3">
        <Tooltip content="API 设置" position="right">
          <motion.button
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.9 }}
            data-no-canvas-drag="true"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenApi();
            }}
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-300 cursor-pointer ${
              activeTool === "api"
                ? "border-indigo-400 bg-indigo-500/20 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                : "border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10"
            }`}
          >
            <KeyRound className={`w-5 h-5 transition-transform duration-500 ${activeTool === "api" ? "rotate-[360deg]" : ""}`} />
          </motion.button>
        </Tooltip>

        <Tooltip content="工作流设置" position="right">
          <motion.button
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.9 }}
            data-no-canvas-drag="true"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenWorkflow();
            }}
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-300 cursor-pointer ${
              activeTool === "workflow"
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </motion.button>
        </Tooltip>
      </div>
    </motion.div>
  );
}
