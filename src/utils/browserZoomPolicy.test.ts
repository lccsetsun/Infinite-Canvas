import { describe, expect, it } from "vitest";
import {
  isBrowserZoomKeyboardShortcut,
  shouldPreventBrowserZoomWheel,
} from "./browserZoomPolicy";

describe("browserZoomPolicy", () => {
  it("prevents browser zoom wheel gestures without blocking normal wheel panning", () => {
    expect(shouldPreventBrowserZoomWheel({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(shouldPreventBrowserZoomWheel({ ctrlKey: false, metaKey: true })).toBe(true);
    expect(shouldPreventBrowserZoomWheel({ ctrlKey: false, metaKey: false })).toBe(false);
  });

  it("prevents browser zoom keyboard shortcuts on the canvas page", () => {
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: true, metaKey: false, key: "+" })).toBe(true);
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: true, metaKey: false, key: "=" })).toBe(true);
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: true, metaKey: false, key: "-" })).toBe(true);
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: true, metaKey: false, key: "_" })).toBe(true);
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: true, metaKey: false, key: "0" })).toBe(true);
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: false, metaKey: true, key: "+" })).toBe(true);
  });

  it("does not block unrelated keyboard shortcuts", () => {
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: true, metaKey: false, key: "s" })).toBe(false);
    expect(isBrowserZoomKeyboardShortcut({ ctrlKey: false, metaKey: false, key: "+" })).toBe(false);
  });
});
