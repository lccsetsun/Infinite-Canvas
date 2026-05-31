import { Boxes, KeyRound, Plus, SlidersHorizontal, X } from "lucide-react";

interface FloatingToolbarProps {
  menuOpen: boolean;
  activeTool: "api" | "workflow" | "templates" | null;
  onOpenQuickMenu: () => void;
  onCloseQuickMenu: () => void;
  onScheduleQuickMenuClose: () => void;
  onOpenApi: () => void;
  onOpenWorkflow: () => void;
  onOpenTemplates: () => void;
}

export default function FloatingToolbar({
  menuOpen,
  activeTool,
  onOpenQuickMenu,
  onCloseQuickMenu,
  onScheduleQuickMenuClose,
  onOpenApi,
  onOpenWorkflow,
  onOpenTemplates,
}: FloatingToolbarProps) {
  return (
    <div className="absolute left-4 top-8 z-[70] w-[74px] rounded-[32px] border border-[#243056] bg-gradient-to-b from-[#0f1736] to-[#0d1330] shadow-[0_10px_28px_rgba(20,36,92,0.58)] p-2.5 flex flex-col items-center gap-2.5">
      <button
        data-no-canvas-drag="true"
        onMouseEnter={(e) => {
          e.stopPropagation();
          onOpenQuickMenu();
        }}
        onMouseLeave={onScheduleQuickMenuClose}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (menuOpen) onCloseQuickMenu();
          else onOpenQuickMenu();
        }}
        className="w-14 h-14 rounded-full bg-white text-black grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.33)]"
        title={menuOpen ? "关闭画布自由生成菜单" : "画布自由生成"}
      >
        {menuOpen ? <X className="w-6 h-6 text-black stroke-[2.6]" /> : <Plus className="w-6 h-6 text-black stroke-[2.6]" />}
      </button>

      <button
        data-no-canvas-drag="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenApi();
        }}
        className={`w-12 h-12 rounded-[16px] border grid place-items-center transition-all ${
          activeTool === "api"
            ? "border-[#7a8bff] bg-[#324178] text-[#d9e2ff] shadow-[0_0_18px_rgba(122,139,255,0.45)]"
            : "border-[#324272] bg-[#1a2446] text-[#c4d0f2] hover:border-[#5b73c0]"
        }`}
        title="API 设置"
      >
        <KeyRound className="w-4.5 h-4.5" />
      </button>

      <button
        data-no-canvas-drag="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenWorkflow();
        }}
        className={`w-12 h-12 rounded-[16px] border grid place-items-center transition-all ${
          activeTool === "workflow"
            ? "border-[#9ba8ff] bg-[#7d88f7] text-white shadow-[0_0_18px_rgba(125,136,247,0.72)]"
            : "border-[#324272] bg-[#1a2446] text-[#c4d0f2] hover:border-[#5b73c0]"
        }`}
        title="工作流设置"
      >
        <SlidersHorizontal className="w-4.5 h-4.5" />
      </button>

      <button
        data-no-canvas-drag="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenTemplates();
        }}
        className={`w-12 h-12 rounded-[16px] border grid place-items-center transition-all ${
          activeTool === "templates"
            ? "border-[#9ba8ff] bg-[#7d88f7] text-white shadow-[0_0_18px_rgba(125,136,247,0.72)]"
            : "border-[#324272] bg-[#1a2446] text-[#c4d0f2] hover:border-[#5b73c0]"
        }`}
        title="节点模板"
      >
        <Boxes className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}
