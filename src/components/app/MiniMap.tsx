import { motion } from "motion/react";

export interface MiniMapConfig {
  minX: number;
  minY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  nodeRects: Array<{
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
  viewportRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

interface MiniMapProps {
  activeNodeId?: string | null;
  config: MiniMapConfig;
  onJumpToWorldPos: (x: number, y: number) => void;
  onScrollToNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export default function MiniMap({ activeNodeId, config, onJumpToWorldPos, onScrollToNode, onSelectNode }: MiniMapProps) {
  const activeRect = activeNodeId ? config.nodeRects.find((rect) => rect.id === activeNodeId) : config.nodeRects[0] ?? null;

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.22, duration: 0.28 }}
      className="minimap-content absolute bottom-[76px] left-4 z-30 h-[144px] w-[212px] overflow-hidden rounded-[18px] border border-violet-200/[0.10] bg-[#151d2b]/88 shadow-[0_16px_34px_-24px_rgba(8,13,24,0.96),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl"
      onPointerDown={(event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const worldX = (x - config.offsetX) / config.scale + config.minX;
        const worldY = (y - config.offsetY) / config.scale + config.minY;
        onJumpToWorldPos(worldX, worldY);
      }}
    >
      {config.nodeRects.map((rect) => (
        <div
          key={`mini_${rect.id}`}
          className="absolute cursor-pointer rounded-[2px] bg-[#5962d1]/58 transition-colors hover:bg-[#7480f0]"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelectNode(rect.id);
            onScrollToNode(rect.id);
          }}
        />
      ))}

      {activeRect ? (
        <div
          className="pointer-events-none absolute rounded-[4px] border border-cyan-300/80 bg-[#7d85f3]/86 shadow-[0_0_12px_rgba(125,133,243,0.6)]"
          style={{
            left: activeRect.left,
            top: activeRect.top,
            width: activeRect.width,
            height: activeRect.height,
          }}
        />
      ) : null}

      {config.viewportRect ? (
        <div
          className="pointer-events-none absolute rounded-sm border border-indigo-300/22"
          style={{
            left: config.viewportRect.left,
            top: config.viewportRect.top,
            width: config.viewportRect.width,
            height: config.viewportRect.height,
          }}
        />
      ) : null}
    </motion.div>
  );
}
