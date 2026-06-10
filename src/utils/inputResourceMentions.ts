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

export function buildMentionOptions<T extends MentionResource>(resources: T[]): MentionOption<T>[] {
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
