import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CanvasHistoryDock styling", () => {
  it("uses the account panel surface style without default dimming", () => {
    const source = readFileSync(new URL("./CanvasHistoryDock.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("opacity: 0.58");
    expect(source).toContain("bg-[#151d2b]/88");
    expect(source).toContain("border-violet-200/[0.10]");
    expect(source).not.toContain("hover:text-cyan-100");
    expect(source).toContain("inset_0_1px_0");
  });
});
