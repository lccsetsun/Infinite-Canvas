import React from "react";
import { Eye, Grid3X3, LocateFixed, Magnet } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "../common/Tooltip";

interface CanvasControlsProps {
  showGrid: boolean;
  showMiniMap: boolean;
  snapToGridEnabled: boolean;
  zoom: number;
  onFitView: () => void;
  onToggleGrid: () => void;
  onToggleMiniMap: () => void;
  onToggleSnapToGrid: () => void;
}

function ControlButton({
  active = false,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClick}
        aria-label={label}
        className={`grid h-8 w-8 cursor-pointer place-items-center rounded-xl transition-all ${
          active
            ? "bg-white/[0.08] text-slate-100"
            : "text-slate-500/80 hover:bg-white/[0.04] hover:text-slate-200"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export default function CanvasControls({
  showGrid,
  showMiniMap,
  snapToGridEnabled,
  zoom,
  onFitView,
  onToggleGrid,
  onToggleMiniMap,
  onToggleSnapToGrid,
}: CanvasControlsProps) {
  return (
    <motion.div
      data-no-canvas-context-menu="true"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 0.58 }}
      whileHover={{ opacity: 1 }}
      transition={{ delay: 0.18, duration: 0.28 }}
      className="absolute bottom-4 left-4 z-30 inline-flex items-center gap-1 rounded-2xl bg-[#141923]/32 px-2 py-1.5 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.92)] backdrop-blur-xl"
    >
      <ControlButton
        active={showGrid}
        label={showGrid ? "隐藏网格" : "显示网格"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleGrid();
        }}
      >
        <Grid3X3 className="h-4 w-4" />
      </ControlButton>

      <ControlButton
        active={snapToGridEnabled}
        label={snapToGridEnabled ? "关闭网格吸附" : "开启网格吸附"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSnapToGrid();
        }}
      >
        <Magnet className="h-4 w-4" />
      </ControlButton>

      <ControlButton
        label="自适应居中"
        onClick={(event) => {
          event.stopPropagation();
          onFitView();
        }}
      >
        <LocateFixed className="h-4 w-4" />
      </ControlButton>

      <ControlButton
        active={showMiniMap}
        label={showMiniMap ? "隐藏小地图" : "显示小地图"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMiniMap();
        }}
      >
        <Eye className="h-4 w-4" />
      </ControlButton>

      <div className="h-4 w-px bg-white/[0.06]" />

      <div className="inline-flex select-none items-center px-1 py-1 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-200">{Math.round(zoom * 100)}%</span>
      </div>
    </motion.div>
  );
}
