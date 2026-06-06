import React from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { motion } from "motion/react";
import aiCanvasLockup from "../../assets/brand/ai-canvas-lockup.svg";
import { Tooltip } from "../common/Tooltip";
import HeaderRightPanel from "./HeaderRightPanel";

interface AppHeaderProps {
  workflowName?: string;
  workflowCount?: number;
  username?: string;
  onOpenWorkflowManager?: () => void;
  onOpenApiSettings?: () => void;
  onRun: () => void;
  onLogout?: () => void;
  showProjectSwitcher?: boolean;
}

export default function AppHeader({
  workflowName,
  workflowCount,
  username = "lccsetsun",
  onOpenWorkflowManager,
  onOpenApiSettings,
  onRun: _onRun,
  onLogout,
  showProjectSwitcher = true,
}: AppHeaderProps) {
  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-[120] flex h-[72px] items-center justify-between overflow-visible border-b border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,20,31,0.96),rgba(19,24,36,0.9))] px-5 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/12 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

      <div className="flex min-w-0 items-center gap-3">
        <motion.div
          initial={{ x: -30, opacity: 0, filter: "blur(10px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="group relative flex h-14 cursor-default items-center overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(18,23,35,0.92),rgba(12,16,25,0.82))] px-5 backdrop-blur-2xl transition-all duration-700 hover:border-white/12"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 opacity-0 transition-opacity duration-1000 group-hover:opacity-100" />
          <img src={aiCanvasLockup} alt="AI CANVAS" className="relative h-8 w-auto opacity-95" />

          <motion.div
            animate={{ x: ["-100%", "250%"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
            className="absolute bottom-0 top-0 w-16 -skew-x-[30deg] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          />
        </motion.div>

        {showProjectSwitcher ? (
          <Tooltip content="鍒囨崲 / 绠＄悊椤圭洰" position="bottom">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenWorkflowManager?.();
              }}
              className="group flex min-w-[156px] max-w-[240px] cursor-pointer items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(17,22,33,0.88),rgba(11,15,24,0.82))] py-2 pl-2.5 pr-3 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 hover:border-indigo-500/35 hover:bg-[#0d1117]"
              aria-label="椤圭洰鍒楄〃"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-500/24 bg-gradient-to-br from-indigo-500/18 to-cyan-500/16 transition-transform group-hover:scale-105">
                <FolderOpen className="h-4 w-4 text-indigo-300" />
              </div>
              <div className="min-w-0 -space-y-0.5">
                <span className="block max-w-[180px] truncate text-left text-[13px] font-bold text-gray-100">
                  {workflowName ?? "鏈懡鍚嶉」鐩?"}
                </span>
                <span className="block text-left font-mono text-[9px] uppercase tracking-wider text-gray-500">
                  {workflowCount ?? 0} 涓」鐩?
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-colors group-hover:text-indigo-300" />
            </button>
          </Tooltip>
        ) : null}
      </div>

      <HeaderRightPanel
        username={username}
        onOpenApiSettings={onOpenApiSettings}
        onLogout={onLogout}
      />
    </motion.header>
  );
}
