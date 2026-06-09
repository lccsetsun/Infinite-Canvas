import { describe, expect, it } from "vitest";
import { fitVideoSize, getVideoNodeInputReferences } from "./VideoNodeCard";

describe("fitVideoSize", () => {
  it("keeps portrait videos wide enough for the playback controls", () => {
    expect(fitVideoSize({ width: 690, height: 1136 }, "9:16", 520, 390)).toEqual({
      width: 520,
      height: 856,
    });
  });
});

describe("getVideoNodeInputReferences", () => {
  it("collects image inputs as first-frame references", () => {
    expect(
      getVideoNodeInputReferences({
        image: "https://oss.example.com/first-frame.png",
        prompt: "Make the scene move",
        duration: 6,
      })
    ).toEqual([
      {
        key: "image",
        kind: "image",
        label: "Image",
        title: "First frame",
        value: "https://oss.example.com/first-frame.png",
      },
      {
        key: "prompt",
        kind: "text",
        label: "Text",
        title: "Prompt",
        value: "Make the scene move",
      },
    ]);
  });

  it("collects every image when one image input receives multiple links", () => {
    expect(
      getVideoNodeInputReferences({
        image: [
          "https://oss.example.com/first-frame.png",
          "https://oss.example.com/second-frame.png",
        ],
      }).map((reference) => reference.value)
    ).toEqual([
      "https://oss.example.com/first-frame.png",
      "https://oss.example.com/second-frame.png",
    ]);
  });
});
