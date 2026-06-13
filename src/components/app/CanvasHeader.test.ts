import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCanvasHeaderProjectName, resolveCanvasProjectRename } from "./CanvasHeader";

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

  it("uses the same account panel variant as the home header", () => {
    const source = readFileSync(new URL("./CanvasHeader.tsx", import.meta.url), "utf8");

    expect(source).not.toContain('variant="compact"');
  });

  it("keeps the project selector visually aligned with the account panel without dimming", () => {
    const source = readFileSync(new URL("./CanvasHeader.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("opacity: isVisible ? 1 : 0.64");
    expect(source).toContain("bg-[#151d2b]/88");
    expect(source).toContain("border-violet-200/[0.10]");
    expect(source).not.toContain("hover:border-cyan-100/[0.13]");
  });
});

describe("resolveCanvasProjectRename", () => {
  it("trims a new project name and marks it as changed", () => {
    expect(resolveCanvasProjectRename("项目 9", "  新名字  ")).toEqual({
      ok: true,
      name: "新名字",
      changed: true,
    });
  });

  it("rejects empty names", () => {
    expect(resolveCanvasProjectRename("项目 9", "   ")).toEqual({
      ok: false,
      name: "项目 9",
      changed: false,
      error: "项目名称不能为空",
    });
  });

  it("accepts unchanged names without saving", () => {
    expect(resolveCanvasProjectRename("项目 9", "项目 9")).toEqual({
      ok: true,
      name: "项目 9",
      changed: false,
    });
  });
});
