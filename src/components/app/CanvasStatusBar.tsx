interface CanvasStatusBarProps {
  linkCount: number;
  nodeCount: number;
  zoom: number;
}

export default function CanvasStatusBar({ linkCount, nodeCount, zoom }: CanvasStatusBarProps) {
  return (
    <div className="absolute right-6 bottom-4 z-30 px-3 py-1.5 rounded-full border border-[#2b3142] bg-[#1c2230]/80 backdrop-blur-md text-[10px] text-gray-400 inline-flex items-center gap-3 shadow-lg select-none">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
        <span className="font-medium tracking-tight">缩放</span>
        <span className="text-indigo-300 font-bold">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="w-px h-3 bg-[#2b3142]" />
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">节点</span>
          <span className="text-emerald-400 font-bold">{nodeCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">连线</span>
          <span className="text-cyan-400 font-bold">{linkCount}</span>
        </div>
      </div>
    </div>
  );
}
