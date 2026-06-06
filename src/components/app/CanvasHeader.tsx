import React from "react";
import { motion } from "motion/react";
import HeaderRightPanel from "./HeaderRightPanel";

interface CanvasHeaderProps {
  username?: string;
  onOpenApiSettings?: () => void;
  onLogout?: () => void;
}

export default function CanvasHeader({
  username = "lccsetsun",
  onOpenApiSettings,
  onLogout,
}: CanvasHeaderProps) {
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
          className="group relative flex h-14 cursor-default items-center overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(18,23,35,0.92),rgba(12,16,25,0.82))] px-6 backdrop-blur-2xl transition-all duration-700 hover:border-white/12"
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
      </div>

      <HeaderRightPanel
        username={username}
        onOpenApiSettings={onOpenApiSettings}
        onLogout={onLogout}
      />
    </motion.header>
  );
}
