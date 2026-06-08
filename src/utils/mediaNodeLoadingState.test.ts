import { describe, expect, it } from "vitest";
import { getMediaNodeLoadingLabel } from "./mediaNodeLoadingState";

describe("getMediaNodeLoadingLabel", () => {
  it("uses upload copy for source asset nodes while uploading", () => {
    expect(getMediaNodeLoadingLabel({ mediaType: "image", isUploading: true })).toBe("上传中");
    expect(getMediaNodeLoadingLabel({ mediaType: "video", isUploading: true })).toBe("上传中");
    expect(getMediaNodeLoadingLabel({ mediaType: "audio", isUploading: true })).toBe("上传中");
  });

  it("uses generation copy for generated media nodes", () => {
    expect(getMediaNodeLoadingLabel({ mediaType: "image", isUploading: false })).toBe(
      "正在生成图片"
    );
    expect(getMediaNodeLoadingLabel({ mediaType: "video", isUploading: false })).toBe(
      "正在生成视频"
    );
    expect(getMediaNodeLoadingLabel({ mediaType: "audio", isUploading: false })).toBe(
      "正在生成音频"
    );
  });
});
