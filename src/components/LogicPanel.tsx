import LogPanel from "./LogPanel";
import { ExecutionLog } from "../types";
import { motion } from "motion/react";
import { X, Trash2, Search } from "lucide-react";

interface LogicPanelProps {
  logs: ExecutionLog[];
  onClose: () => void;
  onClear?: () => void;
}

export default function LogicPanel({
  logs,
  onClose,
  onClear,
}: LogicPanelProps) {
  return (
    <motion.aside 
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute right-4 top-20 bottom-16 z-40 w-[340px] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b0e14]/90 backdrop-blur-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {/* Pro Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h2 className="text-[13px] font-bold text-white uppercase tracking-widest opacity-80">控制台</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 font-mono">
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onClear && (
            <button 
              onClick={onClear}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all cursor-pointer"
              title="清空日志"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-500 hover:text-rose-400 transition-all cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Search/Filter Bar (Visual Placeholder) */}
      <div className="px-4 py-2 bg-black/20 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-gray-600" />
        <input 
          type="text" 
          placeholder="搜索日志..." 
          className="bg-transparent border-none text-[11px] text-gray-400 outline-none w-full placeholder:text-gray-700"
          readOnly
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-2">
        <LogPanel logs={logs} />
      </div>

      {/* Footer info */}
      <div className="px-5 py-2.5 border-t border-white/[0.03] bg-black/20 flex items-center justify-between text-[9px] text-gray-600 font-bold uppercase tracking-tighter">
        <span>状态: 就绪</span>
        <span>v1.0.4-pro</span>
      </div>
    </motion.aside>
  );
}
