import React from "react";
import { createPortal } from "react-dom";
import {
  buildMentionOptions,
  getNextMentionMenuIndex,
  type MentionResource,
} from "../../utils/inputResourceMentions";
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
  anchorLeft?: number;
  menuWidth?: number;
  viewportWidth?: number;
}

export function getMentionMenuLayout({
  anchorBottom,
  anchorTop,
  viewportHeight,
  menuHeight,
  gap = 4,
  margin = 12,
  maxMenuHeight = 184,
  minMenuHeight = 56,
  anchorLeft = 0,
  menuWidth = 188,
  viewportWidth = 0,
}: MentionMenuLayoutInput): {
  left: number;
  maxHeight: number;
  placement: MentionMenuPlacement;
  top: number;
} {
  const belowSpace = Math.max(0, viewportHeight - anchorBottom - margin);
  const aboveSpace = Math.max(0, anchorTop - margin);
  const preferredHeight = Math.min(menuHeight, maxMenuHeight);
  const placement = belowSpace < preferredHeight && aboveSpace > belowSpace ? "above" : "below";
  const availableSpace = placement === "above" ? aboveSpace - gap : belowSpace - gap;
  const maxHeight = Math.max(
    Math.min(minMenuHeight, maxMenuHeight),
    Math.min(maxMenuHeight, Math.max(0, availableSpace))
  );
  const viewportRight = viewportWidth > 0 ? viewportWidth - margin : Number.POSITIVE_INFINITY;
  const left = Math.max(margin, Math.min(anchorLeft, viewportRight - menuWidth));
  const top =
    placement === "above"
      ? Math.max(margin, anchorTop - gap - maxHeight)
      : Math.min(viewportHeight - margin - maxHeight, anchorBottom + gap);
  return { left, maxHeight, placement, top };
}

function getTextareaCaretRect(textarea: HTMLTextAreaElement) {
  const rect = textarea.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const selectionStart = textarea.selectionStart ?? textarea.value.length;
  const mirroredProperties = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "textTransform",
    "wordSpacing",
  ] as const;

  Object.assign(mirror.style, {
    left: `${rect.left}px`,
    overflow: "hidden",
    position: "fixed",
    top: `${rect.top}px`,
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    width: `${rect.width}px`,
    wordBreak: "break-word",
  });
  mirroredProperties.forEach((property) => {
    mirror.style[property] = style[property];
  });

  mirror.textContent = textarea.value.slice(0, selectionStart);
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    bottom: markerRect.bottom - textarea.scrollTop,
    left: markerRect.left - textarea.scrollLeft,
    top: markerRect.top - textarea.scrollTop,
  };
}

function getContentEditableCaretRect(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return null;
  const collapsedRange = range.cloneRange();
  collapsedRange.collapse(false);
  const rect = collapsedRange.getClientRects()[0] ?? collapsedRange.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;
  return {
    bottom: rect.bottom,
    left: rect.left,
    top: rect.top,
  };
}

interface InputResourceMentionMenuProps<T extends MentionResource> {
  onPick: (label: string, resource: T) => void;
  onRequestClose?: () => void;
  resources: T[];
}

export function InputResourceMentionMenu<T extends MentionResource>({
  onPick,
  onRequestClose,
  resources,
}: InputResourceMentionMenuProps<T>) {
  const options = React.useMemo(() => buildMentionOptions(resources), [resources]);
  const anchorId = React.useId();
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [layout, setLayout] = React.useState<ReturnType<typeof getMentionMenuLayout>>({
    left: 16,
    maxHeight: 184,
    placement: "below",
    top: 16,
  });

  React.useEffect(() => {
    setActiveIndex(0);
    optionRefs.current = optionRefs.current.slice(0, options.length);
  }, [options.length]);

  React.useLayoutEffect(() => {
    const updateLayout = () => {
      const menuElement = menuRef.current;
      const anchorElement = menuElement?.dataset.anchorId
        ? document.querySelector(`[data-mention-anchor="${menuElement.dataset.anchorId}"]`)
        : null;
      if (!menuElement || !anchorElement) return;
      const anchorRect = anchorElement.getBoundingClientRect();
      const textarea = anchorElement.parentElement?.querySelector("textarea");
      const contentEditable = anchorElement.parentElement?.querySelector(
        "[contenteditable='true']"
      );
      const caretRect =
        textarea instanceof HTMLTextAreaElement
          ? getTextareaCaretRect(textarea)
          : contentEditable instanceof HTMLElement
            ? getContentEditableCaretRect(contentEditable)
            : null;
      const activeRect = caretRect ?? anchorRect;
      const nextLayout = getMentionMenuLayout({
        anchorBottom: activeRect.bottom,
        anchorLeft: activeRect.left,
        anchorTop: activeRect.top,
        menuHeight: menuElement.scrollHeight,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });
      setLayout((current) =>
        current.placement === nextLayout.placement &&
        current.maxHeight === nextLayout.maxHeight &&
        current.left === nextLayout.left &&
        current.top === nextLayout.top
          ? current
          : nextLayout
      );
    };

    updateLayout();
    window.addEventListener("scroll", updateLayout, true);
    window.addEventListener("resize", updateLayout);
    return () => {
      window.removeEventListener("scroll", updateLayout, true);
      window.removeEventListener("resize", updateLayout);
    };
  }, [anchorId, options.length]);

  React.useEffect(() => {
    if (!onRequestClose) return;

    const closeWhenOutsideCurrentNode = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const menuElement = menuRef.current;
      const anchorElement = menuElement?.dataset.anchorId
        ? document.querySelector(`[data-mention-anchor="${menuElement.dataset.anchorId}"]`)
        : null;
      const currentNodeElement = anchorElement?.closest("[data-node-id]");
      if (!target || menuElement?.contains(target) || currentNodeElement?.contains(target)) return;
      onRequestClose();
    };

    window.addEventListener("pointerdown", closeWhenOutsideCurrentNode, true);
    return () => {
      window.removeEventListener("pointerdown", closeWhenOutsideCurrentNode, true);
    };
  }, [onRequestClose]);

  React.useEffect(() => {
    const blockCanvasWheel = (event: WheelEvent) => {
      const menuElement = menuRef.current;
      if (menuElement?.contains(event.target as Node)) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("wheel", blockCanvasWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("wheel", blockCanvasWheel, true);
    };
  }, []);

  React.useEffect(() => {
    if (options.length === 0) return;

    const handleKeyboardPick = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Enter") {
        const option = options[activeIndex];
        if (option) onPick(option.mentionText, option.resource);
        return;
      }

      const navigationKey = event.key;
      setActiveIndex((currentIndex) => {
        const nextIndex = getNextMentionMenuIndex(currentIndex, navigationKey, options.length);
        window.requestAnimationFrame(() => {
          optionRefs.current[nextIndex]?.scrollIntoView({ block: "nearest" });
        });
        return nextIndex;
      });
    };

    window.addEventListener("keydown", handleKeyboardPick, true);
    return () => {
      window.removeEventListener("keydown", handleKeyboardPick, true);
    };
  }, [activeIndex, onPick, options]);

  if (options.length === 0) return null;

  return (
    <>
      <span
        aria-hidden="true"
        data-mention-anchor={anchorId}
        className="pointer-events-none absolute inset-0"
      />
      {createPortal(
        <div
          ref={menuRef}
          data-anchor-id={anchorId}
          data-node-action="true"
          className="fixed z-[240] w-[188px] cursor-default overflow-y-auto rounded-[10px] border border-white/10 bg-[#111827]/96 p-1 shadow-[0_16px_34px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl custom-scrollbar"
          style={{ left: layout.left, maxHeight: layout.maxHeight, top: layout.top }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {options.map(({ label, mentionText, resource }, index) => (
            <button
              key={`${label}-${resource.value}-${index}`}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              className={`flex w-full items-center gap-2 rounded-[8px] p-1 text-left transition-colors ${
                activeIndex === index ? "bg-white/[0.07]" : "hover:bg-white/[0.06]"
              }`}
              onClick={() => onPick(mentionText, resource)}
              onPointerEnter={() => setActiveIndex(index)}
            >
              <ReferencePreviewCard compact reference={resource} index={index} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-slate-100">{label}</div>
                <div className="truncate text-[10px] text-slate-400/70">
                  {resource.title}
                </div>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
