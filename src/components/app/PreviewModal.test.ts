import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PreviewModal text editing and selection copy", () => {
  it("supports copying selected text from editable text previews", () => {
    const source = readFileSync(new URL("./PreviewModal.tsx", import.meta.url), "utf8");

    expect(source).toContain("function getSelectedPreviewText");
    expect(source).toContain("const [selectedPreviewText, setSelectedPreviewText]");
    expect(source).toContain('ref={previewTextInputRef}');
    expect(source).toContain("selectionStart");
    expect(source).toContain("selectionEnd");
    expect(source).toContain('onMouseDown={(event) => event.preventDefault()}');
    expect(source).toContain("navigator.clipboard.writeText(textToCopy);");
    expect(source).toContain("选中文字已复制到剪贴板");
    expect(source).toContain("复制选中");
  });

  it("opens text output previews directly in editable mode", () => {
    const source = readFileSync(new URL("./PreviewModal.tsx", import.meta.url), "utf8");

    expect(source).toContain("onUpdateNodeResponse?: (nodeId: string, text: string) => void;");
    expect(source).toContain("const handleTextPreviewChange = (value: string) =>");
    expect(source).toContain("onUpdateNodeResponse?.(preview.nodeId, value);");
    expect(source).toContain("isTextPreview ? (");
    expect(source).toContain("<textarea");
    expect(source).toContain("onChange={(e) => handleTextPreviewChange(e.target.value)}");
    expect(source).toContain("bg-transparent border-0");
    expect(source).toContain("focus:ring-0");
    expect(source).not.toContain("文本内容已保存");
    expect(source).not.toContain("{isTextPreview && preview.nodeId && (");
    expect(source).not.toContain("isTextEditing");
    expect(source).not.toContain("onDoubleClick");
  });

  it("downloads editable text previews as txt and json", () => {
    const source = readFileSync(new URL("./PreviewModal.tsx", import.meta.url), "utf8");

    expect(source).toContain("function downloadTextFile");
    expect(source).toContain('new Blob([content], { type: mimeType })');
    expect(source).toContain("URL.createObjectURL(blob)");
    expect(source).toContain("downloadTextPreviewAsTxt");
    expect(source).toContain("downloadTextPreviewAsJson");
    expect(source).toContain('filename: `${safeTextPreviewFilename}.txt`');
    expect(source).toContain('filename: `${safeTextPreviewFilename}.json`');
    expect(source).toContain("JSON.stringify(");
    expect(source).toContain("下载 TXT");
    expect(source).toContain("下载 JSON");
  });
});
