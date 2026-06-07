import { describe, expect, it } from "vitest";
import { resolveUploadedFileNode } from "./uploadedFileNode";

describe("resolveUploadedFileNode", () => {
  it("maps uploaded images to image preview nodes", () => {
    expect(resolveUploadedFileNode({ name: "scene.png", type: "image/png" }, "https://oss.example.com/scene.png")).toEqual({
      nodeType: "image_node",
      assetKind: "image",
      propKey: "imageUrl",
      assetUrl: "https://oss.example.com/scene.png",
    });
  });

  it("maps uploaded videos to video preview nodes", () => {
    expect(resolveUploadedFileNode({ name: "clip.mp4", type: "video/mp4" }, "https://oss.example.com/clip.mp4")).toMatchObject({
      nodeType: "video_node",
      assetKind: "video",
      propKey: "videoUrl",
    });
  });

  it("maps uploaded audio to audio preview nodes", () => {
    expect(resolveUploadedFileNode({ name: "voice.mp3", type: "audio/mpeg" }, "https://oss.example.com/voice.mp3")).toMatchObject({
      nodeType: "audio_node",
      assetKind: "audio",
      propKey: "audioUrl",
    });
  });

  it("falls back to the file extension when the browser omits the MIME type", () => {
    expect(resolveUploadedFileNode({ name: "voice.wav", type: "" }, "https://oss.example.com/voice.wav")).toMatchObject({
      nodeType: "audio_node",
      assetKind: "audio",
      propKey: "audioUrl",
    });
  });

  it("rejects unsupported local files", () => {
    expect(() => resolveUploadedFileNode({ name: "notes.pdf", type: "application/pdf" }, "https://oss.example.com/notes.pdf")).toThrow(
      "仅支持上传图片、视频或音频文件"
    );
  });
});
