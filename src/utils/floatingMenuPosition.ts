export type FloatingMenuPlacement = "top" | "bottom";

export interface FloatingMenuAnchorRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface FloatingMenuPositionInput {
  anchorRect: FloatingMenuAnchorRect;
  gap?: number;
  margin?: number;
  maxMenuHeight?: number;
  minMenuHeight?: number;
  viewportHeight: number;
  viewportWidth: number;
}

export type FloatingMenuPosition =
  | {
      bottom?: undefined;
      left: number;
      maxHeight: number;
      placement: "bottom";
      top: number;
      width: number;
    }
  | {
      bottom: number;
      left: number;
      maxHeight: number;
      placement: "top";
      top?: undefined;
      width: number;
    };

export function getFloatingMenuPosition({
  anchorRect,
  gap = 10,
  margin = 16,
  maxMenuHeight = 360,
  minMenuHeight = 180,
  viewportHeight,
  viewportWidth,
}: FloatingMenuPositionInput): FloatingMenuPosition {
  const width = Math.max(180, Math.round(anchorRect.width));
  const left = Math.round(
    Math.min(Math.max(margin, anchorRect.left), Math.max(margin, viewportWidth - width - margin))
  );
  const spaceBelow = viewportHeight - anchorRect.bottom - gap - margin;
  const spaceAbove = anchorRect.top - gap - margin;
  const placement: FloatingMenuPlacement =
    spaceBelow >= minMenuHeight || spaceBelow >= spaceAbove ? "bottom" : "top";
  const availableHeight = placement === "bottom" ? spaceBelow : spaceAbove;
  const maxHeight = Math.round(Math.max(96, Math.min(maxMenuHeight, availableHeight)));

  if (placement === "bottom") {
    return {
      left,
      maxHeight,
      placement,
      top: Math.round(anchorRect.bottom + gap),
      width,
    };
  }

  return {
    bottom: Math.round(viewportHeight - anchorRect.top + gap),
    left,
    maxHeight,
    placement,
    width,
  };
}
