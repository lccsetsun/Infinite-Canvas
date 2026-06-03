import { Eye, Grid3X3, LocateFixed, Magnet, Box } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "../common/Tooltip";

interface CanvasControlsProps {
  showGrid: boolean;
  showMiniMap: boolean;
  snapToGridEnabled: boolean;
  selectedCount: number;
  onFitView: () => void;
  onToggleGrid: () => void;
  onToggleMiniMap: () => void;
  onToggleSnapToGrid: () => void;
  onCreateGroup: () => void;
}

export default function CanvasControls({
  showGrid,
  showMiniMap,
  snapToGridEnabled,
  selectedCount,
  onFitView,
  onToggleGrid,
  onToggleMiniMap,
  onToggleSnapToGrid,
  onCreateGroup,
}: CanvasControlsProps) {
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="absolute left-4 bottom-1 z-30 flex gap-2"
    >
      <Tooltip content={showGrid ? "隐藏网格" : "显示网格"}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleGrid();
          }}
          className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors cursor-pointer ${
            showGrid ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content={snapToGridEnabled ? "关闭网格吸附" : "开启网格吸附"}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSnapToGrid();
          }}
          className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors cursor-pointer ${
            snapToGridEnabled
              ? "border-emerald-500 bg-[#17382f] text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.32)]"
              : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
          }`}
          aria-label={snapToGridEnabled ? "关闭网格吸附" : "开启网格吸附"}
        >
          <Magnet className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content="自适应居中">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onFitView();
          }}
          className="w-10 h-10 rounded-[10px] border border-indigo-500/50 bg-[#1a2030] text-gray-300 grid place-items-center transition-colors hover:border-cyan-400/70 hover:text-cyan-100 cursor-pointer"
          aria-label="自适应居中"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content={showMiniMap ? "隐藏小地图" : "显示小地图"}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMiniMap();
          }}
          className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors cursor-pointer ${
            showMiniMap ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
      </Tooltip>

      {selectedCount >= 2 && (
        <Tooltip content={`将 ${selectedCount} 个节点打组 (Shift+点击 多选)`}>
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onCreateGroup();
            }}
            className="h-10 px-3 rounded-[10px] border border-violet-500/50 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 text-violet-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Box className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-wider">打组</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-100 font-mono">
              {selectedCount}
            </span>
          </motion.button>
        </Tooltip>
      )}
    </motion.div>
  );
}
