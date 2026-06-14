import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CanvasNodeLayer detached titles", () => {
  it("keeps detached node titles below node cards and prompt panels", () => {
    const source = readFileSync(new URL("./CanvasNodeLayer.tsx", import.meta.url), "utf8");

    expect(source).toContain('className="absolute inset-0 z-20 origin-top-left"');
    expect(source).toContain('className="pointer-events-none absolute inset-0 z-[19]"');
    expect(source).toContain("DetachedMediaNodeTitle");
  });
});
