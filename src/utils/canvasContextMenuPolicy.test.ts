import { describe, expect, it } from "vitest";
import { shouldOpenCanvasContextMenu } from "./canvasContextMenuPolicy";

describe("shouldOpenCanvasContextMenu", () => {
  it("opens the canvas menu for ordinary app chrome and blank canvas targets", () => {
    const blankHeader = {
      closest: () => null,
    } as unknown as Element;

    expect(shouldOpenCanvasContextMenu(blankHeader)).toBe(true);
  });

  it("does not open the canvas menu from excluded controls", () => {
    const nestedInExcludedPanel = {
      closest: (selector: string) =>
        selector.includes("[data-no-canvas-context-menu='true']") ? {} : null,
    } as unknown as Element;
    const button = {
      closest: (selector: string) => (selector.includes("button") ? {} : null),
    } as unknown as Element;

    expect(shouldOpenCanvasContextMenu(nestedInExcludedPanel)).toBe(false);
    expect(shouldOpenCanvasContextMenu(button)).toBe(false);
  });
});
