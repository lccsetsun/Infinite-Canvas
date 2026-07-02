import React from "react";
import { Box } from "lucide-react";
import type { Rect } from "../../utils/multiSelection";
import {
  getReadableCanvasOverlayScale,
  mediaNodeFloatingToolbarClass,
  mediaNodeToolbarButtonClass,
} from "../canvas/mediaNodeToolbarStyles";

interface MultiSelectionLayerProps {
  bounds?: Rect | null;
  dragRect?: Rect | null;
  canCreateGroup?: boolean;
  pan: { x: number; y: number };
  zoom: number;
  onBeginSelectionDrag?: (event: React.PointerEvent) => void;
  onCreateGroup?: () => void;
}

export default function MultiSelectionLayer({
  bounds,
  canCreateGroup = false,
  dragRect,
  pan,
  zoom,
  onBeginSelectionDrag,
  onCreateGroup,
}: MultiSelectionLayerProps) {
  const readableOverlayScale = getReadableCanvasOverlayScale(zoom);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[34] origin-top-left"
      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
    >
      {dragRect && (
        <div
          className="absolute rounded-xl bg-white/[0.035] shadow-[0_0_0_1px_rgba(15,23,42,0.4)]"
          style={{
            height: dragRect.height,
            left: dragRect.x,
            top: dragRect.y,
            width: dragRect.width,
          }}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <rect
              x={0}
              y={0}
              width={dragRect.width}
              height={dragRect.height}
              rx={12}
              fill="none"
              stroke="rgba(226,232,240,0.72)"
              strokeDasharray="8 7"
              strokeLinecap="round"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}

      {bounds && (
        <div
          className="pointer-events-auto absolute cursor-grab rounded-2xl bg-white/[0.02] shadow-[0_0_0_1px_rgba(15,23,42,0.46),inset_0_1px_0_rgba(255,255,255,0.04)] active:cursor-grabbing"
          style={{
            height: bounds.height,
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            onBeginSelectionDrag?.(event);
          }}
        >
          {canCreateGroup && (
            <div
              data-node-action="true"
              className={`pointer-events-auto ${mediaNodeFloatingToolbarClass}`}
              style={{ scale: readableOverlayScale, transformOrigin: "bottom center" }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <button
                type="button"
                className={`${mediaNodeToolbarButtonClass} w-auto gap-1.5 px-3 text-[12px] font-semibold text-slate-200/88 hover:text-white`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCreateGroup?.();
                }}
              >
                <Box className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="whitespace-nowrap">打组</span>
              </button>
            </div>
          )}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <rect
              x={0}
              y={0}
              width={bounds.width}
              height={bounds.height}
              rx={16}
              fill="none"
              stroke="rgba(226,232,240,0.82)"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
