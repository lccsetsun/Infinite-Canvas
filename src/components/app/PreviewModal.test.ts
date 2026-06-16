import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PreviewModal text selection copy", () => {
  it("supports copying selected text from text previews", () => {
    const source = readFileSync(new URL("./PreviewModal.tsx", import.meta.url), "utf8");

    expect(source).toContain("function getSelectedPreviewText");
    expect(source).toContain("const [selectedPreviewText, setSelectedPreviewText]");
    expect(source).toContain('ref={previewTextContentRef}');
    expect(source).toContain('onMouseDown={(event) => event.preventDefault()}');
    expect(source).toContain("navigator.clipboard.writeText(textToCopy);");
    expect(source).toContain("选中文字已复制到剪贴板");
    expect(source).toContain("复制选中");
  });
});
