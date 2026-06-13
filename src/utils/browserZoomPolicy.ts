type BrowserZoomWheelLike = {
  ctrlKey: boolean;
  metaKey: boolean;
};

type BrowserZoomKeyboardLike = BrowserZoomWheelLike & {
  key: string;
};

const BROWSER_ZOOM_KEYS = new Set(["+", "=", "-", "_", "0"]);

export function shouldPreventBrowserZoomWheel(event: BrowserZoomWheelLike) {
  return event.ctrlKey || event.metaKey;
}

export function isBrowserZoomKeyboardShortcut(event: BrowserZoomKeyboardLike) {
  return (event.ctrlKey || event.metaKey) && BROWSER_ZOOM_KEYS.has(event.key);
}
