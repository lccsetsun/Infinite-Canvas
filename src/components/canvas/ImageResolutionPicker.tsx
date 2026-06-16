import React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Image, type LucideIcon } from "lucide-react";
import {
  IMAGE_RESOLUTION_PRESET_GROUPS,
  formatImageResolutionPreset,
  getImageResolutionPreset,
  type ImageAspectRatio,
  type ImageResolution,
  type ImageResolutionPresetGroup,
} from "../../features/nodes/imageResolutionPresets";
import {
  getFloatingMenuPosition,
  type FloatingMenuPosition,
} from "../../utils/floatingMenuPosition";

interface ImageResolutionPickerProps {
  resolution: string;
  aspectRatio: string;
  onChange: (resolution: ImageResolution, aspectRatio: ImageAspectRatio) => void;
  buttonClassName?: string;
  panelAlign?: "left" | "right";
  panelLayerClassName?: string;
  panelTitle?: string;
  presetGroups?: ImageResolutionPresetGroup[];
  triggerIcon?: LucideIcon;
  disabled?: boolean;
}

const PANEL_WIDTH = 430;
const PANEL_MAX_HEIGHT = 430;
const PANEL_GAP = 10;
const PANEL_MARGIN = 16;

function isImageResolution(
  value: string,
  presetGroups: ImageResolutionPresetGroup[]
): value is ImageResolution {
  return presetGroups.some((group) => group.resolution === value);
}

function getFallbackResolution(
  value: string,
  presetGroups: ImageResolutionPresetGroup[]
): ImageResolution {
  return isImageResolution(value, presetGroups) ? value : presetGroups[0]?.resolution || "1K";
}

export function getResolutionPickerPanelTitle(panelTitle?: string) {
  return panelTitle || "Image Size";
}

function parseAspectRatioValue(aspectRatio: string) {
  const [width, height] = aspectRatio.split(":").map((value) => Number.parseFloat(value));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }
  return width / height;
}

export function getAspectRatioPreviewStyle(aspectRatio: string): React.CSSProperties {
  const ratio = parseAspectRatioValue(aspectRatio);
  const maxWidth = 30;
  const maxHeight = 22;
  if (ratio >= 1) {
    return {
      width: Math.round(maxWidth),
      height: Math.max(6, Math.round(maxWidth / ratio)),
    };
  }
  return {
    width: Math.max(6, Math.round(maxHeight * ratio)),
    height: Math.round(maxHeight),
  };
}

export function getResolutionPickerResolutionSelection(
  group: ImageResolutionPresetGroup,
  currentAspectRatio: string
): { resolution: ImageResolution; aspectRatio: ImageAspectRatio } {
  const nextPreset =
    group.presets.find((preset) => preset.aspectRatio === currentAspectRatio) ?? group.presets[0];

  return {
    resolution: group.resolution,
    aspectRatio: nextPreset?.aspectRatio ?? "16:9",
  };
}

export function getResolutionPickerPanelPosition({
  align,
  anchorRect,
  viewport,
}: {
  align: "left" | "right";
  anchorRect: DOMRect;
  viewport: { width: number; height: number };
}): FloatingMenuPosition {
  const alignedAnchorRect =
    align === "right"
      ? {
          bottom: anchorRect.bottom,
          left: anchorRect.right - PANEL_WIDTH,
          right: anchorRect.right,
          top: anchorRect.top,
          width: PANEL_WIDTH,
        }
      : {
          bottom: anchorRect.bottom,
          left: anchorRect.left,
          right: anchorRect.left + PANEL_WIDTH,
          top: anchorRect.top,
          width: PANEL_WIDTH,
        };

  return getFloatingMenuPosition({
    anchorRect: alignedAnchorRect,
    gap: PANEL_GAP,
    margin: PANEL_MARGIN,
    maxMenuHeight: PANEL_MAX_HEIGHT,
    minMenuHeight: 260,
    viewportHeight: viewport.height,
    viewportWidth: viewport.width,
  });
}

export function ImageResolutionPicker({
  resolution,
  aspectRatio,
  onChange,
  buttonClassName = "",
  panelAlign = "left",
  panelLayerClassName = "z-[160]",
  panelTitle,
  presetGroups = IMAGE_RESOLUTION_PRESET_GROUPS,
  triggerIcon: TriggerIcon = Image,
  disabled = false,
}: ImageResolutionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [committedSelection, setCommittedSelection] = React.useState(() => ({
    aspectRatio,
    resolution,
  }));
  const [activeResolution, setActiveResolution] = React.useState<ImageResolution>(() =>
    getFallbackResolution(resolution, presetGroups)
  );
  const [position, setPosition] = React.useState<FloatingMenuPosition | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const displayResolution = committedSelection.resolution;
  const displayAspectRatio = committedSelection.aspectRatio;

  React.useEffect(() => {
    setCommittedSelection({ aspectRatio, resolution });
  }, [aspectRatio, resolution]);

  React.useEffect(() => {
    if (open) setActiveResolution(getFallbackResolution(resolution, presetGroups));
  }, [open, presetGroups, resolution]);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  React.useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(
        getResolutionPickerPanelPosition({
          align: panelAlign,
          anchorRect: rect,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
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
      if (target && !buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
        event.stopPropagation();
      }
    };
    const blockCanvasWheel = (event: WheelEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("wheel", blockCanvasWheel, { capture: true, passive: false });
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("wheel", blockCanvasWheel, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const activeGroup =
    presetGroups.find((group) => group.resolution === activeResolution) ?? presetGroups[0];
  const selectedPreset =
    getImageResolutionPreset(displayResolution, displayAspectRatio, presetGroups) ??
    getImageResolutionPreset(
      presetGroups[0]?.resolution || "1K",
      activeGroup?.presets[0]?.aspectRatio || "16:9",
      presetGroups
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        data-node-action="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={buttonClassName}
      >
        <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-violet-200/58" />
        <span className="min-w-0 truncate">
          {displayResolution} ·{" "}
          {formatImageResolutionPreset(displayResolution, displayAspectRatio, presetGroups)}
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-300/56 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            data-node-action="true"
            data-canvas-passthrough="true"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            className={`fixed ${panelLayerClassName} overflow-hidden rounded-2xl border border-slate-400/16 bg-[#121923]/96 p-1.5 text-slate-100 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl`}
            style={{
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            <div
              className="px-3.5 pb-3 pt-3"
              aria-label={getResolutionPickerPanelTitle(panelTitle)}
            >
              <div className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/44">
                清晰度
              </div>
              <div className="grid grid-cols-4 gap-3">
                {presetGroups.map((group) => {
                  const isActive = group.resolution === activeResolution;
                  return (
                    <button
                      key={group.resolution}
                      type="button"
                      onClick={() => {
                        const nextSelection = getResolutionPickerResolutionSelection(
                          group,
                          displayAspectRatio
                        );
                        setActiveResolution(nextSelection.resolution);
                        setCommittedSelection(nextSelection);
                        onChange(nextSelection.resolution, nextSelection.aspectRatio);
                      }}
                      className={`h-10 rounded-xl border text-[14px] font-semibold transition-colors ${
                        isActive
                          ? "border-violet-300/24 bg-violet-500/[0.16] text-violet-50"
                          : "border-slate-400/12 text-slate-200/70 hover:border-violet-200/22 hover:bg-violet-500/[0.08] hover:text-white"
                      }`}
                    >
                      {group.resolution}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              className="custom-scrollbar overflow-y-auto px-3.5 pb-3.5"
              style={{ maxHeight: Math.max(210, position.maxHeight - 118) }}
            >
              <div className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300/44">
                比例
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(activeGroup?.presets ?? []).map((preset) => {
                  const isActive =
                    preset.resolution === selectedPreset?.resolution &&
                    preset.aspectRatio === selectedPreset?.aspectRatio;
                  return (
                    <button
                      key={`${preset.resolution}-${preset.aspectRatio}`}
                      type="button"
                      title={`${preset.resolution} ${preset.aspectRatio} · ${preset.width}×${preset.height}`}
                      onClick={() => {
                        setCommittedSelection({
                          resolution: preset.resolution,
                          aspectRatio: preset.aspectRatio,
                        });
                        onChange(preset.resolution, preset.aspectRatio);
                        setOpen(false);
                      }}
                      className={`group relative flex h-[82px] w-full flex-col items-center justify-center gap-2 rounded-xl border transition-colors ${
                        isActive
                          ? "border-violet-300/24 bg-violet-500/[0.16] text-violet-50"
                          : "border-slate-400/12 bg-slate-950/14 text-slate-200/70 hover:border-violet-200/22 hover:bg-violet-500/[0.08] hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid h-[30px] w-[38px] place-items-center rounded-[8px] ${
                          isActive ? "text-violet-50" : "text-slate-300/62 group-hover:text-white"
                        }`}
                        aria-hidden="true"
                      >
                        <span
                          className="block rounded-[3px] border-2 border-current"
                          style={getAspectRatioPreviewStyle(preset.aspectRatio)}
                        />
                      </span>
                      <span
                        className={`text-[13px] font-semibold leading-none ${
                          isActive ? "text-violet-50" : "text-slate-200/70 group-hover:text-white"
                        }`}
                      >
                        {preset.aspectRatio}
                      </span>
                      {isActive && (
                        <span className="absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full text-violet-100">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
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
