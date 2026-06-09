import { describe, expect, it } from "vitest";
import { getAudioNodeInputReferences } from "./AudioNodeCard";

describe("getAudioNodeInputReferences", () => {
  it("collects text, image, and audio inputs for the prompt composer", () => {
    expect(
      getAudioNodeInputReferences({
        "提示词": "温暖的钢琴背景音乐",
        source_image: "https://oss.example.com/scene.webp",
        source_audio: "https://oss.example.com/reference.wav",
        "时长": 30,
      }),
    ).toEqual([
      {
        key: "提示词",
        kind: "text",
        label: "文本",
        title: "文本",
        value: "温暖的钢琴背景音乐",
      },
      {
        key: "source_image",
        kind: "image",
        label: "图片",
        title: "图片",
        value: "https://oss.example.com/scene.webp",
      },
      {
        key: "source_audio",
        kind: "audio",
        label: "音频",
        title: "音频",
        value: "https://oss.example.com/reference.wav",
      },
    ]);
  });

  it("ignores duration and empty values", () => {
    expect(
      getAudioNodeInputReferences({
        "提示词": " ",
        "时长": 30,
        speed: 1,
      }),
    ).toEqual([]);
  });

  it("collects every media item when one input receives multiple links", () => {
    expect(
      getAudioNodeInputReferences({
        source_video: [
          "https://oss.example.com/reference-a.mp4",
          "https://oss.example.com/reference-b.mp4",
        ],
      }).map((reference) => reference.value),
    ).toEqual([
      "https://oss.example.com/reference-a.mp4",
      "https://oss.example.com/reference-b.mp4",
    ]);
  });
});
