import { describe, expect, it } from "vitest";
import { resolveSingleImageUpload } from "./resolveSingleImageUpload";

describe("resolveSingleImageUpload", () => {
  it("returns the first image file when the user selects one or more files", () => {
    const first = new File(["a"], "cover.png", { type: "image/png" });
    const second = new File(["b"], "ignored.jpg", { type: "image/jpeg" });

    expect(resolveSingleImageUpload([first, second])).toBe(first);
  });

  it("throws when the selected file is not an image", () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

    expect(() => resolveSingleImageUpload([file])).toThrow("只能上传图片文件");
  });

  it("returns null when there is no selected file", () => {
    expect(resolveSingleImageUpload([])).toBeNull();
    expect(resolveSingleImageUpload(null)).toBeNull();
  });
});
