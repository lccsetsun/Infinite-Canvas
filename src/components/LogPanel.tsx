import { ExecutionLog } from "../types";
import { Terminal, Clock } from "lucide-react";

interface LogPanelProps {
  logs: ExecutionLog[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center opacity-10 grayscale select-none">
             <Terminal className="w-14 h-14 mb-4" />
             <span className="text-[10px] font-bold uppercase tracking-[0.2em]">No Active Logs</span>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`group relative p-3 rounded-xl border transition-all duration-300 ${
                log.type === "error"
                  ? "bg-rose-500/[0.03] border-rose-500/10 text-rose-200/90"
                  : log.type === "warning"
                    ? "bg-amber-500/[0.03] border-amber-500/10 text-amber-200/90"
                    : log.type === "success"
                      ? "bg-emerald-500/[0.03] border-emerald-500/10 text-emerald-200/90"
                      : "bg-white/[0.02] border-white/[0.03] text-gray-300/90 hover:bg-white/[0.05] hover:border-white/[0.08]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-60 transition-opacity">
                  <Clock className="w-3 h-3" />
                  <span className="text-[9px] font-mono tracking-tight">{log.timestamp}</span>
                </div>
                <div className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-widest ${
                  log.type === "error" ? "bg-rose-500/20 text-rose-400" :
                  log.type === "warning" ? "bg-amber-500/20 text-amber-400" :
                  log.type === "success" ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-indigo-500/20 text-indigo-400"
                }`}>
                  {log.type || 'INFO'}
                </div>
              </div>
              <div className="text-[11px] leading-relaxed font-mono break-all">{log.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

