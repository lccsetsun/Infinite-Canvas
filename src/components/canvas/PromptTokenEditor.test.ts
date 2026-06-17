import { describe, expect, it } from "vitest";
import {
  getPromptTokenEditorPasteHtml,
  getPromptTokenEditorResourceSignature,
  shouldRefreshPromptTokenEditorHtml,
} from "./PromptTokenEditor";
import type { MentionResource } from "../../utils/inputResourceMentions";

const firstImageSet: MentionResource[] = [
  { kind: "image", title: "图片节点 6", value: "https://example.com/a.png" },
];

const secondImageSet: MentionResource[] = [
  { kind: "image", title: "图片节点 5", value: "https://example.com/b.png" },
  { kind: "image", title: "图片节点 6", value: "https://example.com/a.png" },
];

describe("shouldRefreshPromptTokenEditorHtml", () => {
  it("refreshes token previews when resources change even if the serialized value stays the same", () => {
    expect(
      shouldRefreshPromptTokenEditorHtml({
        editorIsActive: true,
        hasRenderedHtml: true,
        lastRenderedResourceSignature: getPromptTokenEditorResourceSignature(firstImageSet),
        lastRenderedValue: "{{ Image1 }}",
        resourceSignature: getPromptTokenEditorResourceSignature(secondImageSet),
        serializedValue: "{{ Image1 }}",
        value: "{{ Image1 }}",
      })
    ).toBe(true);
  });

  it("skips refresh when both value and resources are already current", () => {
    const resourceSignature = getPromptTokenEditorResourceSignature(firstImageSet);

    expect(
      shouldRefreshPromptTokenEditorHtml({
        editorIsActive: true,
        hasRenderedHtml: true,
        lastRenderedResourceSignature: resourceSignature,
        lastRenderedValue: "{{ Image1 }}",
        resourceSignature,
        serializedValue: "{{ Image1 }}",
        value: "{{ Image1 }}",
      })
    ).toBe(false);
  });
});

describe("getPromptTokenEditorPasteHtml", () => {
  it("renders pasted mention text back into a non-editable image token", () => {
    const html = getPromptTokenEditorPasteHtml("{{ Image1 }} 123", firstImageSet);

    expect(html).toContain('contenteditable="false"');
    expect(html).toContain('data-mention-text="{{ Image1 }}"');
    expect(html).toContain('data-selected="false"');
    expect(html).toContain("prompt-token-mention");
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain("123");
  });

  it("allows native selection highlight to include image mention tokens", () => {
    const html = getPromptTokenEditorPasteHtml("{{ Image1 }} 123", firstImageSet);

    expect(html).not.toContain("select-none");
  });

  it("includes a visible selected overlay for image mention tokens", () => {
    const html = getPromptTokenEditorPasteHtml("{{ Image1 }}", firstImageSet);

    expect(html).toContain('data-token-selection-overlay="true"');
    expect(html).toContain("group-data-[selected=true]/token:bg-cyan-300/32");
    expect(html).toContain("data-[selected=true]:shadow");
  });
});
