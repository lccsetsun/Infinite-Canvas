import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App preview overlay", () => {
  it("hides the canvas header while the preview modal is open", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(source).toContain("const isPreviewOpen = Boolean(previewContent);");
    expect(source).toMatch(/\{!isPreviewOpen && \(\s*<CanvasHeader/);
    expect(source).toMatch(/\{previewContent && \(\s*<PreviewModal/);
  });
});
