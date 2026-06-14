import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CanvasControls styling", () => {
  it("uses the account panel surface style without default dimming", () => {
    const source = readFileSync(new URL("./CanvasControls.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("opacity: 0.58");
    expect(source).toContain("bg-[#151d2b]/88");
    expect(source).toContain("border-violet-200/[0.10]");
    expect(source).not.toContain("hover:text-cyan-100");
    expect(source).toContain("inset_0_1px_0");
  });

  it("uses an app styled focus ring instead of the browser default white outline", () => {
    const source = readFileSync(new URL("./CanvasControls.tsx", import.meta.url), "utf8");

    expect(source).toContain("outline-none");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("focus-visible:ring-violet-200/55");
  });

  it("hosts the clear canvas action in the left controls", () => {
    const source = readFileSync(new URL("./CanvasControls.tsx", import.meta.url), "utf8");

    expect(source).toContain("Trash2");
    expect(source).toContain("onClearCanvas");
    expect(source).toContain("清除画布");
  });
});
