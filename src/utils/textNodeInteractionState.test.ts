import { describe, expect, it } from "vitest";
import { getTextNodeInteractionState } from "./textNodeInteractionState";

describe("getTextNodeInteractionState", () => {
  it("keeps plain text mode quiet until the node is edited", () => {
    const state = getTextNodeInteractionState({
      errorText: "",
      forceComposerOpen: false,
      inlineEditing: false,
      isHovered: true,
      isMultimodalMode: false,
      responseText: "",
      selected: true,
      textMode: "plain",
    });

    expect(state).toMatchObject({
      isPlainMode: true,
      showInlineEditor: false,
      showPromptComposer: false,
      showSkeleton: false,
      showStarterGuide: false,
    });
  });

  it("shows only the inline editor when a plain text node is edited", () => {
    const emptyState = getTextNodeInteractionState({
      errorText: "",
      forceComposerOpen: false,
      inlineEditing: true,
      isHovered: false,
      isMultimodalMode: false,
      responseText: "",
      selected: true,
      textMode: "plain",
    });
    const typingState = getTextNodeInteractionState({
      errorText: "",
      forceComposerOpen: false,
      inlineEditing: true,
      isHovered: false,
      isMultimodalMode: false,
      responseText: "",
      selected: true,
      textMode: "plain",
    });

    expect(emptyState.showInlineEditor).toBe(true);
    expect(emptyState.showPromptComposer).toBe(false);
    expect(emptyState.showSkeleton).toBe(false);
    expect(emptyState.showStarterGuide).toBe(false);
    expect(typingState.contentViewKey).toBe(emptyState.contentViewKey);
  });

  it("keeps the existing assistant starter guide for empty default text nodes", () => {
    const state = getTextNodeInteractionState({
      errorText: "",
      forceComposerOpen: false,
      inlineEditing: false,
      isHovered: false,
      isMultimodalMode: false,
      responseText: "",
      selected: false,
      textMode: undefined,
    });

    expect(state.showStarterGuide).toBe(true);
    expect(state.showPromptComposer).toBe(false);
  });

  it("hides starter shortcuts when an assistant text node already has upstream references", () => {
    const state = getTextNodeInteractionState({
      errorText: "",
      forceComposerOpen: false,
      hasReferences: true,
      inlineEditing: false,
      isHovered: false,
      isMultimodalMode: false,
      responseText: "",
      selected: false,
      textMode: undefined,
    });

    expect(state.showStarterGuide).toBe(false);
    expect(state.showSkeleton).toBe(true);
  });

  it("hides starter shortcuts when an assistant text node has any incoming or outgoing links", () => {
    const state = getTextNodeInteractionState({
      errorText: "",
      forceComposerOpen: false,
      hasConnectedLinks: true,
      inlineEditing: false,
      isHovered: false,
      isMultimodalMode: false,
      responseText: "",
      selected: false,
      textMode: undefined,
    });

    expect(state.showStarterGuide).toBe(false);
    expect(state.showSkeleton).toBe(true);
  });
});
