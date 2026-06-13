import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MiniMap styling", () => {
  it("does not dim the minimap by default", () => {
    const source = readFileSync(new URL("./MiniMap.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("opacity: 0.42");
    expect(source).not.toContain("whileHover={{ opacity: 1 }}");
    expect(source).toContain("animate={{ y: 0, opacity: 1 }}");
  });

  it("sits above the bottom control group instead of touching it", () => {
    const source = readFileSync(new URL("./MiniMap.tsx", import.meta.url), "utf8");

    expect(source).toContain("bottom-[76px]");
    expect(source).not.toContain("bottom-14");
  });
});
