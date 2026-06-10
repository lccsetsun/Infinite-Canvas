import { describe, expect, it } from "vitest";
import {
  EMPTY_AI_MODELS_BY_TYPE,
  getModelOptionGroups,
  groupAiModelsByType,
  type AiModel,
} from "./aiModelCatalog";

describe("ai model catalog", () => {
  it("groups remote AI models into the four supported model types", () => {
    const rows: AiModel[] = [
      {
        id: "text-1",
        apiId: "api-1",
        modelId: "qwen3.7-plus",
        modelType: "文本",
        price: 0.2,
        chargeUnit: 1,
        desc: "",
        isDeleted: 0,
      },
      {
        id: "image-1",
        apiId: "api-1",
        modelId: "wan2.7-image-pro",
        modelType: "图片",
        price: 0.2,
        chargeUnit: 1,
        desc: "",
        isDeleted: 0,
      },
      {
        id: "ignored-1",
        apiId: "api-1",
        modelId: "legacy-model",
        modelType: "其他",
      },
    ];

    expect(groupAiModelsByType(rows)).toEqual({
      文本: [rows[0]],
      图片: [rows[1]],
      视频: [],
      音频: [],
    });
  });

  it("returns independent empty arrays for each supported model type", () => {
    const grouped = groupAiModelsByType([]);

    grouped.文本.push({
      id: "text-1",
      apiId: "api-1",
      modelId: "qwen3",
      modelType: "文本",
    });

    expect(grouped.图片).toEqual([]);
    expect(EMPTY_AI_MODELS_BY_TYPE.文本).toEqual([]);
  });

  it("keeps built-in and remote model options in separate groups without duplicate remote ids", () => {
    const groups = getModelOptionGroups(["deepseek-chat", "deepseek-reasoner"], [
        {
          id: "remote-1",
          apiId: "api-1",
          modelId: "deepseek-chat",
          modelType: "文本",
        },
        {
          id: "remote-2",
          apiId: "api-1",
          modelId: "qwen3.7-plus",
          modelType: "文本",
        },
      ]);

    expect(groups).toEqual({
      builtIn: ["deepseek-chat", "deepseek-reasoner"],
      remote: ["qwen3.7-plus"],
    });
  });
});
