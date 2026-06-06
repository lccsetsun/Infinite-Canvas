const MENU_GAP = 10;
const VIEWPORT_MARGIN = 12;

export function getHomeProjectMenuPosition(
  triggerRect: Pick<DOMRect, "top" | "bottom" | "right">,
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number }
) {
  const unclampedLeft = triggerRect.right - menuSize.width;
  const maxLeft = viewport.width - VIEWPORT_MARGIN - menuSize.width;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(unclampedLeft, maxLeft));

  const opensAbove = triggerRect.bottom + MENU_GAP + menuSize.height > viewport.height - VIEWPORT_MARGIN;
  const top = opensAbove
    ? Math.max(VIEWPORT_MARGIN, triggerRect.top - MENU_GAP - menuSize.height)
    : triggerRect.bottom + MENU_GAP;

  return { left, top };
}
