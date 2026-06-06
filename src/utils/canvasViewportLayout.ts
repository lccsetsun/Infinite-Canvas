const CANVAS_VIEWPORT_CLASSES = [
  "absolute",
  "inset-0",
  "cursor-grab",
  "active:cursor-grabbing",
  "select-none",
].join(" ");

export function getCanvasViewportClassName() {
  return CANVAS_VIEWPORT_CLASSES;
}
