import { describe, expect, it } from "vitest";
import { getMediaNodeLoadingLabel, isMediaNodeRunning } from "./mediaNodeLoadingState";

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

  it("uses frame analysis copy for video frame extraction", () => {
    expect(
      getMediaNodeLoadingLabel({
        mediaType: "video",
        isUploading: false,
        operation: "frame-analysis",
      })
    ).toBe("正在逐帧分析");
  });
});

describe("isMediaNodeRunning", () => {
  it("treats data loading state as running", () => {
    expect(isMediaNodeRunning({ data: { loading: true }, properties: {} })).toBe(true);
    expect(isMediaNodeRunning({ data: { status: "loading" }, properties: {} })).toBe(true);
  });

  it("treats property loading state as running like text nodes do", () => {
    expect(isMediaNodeRunning({ data: {}, properties: { status: "loading" } })).toBe(true);
  });

  it("does not treat success or idle state as running", () => {
    expect(isMediaNodeRunning({ data: { loading: false, status: "success" }, properties: {} })).toBe(
      false
    );
    expect(isMediaNodeRunning({ data: {}, properties: { status: "idle" } })).toBe(false);
  });
});
