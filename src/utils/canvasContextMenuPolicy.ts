const CANVAS_CONTEXT_MENU_EXCLUSION_SELECTOR = [
  "[data-no-canvas-context-menu='true']",
  "[data-node-action='true']",
  ".node-card",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
].join(", ");

export function shouldOpenCanvasContextMenu(target: EventTarget | null) {
  if (!target || typeof (target as Element).closest !== "function") return true;
  return !(target as Element).closest(CANVAS_CONTEXT_MENU_EXCLUSION_SELECTOR);
}
