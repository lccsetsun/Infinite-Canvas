import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Box, Play, Trash2, X } from "lucide-react";
import { GroupBox } from "../../types";

interface GroupsLayerProps {
  groups: GroupBox[];
  pan: { x: number; y: number };
  zoom: number;
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  memberCountByGroup: Map<string, number>;
  onSelectGroup?: (groupId: string) => void;
  onRunGroup?: (groupId: string) => void;
  onUngroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onMoveGroup?: (groupId: string, x: number, y: number) => void;
  isRunning?: boolean;
}

interface DragState {
  groupId: string;
  startX: number;
  startY: number;
  pointerStartX: number;
  pointerStartY: number;
}

function GroupsLayerImpl({
  groups,
  pan,
  zoom,
  selectedGroupId,
  memberCountByGroup,
  onSelectGroup,
  onRunGroup,
  onUngroup,
  onDeleteGroup,
  onMoveGroup,
  isRunning,
}: GroupsLayerProps) {
  const [drag, setDrag] = React.useState<DragState | null>(null);

  const handleHeaderPointerDown = (e: React.PointerEvent, group: GroupBox) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      groupId: group.id,
      startX: group.x,
      startY: group.y,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.pointerStartX) / zoom;
    const dy = (e.clientY - drag.pointerStartY) / zoom;
    onMoveGroup?.(drag.groupId, drag.startX + dx, drag.startY + dy);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.pointerStartX) / zoom;
    const dy = (e.clientY - drag.pointerStartY) / zoom;
    onMoveGroup?.(drag.groupId, drag.startX + dx, drag.startY + dy);
    setDrag(null);
  };

  return (
    <div
      className="absolute inset-0 z-10 origin-top-left pointer-events-none"
      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
    >
      <AnimatePresence>
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const memberCount = memberCountByGroup.get(group.id) ?? 0;
          const groupColor = group.color || "#6366f1";
          return (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 240 }}
              className="absolute"
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-colors pointer-events-none ${
                  isSelected ? "border-violet-400/60" : "border-white/[0.12]"
                }`}
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${groupColor}10, transparent 60%)`,
                  boxShadow: `0 0 0 1px ${groupColor}1A, inset 0 1px 0 0 ${groupColor}14`,
                }}
              />

              <div
                className="absolute -top-3 left-4 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-[#0d1117] border border-white/10 shadow-lg cursor-grab active:cursor-grabbing pointer-events-auto"
                onPointerDown={(e) => handleHeaderPointerDown(e, group)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectGroup?.(group.id);
                }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{ background: `${groupColor}25`, color: groupColor }}
                >
                  <Box className="w-2.5 h-2.5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-200 max-w-[160px] truncate">
                  {group.title}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${groupColor}20`, color: groupColor }}
                >
                  {memberCount} 节点
                </span>
                <div className="w-px h-3 bg-white/10 mx-0.5" />
                <button
                  data-group-action="true"
                  onClick={(e) => { e.stopPropagation(); onRunGroup?.(group.id); }}
                  disabled={isRunning}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="一键重跑整组"
                >
                  <Play className="w-2.5 h-2.5" />
                  重跑
                </button>
                <button
                  data-group-action="true"
                  onClick={(e) => { e.stopPropagation(); onUngroup?.(group.id); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white text-[9px] font-black uppercase tracking-wider transition-colors"
                  title="解组"
                >
                  <X className="w-2.5 h-2.5" />
                  解组
                </button>
                <button
                  data-group-action="true"
                  onClick={(e) => { e.stopPropagation(); onDeleteGroup?.(group.id); }}
                  className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-rose-500/15 text-gray-500 hover:text-rose-400 transition-colors"
                  title="删除组"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const GroupsLayer = React.memo(GroupsLayerImpl);
export default GroupsLayer;
