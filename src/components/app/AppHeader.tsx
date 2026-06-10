import React from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import aiCanvasLockup from "../../assets/brand/ai-canvas-lockup.svg";
import { Tooltip } from "../common/Tooltip";
import HeaderRightPanel from "./HeaderRightPanel";

interface AppHeaderProps {
  workflowName?: string;
  workflowCount?: number;
  username?: string;
  onOpenProjectSwitcher?: () => void;
  onOpenApiSettings?: () => void;
  onRun: () => void;
  onLogout?: () => void;
  showProjectSwitcher?: boolean;
}

export default function AppHeader({
  workflowName,
  workflowCount,
  username = "lccsetsun",
  onOpenProjectSwitcher,
  onOpenApiSettings,
  onRun: _onRun,
  onLogout,
  showProjectSwitcher = true,
}: AppHeaderProps) {
  return (
    <header
      className="relative z-[120] flex h-14 items-center justify-between overflow-visible border-b border-white/[0.045] bg-[linear-gradient(180deg,rgba(14,18,28,0.94),rgba(13,17,27,0.88))] px-5 shadow-[0_10px_26px_-24px_rgba(0,0,0,0.88)] backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/12 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

      <div className="flex min-w-0 items-center gap-3">
        <div
          className="group relative flex h-12 cursor-default items-center overflow-hidden px-1 transition-all duration-500 hover:brightness-125"
        >
          <img src={aiCanvasLockup} alt="幻影AI" className="relative h-8 w-auto opacity-95 drop-shadow-[0_10px_24px_rgba(100,116,255,0.16)]" />

          <div className="pointer-events-none absolute inset-y-1 left-1/3 w-20 rounded-full bg-cyan-300/[0.025] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>

        {showProjectSwitcher ? (
          <Tooltip content="鍒囨崲 / 绠＄悊椤圭洰" position="bottom">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenProjectSwitcher?.();
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
    </header>
  );
}
