import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AppHeader", () => {
  it("keeps the home logo larger and vertically centered in the header", () => {
    const source = readFileSync(new URL("./AppHeader.tsx", import.meta.url), "utf8");

    expect(source).toContain("h-full cursor-default items-center");
    expect(source).toContain("className=\"relative h-9 w-auto");
    expect(source).not.toContain("className=\"relative h-8 w-auto");
  });
});
