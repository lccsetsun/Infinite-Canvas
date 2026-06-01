import { Play, Plus, Terminal, Trash2, Undo2, Redo2, FolderOpen, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "../common/Tooltip";

interface AppHeaderProps {
  showLogicPanel: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  workflowName?: string;
  workflowCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenWorkflowManager?: () => void;
  onClearCanvas: () => void;
  onRun: () => void;
  onToggleLogicPanel: () => void;
}

export default function AppHeader({
  showLogicPanel,
  canUndo,
  canRedo,
  workflowName,
  workflowCount,
  onUndo,
  onRedo,
  onOpenWorkflowManager,
  onClearCanvas,
  onRun,
  onToggleLogicPanel,
}: AppHeaderProps) {
  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="h-16 border-b border-[#232939] bg-[#171b26]/95 backdrop-blur px-4 flex items-center justify-between z-[80]"
    >
      <motion.div
        initial={{ x: -30, opacity: 0, filter: "blur(10px)" }}
        animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        className="group relative flex items-center gap-3.5 px-5 py-2.5 rounded-2xl bg-[#0d1117]/40 backdrop-blur-2xl border border-white/5 hover:border-white/10 transition-all duration-700 overflow-hidden cursor-default"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-700" />
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shadow-2xl group-hover:border-indigo-500/50 transition-all duration-500 group-hover:scale-110">
            <motion.div
              animate={{ rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-[conic-gradient(from_0deg,#6366f1,#10b981,#6366f1)] opacity-20 blur-sm"
            />
            <Plus className="w-5 h-5 text-white stroke-[2.5] relative z-10 drop-shadow-lg" />
          </div>
        </div>

        <div className="relative flex flex-col -space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">AI</span>
            <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              CANVAS
            </span>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-1 group-hover:translate-y-0">
            <div className="h-px w-3 bg-indigo-500/50" />
            <span className="text-[8px] font-bold text-indigo-400 tracking-[0.3em] uppercase">Studio Pro</span>
          </div>
        </div>

        <motion.div
          animate={{ x: ["-100%", "250%"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
          className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent -skew-x-[30deg]"
        />
      </motion.div>

      <div className="flex items-center gap-2.5">
        <Tooltip content="切换/管理工作流" position="bottom">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenWorkflowManager?.(); }}
            className="group flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-xl bg-[#0d1117]/60 hover:bg-[#0d1117] border border-white/[0.06] hover:border-indigo-500/40 transition-all duration-200 cursor-pointer"
            aria-label="工作流列表"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div className="flex flex-col items-start -space-y-0.5 min-w-0">
              <span className="text-[13px] font-bold text-gray-100 truncate max-w-[180px]">
                {workflowName ?? "未命名工作流"}
              </span>
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                {workflowCount ?? 0} 个工作流
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-300 transition-colors" />
          </button>
        </Tooltip>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
          <Tooltip content="撤销 (Ctrl+Z)" position="bottom">
            <button
              onClick={(e) => { e.stopPropagation(); onUndo?.(); }}
              disabled={!canUndo}
              className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="撤销"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="重做 (Ctrl+Shift+Z)" position="bottom">
            <button
              onClick={(e) => { e.stopPropagation(); onRedo?.(); }}
              disabled={!canRedo}
              className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="重做"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-white/10 mx-0.5" />

          <Tooltip content={showLogicPanel ? "关闭运行日志" : "查看运行日志"} position="bottom">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLogicPanel();
              }}
              className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                showLogicPanel ? "bg-indigo-500/20 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Terminal className={`w-4 h-4 ${showLogicPanel ? "animate-pulse" : ""}`} />
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-white/10 mx-0.5" />

          <Tooltip content="清除画布" position="bottom">
            <button
              onClick={onClearCanvas}
              className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRun}
          className="group relative px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold flex items-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(99,102,241,0.4)] cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Play className="w-4 h-4 relative z-10 fill-current" />
          <span className="relative z-10 tracking-wide">运行</span>
        </motion.button>
      </div>
    </motion.header>
  );
}
