import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("FloatingAssistantButton", () => {
  it("shows a hover helper bubble without enabling a panel entry yet", () => {
    const source = readFileSync(new URL("./FloatingAssistantButton.tsx", import.meta.url), "utf8");

    expect(source).toContain("Hi，我是助手小影");
    expect(source).toContain("onMouseEnter");
    expect(source).toContain("onMouseLeave");
    expect(source).toContain("cursor-pointer");
    expect(source).toContain('data-no-canvas-context-menu="true"');
    expect(source).toContain("aria-label=\"助手小影\"");
    expect(source).not.toContain("window.setInterval");
    expect(source).not.toContain("onOpen");
  });

  it("is rendered in the canvas view layer", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).toContain('import FloatingAssistantButton from "./components/app/FloatingAssistantButton"');
    expect(source).toContain("<FloatingAssistantButton />");
    expect(source).toContain('currentView === "canvas"');
  });
});
