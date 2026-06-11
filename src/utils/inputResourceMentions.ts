import type { ReferencePreviewKind } from "../components/canvas/ReferencePreviewCard";

export type MentionResourceKind = Extract<
  ReferencePreviewKind,
  "text" | "image" | "video" | "audio"
>;

export interface MentionResource {
  kind: MentionResourceKind;
  title: string;
  value: string;
}

export interface MentionOption<T extends MentionResource = MentionResource> {
  label: string;
  mentionText: string;
  resource: T;
}

export type MentionDisplayPart<T extends MentionResource = MentionResource> =
  | { kind: "text"; text: string }
  | { index: number; kind: "mention"; mentionText: string; resource: T };

const RESOURCE_LABELS: Record<MentionResourceKind, string> = {
  audio: "音频",
  image: "图片",
  text: "文本",
  video: "视频",
};

const RESOURCE_MENTION_LABELS: Record<MentionResourceKind, string> = {
  audio: "Audio",
  image: "Image",
  text: "Text",
  video: "Video",
};

export function buildMentionOptions<T extends MentionResource>(
  resources: readonly T[]
): MentionOption<T>[] {
  const counts: Record<MentionResourceKind, number> = {
    audio: 0,
    image: 0,
    text: 0,
    video: 0,
  };

  return resources
    .filter((resource) => ["text", "image", "video", "audio"].includes(resource.kind))
    .map((resource) => {
      counts[resource.kind] += 1;
      return {
        label: `${RESOURCE_LABELS[resource.kind]}${counts[resource.kind]}`,
        mentionText: `{{ ${RESOURCE_MENTION_LABELS[resource.kind]}${counts[resource.kind]} }}`,
        resource,
      };
    });
}

export function getNextMentionMenuIndex(
  currentIndex: number,
  key: "ArrowDown" | "ArrowUp",
  optionCount: number
): number {
  if (optionCount <= 0) return -1;
  const normalizedIndex =
    currentIndex >= 0 && currentIndex < optionCount ? currentIndex : key === "ArrowDown" ? -1 : 0;
  return key === "ArrowDown"
    ? (normalizedIndex + 1) % optionCount
    : (normalizedIndex - 1 + optionCount) % optionCount;
}

export function resolveMentionDisplayParts<T extends MentionResource>(
  value: string,
  resources: readonly T[]
): MentionDisplayPart<T>[] {
  if (!value) return [];

  const options = buildMentionOptions(resources);
  if (options.length === 0) return [{ kind: "text", text: value }];

  const optionByMentionText = new Map(
    options.map((option, index) => [option.mentionText, { ...option, index }])
  );
  const mentionPattern = /\{\{\s*(Image|Text|Video|Audio)(\d+)\s*\}\}/g;
  const parts: MentionDisplayPart<T>[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(value))) {
    const mentionText = `{{ ${match[1]}${match[2]} }}`;
    const option = optionByMentionText.get(mentionText);
    if (!option) continue;

    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: value.slice(lastIndex, match.index) });
    }
    parts.push({
      index: option.index,
      kind: "mention",
      mentionText: option.mentionText,
      resource: option.resource,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push({ kind: "text", text: value.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ kind: "text", text: value }];
}

export function shouldShowMentionMenu(value: string, cursorIndex: number): boolean {
  const beforeCursor = value.slice(0, cursorIndex);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return false;
  const token = beforeCursor.slice(atIndex + 1);
  return !/\s/.test(token);
}

export function insertMentionLabel(
  value: string,
  cursorIndex: number,
  mentionText: string
): { nextValue: string; nextCursorIndex: number } {
  const beforeCursor = value.slice(0, cursorIndex);
  const atIndex = beforeCursor.lastIndexOf("@");
  const replaceStart =
    atIndex >= 0 && !/\s/.test(beforeCursor.slice(atIndex + 1)) ? atIndex : cursorIndex;
  const before = value.slice(0, replaceStart);
  const after = value.slice(cursorIndex);
  const insertion = mentionText;
  const needsSpace = after.length > 0 && !/^\s/.test(after);
  const nextValue = `${before}${insertion}${needsSpace ? " " : ""}${after}`;
  return {
    nextCursorIndex: before.length + insertion.length + (needsSpace ? 1 : 0),
    nextValue,
  };
}
