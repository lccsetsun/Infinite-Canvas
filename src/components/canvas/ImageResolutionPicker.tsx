import React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Image } from "lucide-react";
import {
  IMAGE_RESOLUTION_PRESET_GROUPS,
  formatImageResolutionPreset,
  getImageResolutionPreset,
  type ImageAspectRatio,
  type ImageResolution,
} from "../../features/nodes/imageResolutionPresets";

interface ImageResolutionPickerProps {
  resolution: string;
  aspectRatio: string;
  onChange: (resolution: ImageResolution, aspectRatio: ImageAspectRatio) => void;
  buttonClassName?: string;
  panelAlign?: "left" | "right";
}

const PANEL_WIDTH = 344;
const PANEL_GAP = 10;
const VIEWPORT_MARGIN = 16;

function isImageResolution(value: string): value is ImageResolution {
  return IMAGE_RESOLUTION_PRESET_GROUPS.some((group) => group.resolution === value);
}

function getFallbackResolution(value: string): ImageResolution {
  return isImageResolution(value) ? value : "1K";
}

function getPanelPosition(
  anchorRect: DOMRect,
  align: "left" | "right",
  viewport: { width: number; height: number }
) {
  const maxHeight = Math.min(430, viewport.height - VIEWPORT_MARGIN * 2);
  const availableAbove = anchorRect.top - VIEWPORT_MARGIN - PANEL_GAP;
  const availableBelow = viewport.height - anchorRect.bottom - VIEWPORT_MARGIN - PANEL_GAP;
  const opensAbove = availableAbove >= Math.min(340, maxHeight) || availableAbove > availableBelow;
  const height = Math.max(260, Math.min(maxHeight, opensAbove ? availableAbove : availableBelow));
  const top = opensAbove
    ? Math.max(VIEWPORT_MARGIN, anchorRect.top - height - PANEL_GAP)
    : Math.min(viewport.height - VIEWPORT_MARGIN - height, anchorRect.bottom + PANEL_GAP);
  const preferredLeft =
    align === "right" ? anchorRect.right - PANEL_WIDTH : anchorRect.left;
  const left = Math.min(
    viewport.width - VIEWPORT_MARGIN - PANEL_WIDTH,
    Math.max(VIEWPORT_MARGIN, preferredLeft)
  );

  return { left, top, maxHeight: height };
}

export function ImageResolutionPicker({
  resolution,
  aspectRatio,
  onChange,
  buttonClassName = "",
  panelAlign = "left",
}: ImageResolutionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activeResolution, setActiveResolution] = React.useState<ImageResolution>(() =>
    getFallbackResolution(resolution)
  );
  const [position, setPosition] = React.useState({ left: 0, top: 0, maxHeight: 430 });
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) setActiveResolution(getFallbackResolution(resolution));
  }, [open, resolution]);

  React.useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(
        getPanelPosition(rect, panelAlign, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, panelAlign]);

  React.useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const activeGroup =
    IMAGE_RESOLUTION_PRESET_GROUPS.find((group) => group.resolution === activeResolution) ??
    IMAGE_RESOLUTION_PRESET_GROUPS[0];
  const selectedPreset =
    getImageResolutionPreset(resolution, aspectRatio) ?? getImageResolutionPreset("1K", "16:9");

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-node-action="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={buttonClassName}
      >
        <Image className="h-3.5 w-3.5 shrink-0 text-cyan-100/52" />
        <span className="min-w-0 truncate">
          {resolution} · {formatImageResolutionPreset(resolution, aspectRatio)}
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-300/56 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            data-node-action="true"
            data-canvas-passthrough="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            className="fixed z-[160] overflow-hidden rounded-[18px] border border-cyan-100/14 bg-[#0c121c]/96 shadow-[0_28px_74px_-26px_rgba(0,0,0,0.98),0_0_0_1px_rgba(103,232,249,0.04),inset_0_1px_0_rgba(255,255,255,0.065)] backdrop-blur-2xl"
            style={{
              left: position.left,
              top: position.top,
              width: PANEL_WIDTH,
              maxHeight: position.maxHeight,
            }}
          >
            <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(20,31,46,0.98),rgba(11,17,27,0.92))] px-3 pb-3 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/54">
                  Image Size
                </div>
                <div className="rounded-full border border-cyan-100/12 bg-cyan-100/[0.055] px-2 py-0.5 text-[11px] font-semibold text-cyan-50/82">
                  {selectedPreset?.resolution} {selectedPreset?.aspectRatio}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-[12px] border border-white/7 bg-black/18 p-1">
                {IMAGE_RESOLUTION_PRESET_GROUPS.map((group) => {
                  const isActive = group.resolution === activeResolution;
                  return (
                    <button
                      key={group.resolution}
                      type="button"
                      onClick={() => setActiveResolution(group.resolution)}
                      className={`h-8 rounded-[9px] text-[12px] font-bold transition-all ${
                        isActive
                          ? "bg-cyan-200 text-[#07111b] shadow-[0_10px_24px_-16px_rgba(103,232,249,0.9)]"
                          : "text-slate-300/70 hover:bg-white/[0.06] hover:text-slate-100"
                      }`}
                    >
                      {group.resolution}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              className="custom-scrollbar overflow-y-auto p-2.5"
              style={{ maxHeight: Math.max(180, position.maxHeight - 88) }}
            >
              <div className="grid gap-1.5">
                {activeGroup.presets.map((preset) => {
                  const isActive =
                    preset.resolution === selectedPreset?.resolution &&
                    preset.aspectRatio === selectedPreset?.aspectRatio;
                  return (
                    <button
                      key={`${preset.resolution}-${preset.aspectRatio}`}
                      type="button"
                      title={`${preset.resolution} ${preset.aspectRatio} · ${preset.width}×${preset.height}`}
                      onClick={() => {
                        onChange(preset.resolution, preset.aspectRatio);
                        setOpen(false);
                      }}
                      className={`group flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left transition-all ${
                        isActive
                          ? "bg-cyan-300/[0.13] text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "text-slate-300/78 hover:bg-white/[0.055] hover:text-slate-100"
                      }`}
                    >
                      <span className="flex h-7 min-w-[72px] items-center justify-center rounded-[9px] border border-white/8 bg-white/[0.035] text-[13px] font-bold">
                        {preset.resolution} {preset.aspectRatio}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] tabular-nums text-slate-400/88 group-hover:text-slate-200/90">
                        {preset.width}×{preset.height}
                      </span>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                          isActive
                            ? "border-cyan-200 bg-cyan-200 text-[#07111b]"
                            : "border-slate-500/24 text-transparent group-hover:border-slate-300/38"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
