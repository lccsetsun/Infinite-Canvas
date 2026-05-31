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
  const activeRect = activeNodeId ? config.nodeRects.find((r) => r.id === activeNodeId) : config.nodeRects[0] ?? null;

  return (
    <div
      className="absolute left-3 bottom-13 z-30 w-[220px] h-[150px] rounded-[18px] border border-[#2a3143] bg-[#171e2d]/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.38)]"
      onPointerDown={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.querySelector(".minimap-content")?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldX = (x - config.offsetX) / config.scale + config.minX;
        const worldY = (y - config.offsetY) / config.scale + config.minY;
        onJumpToWorldPos(worldX, worldY);
      }}
    >
      <div className="minimap-content h-full w-full rounded-[12px] bg-[#0f1730] border border-[#2b3a5a] relative overflow-hidden cursor-crosshair">
        {config.nodeRects.map((r) => (
          <div
            key={`mini_${r.id}`}
            className="absolute rounded-[2px] bg-[#4e53bd]/72 hover:bg-[#6c71e0] transition-colors cursor-pointer"
            style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectNode(r.id);
              onScrollToNode(r.id);
            }}
          />
        ))}

        {activeRect && (
          <div
            className="absolute rounded-[4px] border border-cyan-300/90 bg-[#7d85f3] shadow-[0_0_12px_rgba(125,133,243,0.65)] pointer-events-none"
            style={{
              left: activeRect.left,
              top: activeRect.top,
              width: activeRect.width,
              height: activeRect.height,
            }}
          />
        )}

        {config.viewportRect && (
          <div
            className="absolute border border-indigo-400/40 bg-indigo-400/5 pointer-events-none rounded-sm"
            style={{
              left: config.viewportRect.left,
              top: config.viewportRect.top,
              width: config.viewportRect.width,
              height: config.viewportRect.height,
            }}
          />
        )}

        <span className="absolute right-3 bottom-2 text-[10px] tracking-wider text-gray-500/90 font-semibold">地图</span>
      </div>
    </div>
  );
}
