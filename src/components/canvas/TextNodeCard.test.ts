import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TextNodeCard prompt composer fullscreen editor", () => {
  it("provides a temporary fullscreen prompt editor from the text prompt composer", () => {
    const source = readFileSync(new URL("./TextNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("const [expandedPromptEditorOpen, setExpandedPromptEditorOpen]");
    expect(source).toContain("aria-label=\"放大编辑\"");
    expect(source).toContain("aria-label=\"关闭全屏编辑\"");
    expect(source).toContain("onEscape={() => setExpandedPromptEditorOpen(false)}");
    expect(source).toContain("fixed inset-0 z-[220]");
    expect(source).toContain("{expandedPromptEditorNode}");
    expect(source).toContain("fixed z-[240]");
    expect(source).toContain("bg-violet-500/[0.16] text-violet-50");
    expect(source).toContain("overflow-y-auto pr-3 text-[16px] leading-8 custom-scrollbar");
  });

  it("does not render check icons inside text model option rows", () => {
    const source = readFileSync(new URL("./TextNodeCard.tsx", import.meta.url), "utf8");
    const firstModelMenu = source.indexOf("modelOptionGroups.builtIn");
    const nextEditorClose = source.indexOf("</motion.div>", firstModelMenu);
    const modelMenuSource = source.slice(firstModelMenu, nextEditorClose);

    expect(modelMenuSource).not.toContain("<Check");
  });

  it("rerenders when input reference thumbnails change", () => {
    const source = readFileSync(new URL("./TextNodeCard.tsx", import.meta.url), "utf8");
    const memoSource = source.slice(source.indexOf("const TextNodeCard = React.memo"));

    expect(memoSource).toContain("prev.references === next.references");
    expect(memoSource).toContain("prev.resolvedInputs === next.resolvedInputs");
  });

  it("keeps prompt composer controls and resize handle out of content flow", () => {
    const source = readFileSync(new URL("./TextNodeCard.tsx", import.meta.url), "utf8");

    expect(source).toContain("absolute right-4 top-4 z-20");
    expect(source).toContain("{composerReferences.length > 0 && (");
    expect(source).not.toContain('<div className="mb-3 flex items-start gap-3">');
    expect(source).not.toContain('<div className="ml-auto shrink-0">{expandPromptEditorButton}</div>');
    expect(source).toContain("const responseAreaMaxHeight = Math.max(132, renderedNodeHeight - 40);");
    expect(source).toContain('hasCompactContent ? "px-5 pb-3 pt-5"');
    expect(source).toContain("absolute -bottom-1 -right-1 z-30 h-8 w-8 cursor-nwse-resize");
    expect(source).toContain("border-b border-r border-slate-300/28");
    expect(source).toContain("rounded-br-[14px]");
    expect(source).not.toContain("rounded-full border border-slate-400/14 bg-[#0a1019]/72");
    expect(source).not.toContain("-rotate-45 rounded-full bg-current");
    expect(source).not.toContain("h-14 w-14 cursor-nwse-resize rounded-br-[18px] rounded-tl-[30px]");
  });
});
