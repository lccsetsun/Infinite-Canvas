export type TextNodeMode = "assistant" | "plain";

interface TextNodeInteractionStateInput {
  errorText: string;
  forceComposerOpen: boolean;
  hasConnectedLinks?: boolean;
  inlineEditing: boolean;
  isHovered: boolean;
  isMultimodalMode: boolean;
  isRunning?: boolean;
  hasReferences?: boolean;
  responseText: string;
  selected: boolean;
  textMode?: unknown;
}

export interface TextNodeInteractionState {
  contentViewKey: string;
  isPlainMode: boolean;
  showInlineEditor: boolean;
  showPromptComposer: boolean;
  showSkeleton: boolean;
  showStarterGuide: boolean;
}

export function getTextNodeInteractionState({
  errorText,
  forceComposerOpen,
  hasConnectedLinks = false,
  hasReferences = false,
  inlineEditing,
  isHovered,
  isMultimodalMode,
  isRunning = false,
  responseText,
  selected,
  textMode,
}: TextNodeInteractionStateInput): TextNodeInteractionState {
  const isPlainMode = textMode === "plain";
  const hasResponse = responseText.trim().length > 0;
  const hasError = errorText.trim().length > 0;
  const isComposerEditing = !isPlainMode && forceComposerOpen;
  const showInlineEditor = isPlainMode && inlineEditing;
  const showStarterGuide =
    !isPlainMode &&
    !isComposerEditing &&
    !isMultimodalMode &&
    !hasReferences &&
    !hasConnectedLinks &&
    !hasResponse &&
    !hasError;

  return {
    contentViewKey: isPlainMode ? (showInlineEditor ? "plain-editing" : "plain-readonly") : "",
    isPlainMode,
    showInlineEditor,
    showPromptComposer: !isRunning && !isPlainMode && (isHovered || selected || forceComposerOpen),
    showSkeleton: !isPlainMode && !isComposerEditing && !showStarterGuide && !hasResponse && !hasError,
    showStarterGuide,
  };
}
