export interface TextNodeResizeBounds {
  maxHeight: number;
  maxWidth: number;
  minHeight: number;
  minWidth: number;
}

export interface TextNodeResizeInput {
  currentClientX: number;
  currentClientY: number;
  scale: number;
  startClientX: number;
  startClientY: number;
  startHeight: number;
  startWidth: number;
}

export function calculateTextNodeResize(
  input: TextNodeResizeInput,
  bounds: TextNodeResizeBounds
) {
  const scale = Number.isFinite(input.scale) && input.scale > 0 ? input.scale : 1;
  const widthDelta = (input.currentClientX - input.startClientX) / scale;
  const heightDelta = (input.currentClientY - input.startClientY) / scale;

  return {
    width: Math.round(
      Math.min(bounds.maxWidth, Math.max(bounds.minWidth, input.startWidth + widthDelta))
    ),
    height: Math.round(
      Math.min(bounds.maxHeight, Math.max(bounds.minHeight, input.startHeight + heightDelta))
    ),
  };
}
