import React from "react";
import { buildMentionOptions, type MentionResource } from "../../utils/inputResourceMentions";
import { ReferencePreviewCard } from "./ReferencePreviewCard";

export type MentionMenuPlacement = "above" | "below";

export interface MentionMenuLayoutInput {
  anchorBottom: number;
  anchorTop: number;
  viewportHeight: number;
  menuHeight: number;
  gap?: number;
  margin?: number;
  maxMenuHeight?: number;
  minMenuHeight?: number;
}

export function getMentionMenuLayout({
  anchorBottom,
  anchorTop,
  viewportHeight,
  menuHeight,
  gap = 8,
  margin = 16,
  maxMenuHeight = 360,
  minMenuHeight = 120,
}: MentionMenuLayoutInput): { maxHeight: number; placement: MentionMenuPlacement } {
  const belowSpace = Math.max(0, viewportHeight - anchorBottom - margin);
  const aboveSpace = Math.max(0, anchorTop - margin);
  const preferredHeight = Math.min(menuHeight, maxMenuHeight);
  const placement =
    belowSpace < preferredHeight && aboveSpace > belowSpace ? "above" : "below";
  const availableSpace = placement === "above" ? aboveSpace - gap : belowSpace - gap;
  const maxHeight = Math.max(
    Math.min(minMenuHeight, maxMenuHeight),
    Math.min(maxMenuHeight, Math.max(0, availableSpace))
  );
  return { maxHeight, placement };
}

interface InputResourceMentionMenuProps<T extends MentionResource> {
  onPick: (label: string, resource: T) => void;
  resources: T[];
}

export function InputResourceMentionMenu<T extends MentionResource>({
  onPick,
  resources,
}: InputResourceMentionMenuProps<T>) {
  const options = buildMentionOptions(resources);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = React.useState<{ maxHeight: number; placement: MentionMenuPlacement }>(
    {
      maxHeight: 360,
      placement: "below",
    }
  );

  React.useLayoutEffect(() => {
    const updateLayout = () => {
      const menuElement = menuRef.current;
      const anchorElement = menuElement?.parentElement;
      if (!menuElement || !anchorElement) return;
      const anchorRect = anchorElement.getBoundingClientRect();
      const nextLayout = getMentionMenuLayout({
        anchorBottom: anchorRect.bottom,
        anchorTop: anchorRect.top,
        menuHeight: menuElement.scrollHeight,
        viewportHeight: window.innerHeight,
      });
      setLayout((current) =>
        current.placement === nextLayout.placement && current.maxHeight === nextLayout.maxHeight
          ? current
          : nextLayout
      );
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [options.length]);

  if (options.length === 0) return null;

  return (
    <div
      ref={menuRef}
      data-node-action="true"
      className={`absolute left-0 z-50 w-[268px] overflow-y-auto rounded-[14px] border border-white/10 bg-[#111827]/96 p-2 shadow-[0_22px_56px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar ${
        layout.placement === "above" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
      }`}
      style={{ maxHeight: layout.maxHeight }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {options.map(({ label, resource }, index) => (
        <button
          key={`${label}-${resource.value}-${index}`}
          type="button"
          className="flex w-full items-center gap-3 rounded-[12px] p-2 text-left transition-colors hover:bg-white/[0.06]"
          onClick={() => onPick(label, resource)}
        >
          <ReferencePreviewCard reference={resource} index={index} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-slate-100">{label}</div>
            <div className="mt-0.5 truncate text-[11px] text-slate-400/70">{resource.title}</div>
          </div>
          <div className="shrink-0 rounded-full border border-violet-200/14 bg-violet-300/10 px-2 py-0.5 text-[11px] font-medium text-violet-100/78">
            @{label}
          </div>
        </button>
      ))}
    </div>
  );
}
