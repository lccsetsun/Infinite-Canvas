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
});
