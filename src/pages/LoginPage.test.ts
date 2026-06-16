import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LoginPage defaults", () => {
  it("does not prefill the username or password fields", () => {
    const source = readFileSync(new URL("./LoginPage.tsx", import.meta.url), "utf8");

    expect(source).toContain('const DEFAULT_USERNAME = "";');
    expect(source).toContain('const DEFAULT_PASSWORD = "";');
    expect(source).not.toContain('const DEFAULT_USERNAME = "lccsetsun";');
    expect(source).not.toContain('const DEFAULT_PASSWORD = "lccsetsun";');
  });
});
