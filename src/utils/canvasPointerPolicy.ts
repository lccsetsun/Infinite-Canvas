export function shouldFinishCanvasLinkOnCanvasPointerUp(_isLinkingOnCanvas: boolean) {
  return false;
}

const CANVAS_CLICK_DRAG_THRESHOLD_PX = 4;

export function hasCanvasPointerDragExceededClickThreshold({
  startX,
  startY,
  endX,
  endY,
  threshold = CANVAS_CLICK_DRAG_THRESHOLD_PX,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  threshold?: number;
}) {
  const dx = endX - startX;
  const dy = endY - startY;
  return dx * dx + dy * dy > threshold * threshold;
}
