import React from "react";
import {
  buildMentionOptions,
  resolveMentionDisplayParts,
  shouldShowMentionMenu,
  type MentionResource,
} from "../../utils/inputResourceMentions";
import { InputResourceMentionMenu } from "./InputResourceMentionMenu";

interface PromptTokenEditorProps<T extends MentionResource> {
  className?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onEscape?: () => void;
  placeholder?: string;
  resources: T[];
  style?: React.CSSProperties;
  value: string;
}

export interface PromptTokenEditorHandle {
  focus: () => void;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTokenIconSvg(kind: MentionResource["kind"]) {
  if (kind === "video") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 6 3 11l-.9-2.4c-.3-.8.1-1.6.9-1.9l12.7-4.6c.8-.3 1.6.1 1.9.9Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.1 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`;
  }
  if (kind === "audio") {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;
}

function renderTokenHtml(resource: MentionResource, index: number, mentionText: string) {
  const badge = `<span class="pointer-events-none absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-black/18 bg-[#0b1018]/86 px-1 text-[8px] font-semibold leading-none text-white">${index + 1}</span>`;
  const body =
    resource.kind === "image"
      ? `<img src="${escapeHtml(resource.value)}" alt="" draggable="false" class="h-7 w-7 rounded-[8px] object-cover shadow-[0_8px_18px_-12px_rgba(0,0,0,0.9)]" />`
      : `<span class="flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.04] text-violet-100/78">${getTokenIconSvg(resource.kind)}</span>`;
  const selectedOverlay =
    '<span data-token-selection-overlay="true" class="pointer-events-none absolute inset-0 rounded-[8px] bg-cyan-300/0 transition-colors group-data-[selected=true]/token:bg-cyan-300/32"></span>';

  return `<span contenteditable="false" data-mention-text="${escapeHtml(mentionText)}" data-selected="false" class="prompt-token-mention group/token relative mx-1 inline-flex h-7 w-7 align-middle data-[selected=true]:shadow-[0_0_0_2px_rgba(103,232,249,0.44)]">${body}${selectedOverlay}${badge}</span>`;
}

function buildEditorHtml(value: string, resources: MentionResource[]) {
  return resolveMentionDisplayParts(value, resources)
    .map((part) =>
      part.kind === "mention"
        ? renderTokenHtml(part.resource, part.index, part.mentionText)
        : escapeHtml(part.text).replace(/\n/g, "<br>")
    )
    .join("");
}

export function getPromptTokenEditorPasteHtml(value: string, resources: MentionResource[]) {
  return buildEditorHtml(value, resources);
}

function serializeEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return Array.from(node.childNodes).map(serializeEditorNode).join("");
  }
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.mentionText) return node.dataset.mentionText;
  if (node.tagName === "BR") return "\n";
  return Array.from(node.childNodes).map(serializeEditorNode).join("");
}

function getCaretTextOffset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) return serializeEditorNode(root).length;
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(root);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  const fragment = preCaretRange.cloneContents();
  return serializeEditorNode(fragment).length;
}

function serializeEditor(root: HTMLElement) {
  return Array.from(root.childNodes).map(serializeEditorNode).join("");
}

function setMentionTokenSelectionState(root: HTMLElement) {
  const selection = window.getSelection();
  const hasActiveRange =
    Boolean(selection) &&
    selection!.rangeCount > 0 &&
    !selection!.isCollapsed &&
    selection!.getRangeAt(0).intersectsNode(root);
  const range = hasActiveRange ? selection!.getRangeAt(0) : null;

  root.querySelectorAll<HTMLElement>("[data-mention-text]").forEach((token) => {
    token.dataset.selected = range?.intersectsNode(token) ? "true" : "false";
  });
}

function insertFragmentAtSelection(root: HTMLElement, fragment: DocumentFragment) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return false;
  const lastNode = fragment.lastChild;
  range.deleteContents();
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return true;
}

export function getPromptTokenEditorResourceSignature(resources: readonly MentionResource[]) {
  return resources
    .map((resource) => `${resource.kind}\u0001${resource.title}\u0001${resource.value}`)
    .join("\u0002");
}

export function shouldRefreshPromptTokenEditorHtml({
  editorIsActive,
  hasRenderedHtml,
  lastRenderedResourceSignature,
  lastRenderedValue,
  resourceSignature,
  serializedValue,
  value,
}: {
  editorIsActive: boolean;
  hasRenderedHtml: boolean;
  lastRenderedResourceSignature: string;
  lastRenderedValue: string;
  resourceSignature: string;
  serializedValue: string;
  value: string;
}) {
  const renderedValueIsCurrent = lastRenderedValue === value;
  const renderedResourcesAreCurrent = lastRenderedResourceSignature === resourceSignature;
  if (editorIsActive && serializedValue === value && renderedResourcesAreCurrent) return false;
  if (renderedValueIsCurrent && renderedResourcesAreCurrent && hasRenderedHtml) return false;
  return true;
}

function placeCaretAtEnd(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getOptionIndex(resources: MentionResource[], mentionText: string) {
  return Math.max(
    0,
    buildMentionOptions(resources).findIndex((option) => option.mentionText === mentionText)
  );
}

function insertTokenAtSelection(token: Node, trailingSpace: Text) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(trailingSpace);
  range.insertNode(token);
  range.setStartAfter(trailingSpace);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertMentionAtSelection(
  root: HTMLElement,
  mentionText: string,
  resource: MentionResource,
  resources: MentionResource[]
) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return false;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer;
    const text = textNode.textContent ?? "";
    const beforeCaret = text.slice(0, range.startOffset);
    const atIndex = beforeCaret.lastIndexOf("@");
    if (atIndex >= 0 && !/\s/.test(beforeCaret.slice(atIndex + 1))) {
      const replaceRange = document.createRange();
      replaceRange.setStart(textNode, atIndex);
      replaceRange.setEnd(textNode, range.startOffset);
      selection.removeAllRanges();
      selection.addRange(replaceRange);
    }
  }

  const wrapper = document.createElement("span");
  wrapper.innerHTML = renderTokenHtml(
    resource,
    getOptionIndex(resources, mentionText),
    mentionText
  );
  const token = wrapper.firstChild;
  if (!token) return false;
  insertTokenAtSelection(token, document.createTextNode(" "));
  return true;
}

function PromptTokenEditorImpl<T extends MentionResource>(
  {
    className = "",
    onBlur,
    onChange,
    onEscape,
    placeholder,
    resources,
    style,
    value,
  }: PromptTokenEditorProps<T>,
  ref: React.ForwardedRef<PromptTokenEditorHandle>
) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const lastRenderedValueRef = React.useRef<string>("");
  const lastRenderedResourceSignatureRef = React.useRef<string>("");
  const [mentionMenuOpen, setMentionMenuOpen] = React.useState(false);
  const [empty, setEmpty] = React.useState(value.length === 0);

  React.useImperativeHandle(ref, () => ({
    focus: () => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      placeCaretAtEnd(editor);
    },
  }));

  React.useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const resourceSignature = getPromptTokenEditorResourceSignature(resources);
    if (
      !shouldRefreshPromptTokenEditorHtml({
        editorIsActive: document.activeElement === editor,
        hasRenderedHtml: Boolean(editor.innerHTML),
        lastRenderedResourceSignature: lastRenderedResourceSignatureRef.current,
        lastRenderedValue: lastRenderedValueRef.current,
        resourceSignature,
        serializedValue: serializeEditor(editor),
        value,
      })
    )
      return;
    editor.innerHTML = buildEditorHtml(value, resources);
    lastRenderedValueRef.current = value;
    lastRenderedResourceSignatureRef.current = resourceSignature;
    setEmpty(value.length === 0);
  }, [resources, value]);

  React.useEffect(() => {
    const handleSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      setMentionTokenSelectionState(editor);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const syncValue = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextValue = serializeEditor(editor);
    lastRenderedValueRef.current = nextValue;
    setEmpty(nextValue.length === 0);
    onChange(nextValue);
    setMentionMenuOpen(
      resources.length > 0 && shouldShowMentionMenu(nextValue, getCaretTextOffset(editor))
    );
  }, [onChange, resources]);

  return (
    <div className="relative h-full min-w-0 w-full">
      {empty && placeholder && (
        <div className="pointer-events-none absolute inset-0 px-1 text-slate-400/42">
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-node-action="true"
        data-canvas-passthrough="true"
        role="textbox"
        aria-multiline="true"
        spellCheck={false}
        style={style}
        className={`relative min-w-0 cursor-text overflow-y-auto whitespace-pre-wrap break-words px-1 text-slate-100/88 caret-[#67e8f9] outline-none transition-colors duration-150 selection:bg-cyan-300/32 selection:text-white empty:before:content-[''] ${className}`}
        onInput={syncValue}
        onFocus={syncValue}
        onBlur={onBlur}
        onMouseUp={() => {
          const editor = editorRef.current;
          if (editor) setMentionTokenSelectionState(editor);
        }}
        onKeyUp={() => {
          const editor = editorRef.current;
          if (editor) setMentionTokenSelectionState(editor);
        }}
        onCopy={(event) => {
          const editor = editorRef.current;
          const selection = window.getSelection();
          if (!editor || !selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          if (!editor.contains(range.commonAncestorContainer)) return;
          const copiedText = serializeEditorNode(range.cloneContents());
          if (!copiedText) return;
          event.preventDefault();
          event.clipboardData.setData("text/plain", copiedText);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setMentionMenuOpen(false);
            onEscape?.();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          const editor = editorRef.current;
          if (!editor) return;
          const template = document.createElement("template");
          template.innerHTML = getPromptTokenEditorPasteHtml(text, resources);
          if (!insertFragmentAtSelection(editor, template.content)) {
            document.execCommand("insertText", false, text);
          }
          syncValue();
        }}
        onWheel={(event) => event.stopPropagation()}
      />
      {mentionMenuOpen && (
        <InputResourceMentionMenu
          resources={resources}
          onPick={(mentionText, resource) => {
            const editor = editorRef.current;
            if (!editor) return;
            editor.focus();
            if (insertMentionAtSelection(editor, mentionText, resource, resources)) {
              syncValue();
              setMentionMenuOpen(false);
            }
          }}
          onRequestClose={() => setMentionMenuOpen(false)}
        />
      )}
    </div>
  );
}

export const PromptTokenEditor = React.forwardRef(PromptTokenEditorImpl) as <
  T extends MentionResource,
>(
  props: PromptTokenEditorProps<T> & React.RefAttributes<PromptTokenEditorHandle>
) => React.ReactElement;
