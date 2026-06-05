import React from "react";
import { FolderOpen, ChevronDown, LogOut, User } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "../common/Tooltip";

interface AppHeaderProps {
  workflowName?: string;
  workflowCount?: number;
  username?: string;
  onOpenWorkflowManager?: () => void;
  onRun: () => void;
  onLogout?: () => void;
}

export default function AppHeader({
  workflowName,
  workflowCount,
  username = "lccsetsun",
  onOpenWorkflowManager,
  onRun: _onRun,
  onLogout,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const displayName = username.trim() || "用户";
  const avatarText = displayName.slice(0, 1).toUpperCase();

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-[120] flex h-16 items-center justify-between overflow-visible border-b border-[#232939] bg-[#171b26]/95 px-4 backdrop-blur"
    >
      <div className="flex min-w-0 items-center gap-3">
        <motion.div
          initial={{ x: -30, opacity: 0, filter: "blur(10px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="group relative flex h-12 cursor-default items-center overflow-hidden rounded-2xl border border-white/5 bg-[#0d1117]/40 px-5 backdrop-blur-2xl transition-all duration-700 hover:border-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />

          <div className="relative flex items-center gap-1.5 leading-none">
            <span className="text-xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">AI</span>
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-xl font-black tracking-tighter text-transparent">
              CANVAS
            </span>
          </div>

          <motion.div
            animate={{ x: ["-100%", "250%"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
            className="absolute bottom-0 top-0 w-16 -skew-x-[30deg] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          />
        </motion.div>

        <Tooltip content="切换 / 管理项目" position="bottom">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpenWorkflowManager?.();
            }}
            className="group flex min-w-[156px] max-w-[240px] cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#0d1117]/60 py-1.5 pl-2.5 pr-3 transition-all duration-200 hover:border-indigo-500/40 hover:bg-[#0d1117]"
            aria-label="项目列表"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 transition-transform group-hover:scale-105">
              <FolderOpen className="h-3.5 w-3.5 text-indigo-300" />
            </div>
            <div className="min-w-0 -space-y-0.5">
              <span className="block max-w-[180px] truncate text-left text-[13px] font-bold text-gray-100">
                {workflowName ?? "未命名项目"}
              </span>
              <span className="block text-left font-mono text-[9px] uppercase tracking-wider text-gray-500">
                {workflowCount ?? 0} 个项目
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-colors group-hover:text-indigo-300" />
          </button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-3">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#0d1117]/65 px-3 py-2 transition-all duration-200 hover:border-white/12 hover:bg-[#111827]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.32)]">
              {avatarText || <User className="h-4 w-4" />}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <div className="max-w-[140px] truncate text-sm font-semibold text-slate-100">{displayName}</div>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] z-[120] w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/96 p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-100 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </motion.header>
  );
}
