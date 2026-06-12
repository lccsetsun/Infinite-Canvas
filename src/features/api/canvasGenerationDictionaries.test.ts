import { describe, expect, it } from "vitest";
import {
  buildImageResolutionGroupsFromDicts,
  buildVideoResolutionGroupsFromDicts,
} from "./canvasGenerationDictionaries";

describe("canvas generation dictionaries", () => {
  it("builds image groups by first reading images_ratio_key dictionary values", () => {
    const groups = buildImageResolutionGroupsFromDicts(
      [
        { dictLabel: "1K", dictSort: 1, dictValue: "images_ratio_1k" },
        { dictLabel: "2K", dictSort: 2, dictValue: "images_ratio_2k" },
      ],
      {
        images_ratio_1k: [{ dictLabel: "9:16", dictValue: "792x1408" }],
        images_ratio_2k: [
          { dictLabel: "9:16", dictSort: 1, dictValue: "1600*2848" },
          { dictLabel: "16:9", dictSort: 2, dictValue: "2848*1600" },
        ],
      }
    );

    expect(groups).toEqual([
      {
        presets: [{ aspectRatio: "9:16", height: 1408, resolution: "1K", width: 792 }],
        resolution: "1K",
      },
      {
        presets: [
          { aspectRatio: "9:16", height: 2848, resolution: "2K", width: 1600 },
          { aspectRatio: "16:9", height: 1600, resolution: "2K", width: 2848 },
        ],
        resolution: "2K",
      },
    ]);
  });

  it("builds video groups from video_ratio and video_p dictionaries", () => {
    const groups = buildVideoResolutionGroupsFromDicts(
      [
        { dictLabel: "16:9", dictValue: "16:9" },
        { dictLabel: "9:16", dictValue: "9:16" },
      ],
      [
        { dictLabel: "480p", dictValue: "480p" },
        { dictLabel: "720p", dictValue: "720p" },
      ]
    );

    expect(groups).toEqual([
      {
        presets: [
          { aspectRatio: "16:9", height: 0, resolution: "480p", width: 0 },
          { aspectRatio: "9:16", height: 0, resolution: "480p", width: 0 },
        ],
        resolution: "480p",
      },
      {
        presets: [
          { aspectRatio: "16:9", height: 0, resolution: "720p", width: 0 },
          { aspectRatio: "9:16", height: 0, resolution: "720p", width: 0 },
        ],
        resolution: "720p",
      },
    ]);
  });
});
