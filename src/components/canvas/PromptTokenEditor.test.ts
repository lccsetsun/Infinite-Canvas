import { describe, expect, it } from "vitest";
import {
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
