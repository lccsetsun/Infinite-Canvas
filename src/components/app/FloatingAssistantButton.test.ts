import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("FloatingAssistantButton", () => {
  it("shows a hover helper bubble and opens the assistant panel from the icon", () => {
    const source = readFileSync(new URL("./FloatingAssistantButton.tsx", import.meta.url), "utf8");

    expect(source).toContain("哈喽，我是灵感，接住你所有空白思绪");
    expect(source).toContain("嗨～别发愁，灵感来为你解锁新思路");
    expect(source).toContain("lastBubbleIndexRef");
    expect(source).toContain("BUBBLE_INTERVAL_MS = 60000");
    expect(source).toContain("BUBBLE_AUTO_HIDE_MS = 10000");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("window.setTimeout");
    expect(source).toContain("getNextAssistantBubbleIndex");
    expect(source).toContain("小影助手");
    expect(source).toContain("你好，我是小影");
    expect(source).toContain("整理内容结构");
    expect(source).toContain("分析这些节点关系");
    expect(source).toContain("给我下一步生成建议");
    expect(source).toContain("描述操作或选择节点添加上下文...");
    expect(source).toContain("onMouseEnter");
    expect(source).toContain("onMouseLeave");
    expect(source).toContain("panelOpen");
    expect(source).toContain("setPanelOpen(true)");
    expect(source).toContain("setPanelOpen(false)");
    expect(source).toContain("onPanelOpenChange");
    expect(source).toContain("x: 96");
    expect(source).toContain("fixed bottom-2.5 right-6 top-2.5");
    expect(source).toContain("w-[660px]");
    expect(source).toContain("max-w-[calc(100vw-32px)]");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("onWheel");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("shrink-0 rounded-[24px]");
    expect(source).toContain("h-[118px] w-[118px]");
    expect(source).toContain("h-[76px]");
    expect(source).toContain("text-[24px]");
    expect(source).toContain("text-[16px] font-black");
    expect(source).toContain("bg-[#121923]/72");
    expect(source).toContain("text-slate-200");
    expect(source).toContain("placeholder:text-slate-600");
    expect(source).toContain("w-[224px]");
    expect(source).toContain("whitespace-normal");
    expect(source).toContain("break-words");
    expect(source).toContain("bg-white/95");
    expect(source).toContain("max-h-[35px]");
    expect(source).toContain("leading-[1.45]");
    expect(source).toContain("cursor-pointer");
    expect(source).toContain("z-[180]");
    expect(source).toContain('data-no-canvas-context-menu="true"');
    expect(source).toContain('data-canvas-passthrough="true"');
    expect(source).toContain("aria-label=\"助手小影\"");
    expect(source).not.toContain("onOpen");
  });

  it("does not repeat the immediately previous bubble message", () => {
    const source = readFileSync(new URL("./FloatingAssistantButton.tsx", import.meta.url), "utf8");

    expect(source).toContain("previousIndex");
    expect(source).toContain("availableIndexes");
    expect(source).toContain("index !== previousIndex");
  });

  it("is rendered in the canvas view layer", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).toContain('import FloatingAssistantButton from "./components/app/FloatingAssistantButton"');
    expect(source).toContain("assistantPanelOpen");
    expect(source).toContain("data-assistant-panel-open={assistantPanelOpen ? \"true\" : undefined}");
    expect(source).toContain("assistantPanelOpen={assistantPanelOpen}");
    expect(source).toContain("onPanelOpenChange={setAssistantPanelOpen}");
    expect(source).toContain('currentView === "canvas"');
  });
});
