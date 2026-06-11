import { describe, expect, it } from "vitest";
import {
  fitVideoSize,
  getVideoDurationSliderPercent,
  getVideoNodeInputReferences,
  normalizeVideoDurationSeconds,
} from "./VideoNodeCard";

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

  it("flattens nested image groups when multiple image inputs are connected", () => {
    expect(
      getVideoNodeInputReferences({
        image: [["https://oss.example.com/a.png"], "https://oss.example.com/b.png"],
      }).map((reference) => reference.value)
    ).toEqual(["https://oss.example.com/a.png", "https://oss.example.com/b.png"]);
  });

  it("expands a frame-analysis image group into individual first-frame references", () => {
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );

    const references = getVideoNodeInputReferences({ image: frameImages });

    expect(references).toHaveLength(7);
    expect(references.map((reference) => reference.kind)).toEqual(Array(7).fill("image"));
    expect(references.map((reference) => reference.value)).toEqual(frameImages);
  });
});

describe("normalizeVideoDurationSeconds", () => {
  it("defaults to five seconds and clamps values to the slider range", () => {
    expect(normalizeVideoDurationSeconds(undefined)).toBe(5);
    expect(normalizeVideoDurationSeconds("12s")).toBe(12);
    expect(normalizeVideoDurationSeconds(0)).toBe(1);
    expect(normalizeVideoDurationSeconds("30s")).toBe(15);
  });
});

describe("getVideoDurationSliderPercent", () => {
  it("maps the 1-15 second range to a percentage", () => {
    expect(getVideoDurationSliderPercent(1)).toBe(0);
    expect(getVideoDurationSliderPercent(8)).toBe(50);
    expect(getVideoDurationSliderPercent(15)).toBe(100);
  });
});
