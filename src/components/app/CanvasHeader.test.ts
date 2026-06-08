import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCanvasHeaderProjectName } from "./CanvasHeader";

describe("getCanvasHeaderProjectName", () => {
  it("uses the project name supplied by the parent canvas loader", () => {
    expect(getCanvasHeaderProjectName("  新建项目6666  ")).toBe("新建项目6666");
  });

  it("falls back when the parent has not loaded a project name yet", () => {
    expect(getCanvasHeaderProjectName("")).toBe("未命名");
    expect(getCanvasHeaderProjectName(undefined)).toBe("未命名");
  });
});

describe("CanvasHeader remote project loading", () => {
  it("does not fetch project details independently of App", () => {
    const source = readFileSync(new URL("./CanvasHeader.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("getRemoteProjectDetail");
  });
});
