import { describe, expect, it } from "vitest";
import {
  buildMentionOptions,
  insertMentionLabel,
  shouldShowMentionMenu,
} from "./inputResourceMentions";

describe("input resource mentions", () => {
  it("numbers resources by media kind", () => {
    expect(
      buildMentionOptions([
        { kind: "image", title: "A", value: "a.png" },
        { kind: "text", title: "T", value: "hello" },
        { kind: "image", title: "B", value: "b.png" },
        { kind: "video", title: "V", value: "v.mp4" },
      ]).map((option) => option.label)
    ).toEqual(["图片1", "文本1", "图片2", "视频1"]);
  });

  it("opens only while editing an @ token", () => {
    expect(shouldShowMentionMenu("参考 @", 4)).toBe(true);
    expect(shouldShowMentionMenu("参考 @图", 5)).toBe(true);
    expect(shouldShowMentionMenu("参考 @图 后续", 8)).toBe(false);
  });

  it("replaces the active @ token with the selected label", () => {
    expect(insertMentionLabel("用 @图 作为首帧", 4, "图片1")).toEqual({
      nextCursorIndex: 6,
      nextValue: "用 @图片1 作为首帧",
    });
  });
});
