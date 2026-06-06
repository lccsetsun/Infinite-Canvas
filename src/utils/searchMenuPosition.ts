const VIEWPORT_MARGIN = 12;

export function getSearchMenuPosition(
  point: { x: number; y: number },
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number },
  options?: { bottomMargin?: number }
) {
  const bottomMargin = options?.bottomMargin ?? VIEWPORT_MARGIN;
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - menuSize.width);
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - bottomMargin - menuSize.height);

  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(point.x, maxLeft)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(point.y, maxTop)),
  };
}
