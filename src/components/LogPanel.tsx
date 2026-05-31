import { ExecutionLog } from "../types";

interface LogPanelProps {
  logs: ExecutionLog[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  return (
    <div className="border border-[#26282f] rounded-lg p-4 bg-[#171920]">
      <h2 className="text-sm font-semibold mb-3">运行日志</h2>
      <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`text-xs border rounded px-2 py-1.5 ${
              log.type === "error"
                ? "border-rose-500/40 text-rose-300"
                : log.type === "warning"
                  ? "border-amber-500/40 text-amber-300"
                  : log.type === "success"
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-[#303443] text-gray-300"
            }`}
          >
            <div className="opacity-70 mb-0.5">{log.timestamp}</div>
            <div>{log.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

