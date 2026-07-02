import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Box, Replace, X } from "lucide-react";
import { GroupBox } from "../../types";
import {
  getReadableCanvasOverlayScale,
  mediaNodeFloatingToolbarClass,
  mediaNodeToolbarButtonClass,
  mediaNodeToolbarDividerClass,
} from "../canvas/mediaNodeToolbarStyles";

const DEFAULT_GROUP_COLOR = "#6366f1";
const GROUP_COLOR_SWATCHES = [
  null,
  "#ff3b35",
  "#ff9810",
  "#ffcb14",
  "#34c759",
  "#35d0c8",
  "#148bff",
  "#5b5ce2",
  "#ff2d94",
  "#9ca0a6",
] as const;
const MIN_GROUP_WIDTH = 120;
const MIN_GROUP_HEIGHT = 90;

type ResizeCorner = "nw" | "ne" | "sw" | "se";

interface GroupsLayerProps {
  groups: GroupBox[];
  pan: { x: number; y: number };
  zoom: number;
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  batchReplacementSourceCountByGroup?: Map<string, number>;
  memberCountByGroup: Map<string, number>;
  onSelectGroup?: (groupId: string) => void;
  onCreateBatchReplacement?: (groupId: string) => void;
  onChangeGroupColor?: (groupId: string, color?: string) => void;
  onUngroup?: (groupId: string) => void;
  onMoveGroup?: (groupId: string, x: number, y: number) => void;
  onResizeGroup?: (
    groupId: string,
    rect: Pick<GroupBox, "x" | "y" | "width" | "height">
  ) => void;
  isGroupDragging?: boolean;
  isRunning?: boolean;
}

interface DragState {
  groupId: string;
  startX: number;
  startY: number;
  pointerStartX: number;
  pointerStartY: number;
}

interface ResizeState {
  corner: ResizeCorner;
  groupId: string;
  groupStart: Pick<GroupBox, "x" | "y" | "width" | "height">;
  pointerStartX: number;
  pointerStartY: number;
}

function getResizedGroupRect(resize: ResizeState, clientX: number, clientY: number, zoom: number) {
  const dx = (clientX - resize.pointerStartX) / zoom;
  const dy = (clientY - resize.pointerStartY) / zoom;
  const start = resize.groupStart;
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;

  if (resize.corner.includes("e")) width = Math.max(MIN_GROUP_WIDTH, start.width + dx);
  if (resize.corner.includes("s")) height = Math.max(MIN_GROUP_HEIGHT, start.height + dy);
  if (resize.corner.includes("w")) {
    width = Math.max(MIN_GROUP_WIDTH, start.width - dx);
    x = start.x + start.width - width;
  }
  if (resize.corner.includes("n")) {
    height = Math.max(MIN_GROUP_HEIGHT, start.height - dy);
    y = start.y + start.height - height;
  }

  return { x, y, width, height };
}

function GroupsLayerImpl({
  groups,
  pan,
  zoom,
  selectedGroupId,
  batchReplacementSourceCountByGroup,
  memberCountByGroup,
  onChangeGroupColor,
  onCreateBatchReplacement,
  onSelectGroup,
  onUngroup,
  onMoveGroup,
  onResizeGroup,
  isGroupDragging = false,
}: GroupsLayerProps) {
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [resize, setResize] = React.useState<ResizeState | null>(null);
  const [openColorGroupId, setOpenColorGroupId] = React.useState<string | null>(null);
  const readableOverlayScale = getReadableCanvasOverlayScale(zoom);

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

  const handleResizePointerDown = (
    e: React.PointerEvent,
    group: GroupBox,
    corner: ResizeCorner
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectGroup?.(group.id);
    setOpenColorGroupId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setResize({
      corner,
      groupId: group.id,
      groupStart: {
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
      },
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
    });
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resize) return;
    e.preventDefault();
    e.stopPropagation();
    onResizeGroup?.(resize.groupId, getResizedGroupRect(resize, e.clientX, e.clientY, zoom));
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resize) return;
    e.preventDefault();
    e.stopPropagation();
    onResizeGroup?.(resize.groupId, getResizedGroupRect(resize, e.clientX, e.clientY, zoom));
    setResize(null);
  };

  return (
    <div
      className={`absolute inset-0 origin-top-left pointer-events-none ${
        drag || resize || isGroupDragging ? "z-[44]" : "z-[24]"
      }`}
      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
    >
      <AnimatePresence>
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const memberCount = memberCountByGroup.get(group.id) ?? 0;
          const batchReplacementSourceCount = batchReplacementSourceCountByGroup?.get(group.id) ?? 0;
          const groupColor = group.color || DEFAULT_GROUP_COLOR;
          const isColorPickerOpen = openColorGroupId === group.id;
          return (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 240 }}
              className="absolute pointer-events-none"
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
              }}
            >
              <div
                className={`absolute inset-0 rounded-2xl border transition-colors pointer-events-none ${
                  isSelected ? "border-violet-300/48" : "border-white/[0.10]"
                }`}
                style={{
                  background: `linear-gradient(180deg, ${groupColor}14, ${groupColor}08)`,
                  boxShadow: `0 0 0 1px ${groupColor}22, inset 0 1px 0 0 ${groupColor}18`,
                }}
              />

              <div
                className="absolute -top-12 left-0 z-30 flex items-center gap-1.5 text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)] cursor-grab active:cursor-grabbing pointer-events-auto"
                style={{ scale: readableOverlayScale, transformOrigin: "left center" }}
                onPointerDown={(e) => {
                  onSelectGroup?.(group.id);
                  handleHeaderPointerDown(e, group);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectGroup?.(group.id);
                }}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: groupColor }}>
                  <Box className="h-3 w-3" aria-hidden="true" />
                </div>
                <span className="max-w-[160px] truncate text-[12px] font-semibold text-slate-100">
                  {group.title}
                </span>
                <span className="shrink-0 text-[11px] font-semibold" style={{ color: groupColor }}>
                  {memberCount}个节点
                </span>
              </div>

              {isSelected && (
                <>
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => {
                    const isLeft = corner.includes("w");
                    const isTop = corner.includes("n");
                    const cursorClass = corner === "nw" || corner === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize";
                    return (
                      <button
                        key={corner}
                        type="button"
                        data-group-action="true"
                        aria-label="调整分组尺寸"
                        title="调整分组尺寸"
                        className={`pointer-events-auto absolute z-40 grid h-7 w-7 place-items-center text-slate-200/82 transition hover:text-white ${cursorClass} ${
                          isLeft ? "-left-3.5" : "-right-3.5"
                        } ${isTop ? "-top-3.5" : "-bottom-3.5"}`}
                        style={{
                          scale: readableOverlayScale,
                          transformOrigin: `${isLeft ? "right" : "left"} ${
                            isTop ? "bottom" : "top"
                          }`,
                        }}
                        onPointerDown={(e) => handleResizePointerDown(e, group, corner)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        onPointerCancel={handleResizePointerUp}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-[3px] bg-slate-100/90 shadow-[0_0_10px_rgba(255,255,255,0.18)]"
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}

                <div
                  data-group-action="true"
                  className={`pointer-events-auto ${mediaNodeFloatingToolbarClass}`}
                  style={{ scale: readableOverlayScale, transformOrigin: "bottom center" }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    className={mediaNodeToolbarButtonClass}
                    title="设置组背景色"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenColorGroupId((current) => (current === group.id ? null : group.id));
                    }}
                  >
                    <span
                      className="h-5 w-5 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_0_18px_rgba(20,139,255,0.18)]"
                      style={{ background: groupColor }}
                    />
                  </button>
                  {batchReplacementSourceCount > 0 && (
                    <>
                      <div className={mediaNodeToolbarDividerClass} />
                      <button
                        type="button"
                        className={`${mediaNodeToolbarButtonClass} w-auto gap-1.5 px-3 text-[12px] font-semibold text-slate-200/88 hover:text-white`}
                        title={`批量替换 ${batchReplacementSourceCount} 张图`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onCreateBatchReplacement?.(group.id);
                          setOpenColorGroupId(null);
                        }}
                      >
                        <Replace className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="whitespace-nowrap">批量替换</span>
                      </button>
                    </>
                  )}
                  <div className={mediaNodeToolbarDividerClass} />
                  <button
                    type="button"
                    className={`${mediaNodeToolbarButtonClass} w-auto gap-1.5 px-3 text-[12px] font-semibold text-slate-200/88 hover:text-white`}
                    title="解组"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUngroup?.(group.id);
                      setOpenColorGroupId(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="whitespace-nowrap">解组</span>
                  </button>
                  {isColorPickerOpen && (
                    <div
                      className="absolute left-1/2 top-[calc(100%+12px)] z-[80] grid w-[276px] -translate-x-1/2 grid-cols-5 justify-items-center gap-4 rounded-[14px] border border-white/10 bg-[#242424]/98 p-5 shadow-[0_18px_42px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      {GROUP_COLOR_SWATCHES.map((color, index) => {
                        const isDefault = color === null;
                        const swatchColor = color ?? "#303030";
                        const isActive = isDefault ? !group.color : groupColor === color;
                        return (
                          <button
                            key={color ?? "default"}
                            type="button"
                            className={`relative grid h-9 w-9 place-items-center rounded-full transition ${
                              isActive ? "ring-2 ring-[#148bff] ring-offset-4 ring-offset-[#242424]" : ""
                            }`}
                            title={isDefault ? "默认颜色" : `设置为颜色 ${index}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onChangeGroupColor?.(group.id, color ?? undefined);
                              setOpenColorGroupId(null);
                            }}
                          >
                            <span className="h-9 w-9 rounded-full" style={{ background: swatchColor }} />
                            {isDefault && (
                              <span className="absolute h-10 w-0.5 rotate-[-45deg] rounded-full bg-rose-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const GroupsLayer = React.memo(GroupsLayerImpl);
export default GroupsLayer;
