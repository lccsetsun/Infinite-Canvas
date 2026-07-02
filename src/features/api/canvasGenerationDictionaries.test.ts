import { describe, expect, it } from "vitest";
import {
  buildHistoryCanvasTabsFromDicts,
  buildImageResolutionGroupsFromDicts,
  buildVideoBatchReplacementModeOptionsFromDicts,
  buildVideoResolutionGroupsFromDicts,
} from "./canvasGenerationDictionaries";

describe("canvas generation dictionaries", () => {
  it("builds history canvas tabs from history_canvas dictionary labels", () => {
    expect(
      buildHistoryCanvasTabsFromDicts([
        { dictLabel: "图片历史(8)", dictSort: 1, dictValue: "img_his" },
        { dictLabel: "视频历史(4)", dictSort: 2, dictValue: "video_his" },
        { dictLabel: "音频历史(0)", dictSort: 3, dictValue: "audio_his" },
        { dictLabel: "人像过审资产(0)", dictSort: 4, dictValue: "person_his" },
      ])
    ).toEqual([
      { kind: "image", label: "图片历史(8)", tabType: "img_his" },
      { kind: "video", label: "视频历史(4)", tabType: "video_his" },
      { kind: "audio", label: "音频历史(0)", tabType: "audio_his" },
      { kind: "portrait", label: "人像过审资产(0)", tabType: "person_his" },
    ]);
  });

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

  it("builds batch replacement mode options from batch_edit_image_key dictionary", () => {
    const options = buildVideoBatchReplacementModeOptionsFromDicts([
      { dictLabel: "场景替换", dictSort: 0, dictValue: "scene" },
      { dictLabel: "产品替换", dictSort: 0, dictValue: "product" },
    ]);

    expect(options).toEqual([
      { label: "场景替换", value: "scene" },
      { label: "产品替换", value: "product" },
    ]);
  });

  it("falls back to product and scene when batch replacement dictionary is empty", () => {
    expect(buildVideoBatchReplacementModeOptionsFromDicts([])).toEqual([
      { label: "产品替换", value: "product" },
      { label: "场景替换", value: "scene" },
    ]);
  });
});
