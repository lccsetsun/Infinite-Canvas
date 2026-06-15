import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canSubmitVideoBatchReplacement,
  getVideoBatchReplacementCustomSize,
  getVideoBatchReplacementModelId,
  getVideoBatchReplacementMode,
  getVideoBatchReplacementSlots,
  updateVideoBatchReplacementModel,
  updateVideoBatchReplacementMode,
  updateVideoBatchReplacementSize,
  updateVideoBatchReplacementSlot,
} from "./VideoBatchReplacementNodeCard";
import type { GraphNode } from "../../types";

function makeBatchNode(data: GraphNode["data"] = {}): GraphNode {
  return {
    id: "batch-1",
    type: "video_batch_replacement_node",
    title: "批量替换",
    x: 100,
    y: 200,
    inputs: [{ name: "source_video", type: "VIDEO" }],
    outputs: [{ name: "替换配置", type: "ANY" }],
    properties: {},
    data,
  };
}

describe("VideoBatchReplacementNodeCard helpers", () => {
  it("defaults batch replacement mode to product", () => {
    expect(getVideoBatchReplacementMode(makeBatchNode())).toBe("product");
    expect(getVideoBatchReplacementMode(makeBatchNode({ batchReplacementMode: "scene" }))).toBe(
      "scene"
    );
    expect(
      getVideoBatchReplacementMode(
        makeBatchNode({
          batchReplacementMode: "unknown" as NonNullable<GraphNode["data"]>["batchReplacementMode"],
        })
      )
    ).toBe("product");
  });

  it("updates the batch replacement mode without changing slot data", () => {
    const node = makeBatchNode({
      batchReplacementMode: "product",
      batchReplacementSlots: [
        {
          key: "front",
          title: "正面",
          placeholder: "请上传产品图正面",
          imageUrl: "https://oss.example.com/front.png",
          ossId: "oss-front",
          prompt: "front prompt",
        },
      ],
    });

    expect(updateVideoBatchReplacementMode(node, "scene")).toEqual({
      batchReplacementMode: "scene",
    });
  });

  it("uses the default front, side, and back slots when node data is empty", () => {
    expect(getVideoBatchReplacementSlots(makeBatchNode()).map((slot) => slot.placeholder)).toEqual([
      "请上传产品图正面",
      "请上传产品图侧面",
      "请上传产品图背面",
    ]);
  });

  it("enables submit only after at least one image, custom size, and image model are present", () => {
    expect(
      canSubmitVideoBatchReplacement(
        getVideoBatchReplacementSlots(makeBatchNode()),
        false,
        "792x1408",
        "image-model"
      )
    ).toBe(false);
    expect(
      canSubmitVideoBatchReplacement(
        getVideoBatchReplacementSlots(
          makeBatchNode({
            batchReplacementSlots: [
              {
                key: "front",
                title: "正面",
                placeholder: "请上传产品图正面",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "正面",
              },
            ],
          })
        ),
        false,
        "792x1408",
        "image-model"
      )
    ).toBe(true);
    expect(
      canSubmitVideoBatchReplacement(
        getVideoBatchReplacementSlots(
          makeBatchNode({
            batchReplacementSlots: [
              {
                key: "front",
                title: "正面",
                placeholder: "请上传产品图正面",
                imageUrl: "https://oss.example.com/front.png",
                prompt: "正面",
              },
            ],
          })
        ),
        false,
        "792x1408",
        "image-model"
      )
    ).toBe(false);
    expect(
      canSubmitVideoBatchReplacement(
        getVideoBatchReplacementSlots(
          makeBatchNode({
            batchReplacementSlots: [
              {
                key: "front",
                title: "正面",
                placeholder: "请上传产品图正面",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "正面",
              },
            ],
          })
        ),
        false,
        "",
        "image-model"
      )
    ).toBe(false);
    expect(
      canSubmitVideoBatchReplacement(
        getVideoBatchReplacementSlots(
          makeBatchNode({
            batchReplacementSlots: [
              {
                key: "front",
                title: "正面",
                placeholder: "请上传产品图正面",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "正面",
              },
            ],
          })
        ),
        false,
        "792x1408",
        ""
      )
    ).toBe(false);
    expect(
      canSubmitVideoBatchReplacement(
        getVideoBatchReplacementSlots(
          makeBatchNode({
            batchReplacementSlots: [
              {
                key: "front",
                title: "正面",
                placeholder: "请上传产品图正面",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "正面",
              },
            ],
          })
        ),
        true,
        "792x1408",
        "image-model"
      )
    ).toBe(false);
  });

  it("stores and resolves the selected custom size", () => {
    const node = makeBatchNode({
      ...updateVideoBatchReplacementSize(makeBatchNode(), "1K", "9:16"),
    });

    expect(getVideoBatchReplacementCustomSize(node)).toBe("792x1408");
  });

  it("stores and resolves the selected image model", () => {
    const node = makeBatchNode({
      ...updateVideoBatchReplacementModel(makeBatchNode(), "wan2.7-image-pro"),
    });

    expect(getVideoBatchReplacementModelId(node)).toBe("wan2.7-image-pro");
  });

  it("updates one slot without dropping the other slot values", () => {
    const node = makeBatchNode({
      batchReplacementSlots: [
        {
          key: "front",
          title: "正面",
          placeholder: "请上传产品图正面",
          imageUrl: "https://oss.example.com/front.png",
          prompt: "front prompt",
        },
        {
          key: "side",
          title: "侧面",
          placeholder: "请上传产品图侧面",
          imageUrl: "",
          prompt: "侧面",
        },
        {
          key: "back",
          title: "背面",
          placeholder: "请上传产品图背面",
          imageUrl: "",
          prompt: "背面",
        },
      ],
    });

    expect(
      updateVideoBatchReplacementSlot(node, "side", {
        imageUrl: "https://oss.example.com/side.png",
      })
    ).toEqual({
      batchReplacementSlots: [
        {
          key: "front",
          title: "正面",
          placeholder: "请上传产品图正面",
          imageUrl: "https://oss.example.com/front.png",
          prompt: "front prompt",
        },
        {
          key: "side",
          title: "侧面",
          placeholder: "请上传产品图侧面",
          imageUrl: "https://oss.example.com/side.png",
          prompt: "侧面",
        },
        {
          key: "back",
          title: "背面",
          placeholder: "请上传产品图背面",
          imageUrl: "",
          prompt: "背面",
        },
      ],
    });
  });

  it("clears one uploaded slot without changing its prompt", () => {
    const node = makeBatchNode({
      batchReplacementSlots: [
        {
          key: "front",
          title: "正面",
          placeholder: "请上传产品图正面",
          imageUrl: "https://oss.example.com/front.png",
          prompt: "front prompt",
        },
        {
          key: "side",
          title: "侧面",
          placeholder: "请上传产品图侧面",
          imageUrl: "https://oss.example.com/side.png",
          prompt: "侧面",
        },
      ],
    });

    expect(updateVideoBatchReplacementSlot(node, "front", { imageUrl: "", ossId: "" })).toEqual({
      batchReplacementSlots: [
        {
          key: "front",
          title: "正面",
          placeholder: "请上传产品图正面",
          imageUrl: "",
          ossId: "",
          prompt: "front prompt",
        },
        {
          key: "side",
          title: "侧面",
          placeholder: "请上传产品图侧面",
          imageUrl: "https://oss.example.com/side.png",
          ossId: undefined,
          prompt: "侧面",
        },
        {
          key: "back",
          title: "背面",
          placeholder: "请上传产品图背面",
          imageUrl: "",
          ossId: undefined,
          prompt: "背面",
        },
      ],
    });
  });

  it("updates and preserves uploaded oss ids for valid product images", () => {
    const node = makeBatchNode();

    expect(
      updateVideoBatchReplacementSlot(node, "front", {
        imageUrl: "https://oss.example.com/front.png",
        ossId: "oss-front",
      }).batchReplacementSlots?.[0]
    ).toMatchObject({
      imageUrl: "https://oss.example.com/front.png",
      ossId: "oss-front",
    });
  });
});

describe("VideoBatchReplacementNodeCard source", () => {
  it("renders upload/drop cards, editable prompts, and a submit button", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('accept="image/*"');
    expect(source).toContain("onDrop=");
    expect(source).toContain("slot.placeholder");
    expect(source).toContain("disabled={!canSubmit}");
    expect(source).toContain("onSubmit?.(node.id, slots, replacementMode)");
    expect(source).toContain("ImageResolutionPicker");
    expect(source).toContain("getVideoBatchReplacementCustomSize");
    expect(source).toContain("请选择图片模型");
    expect(source).toContain("updateVideoBatchReplacementModel");
    expect(source).toContain("isSubmitting");
    expect(source).toContain("提交中");
    expect(source).toContain("提交");
  });

  it("renders product and scene replacement mode controls", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS");
    expect(source).toContain("replacementModeOptions");
    expect(source).toContain("modeOptions.map");
    expect(source).toContain("replacementMode === option.value");
    expect(source).toContain("writeModePatch(option.value)");
  });

  it("does not render the top-right copy action", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain(">复制<");
    expect(source).not.toContain("onDuplicate");
  });

  it("renders inline plus canvas ports and keeps the main card surface draggable", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("InlineNodePortHandle");
    expect(source).toContain("shouldShowInlinePortHandles");
    expect(source).toContain('role="input"');
    expect(source).toContain('role="output"');
    expect(source).toContain('data-node-action="true"');
    expect(source).not.toContain('className="grid grid-cols-3 gap-3" data-node-action="true"');
    expect(source).not.toContain("<label");
    expect(source).toContain('data-node-action="true"');
  });

  it("does not use label-backed file inputs so internal image drags do not trigger upload", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("<label");
    expect(source).toContain("fileInputRefs");
    expect(source).toContain("fileInputRefs.current[slot.key]?.click()");
  });

  it("shows a loading overlay while a slot image is uploading", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("Loader2");
    expect(source).toContain("uploadingKey === slot.key");
    expect(source).toContain("正在上传");
    expect(source).toContain("ossId: uploaded.ossId");
  });

  it("renders a clear button for uploaded slot images", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("清空已上传图片");
    expect(source).toContain('writeSlotPatch(slot.key, { imageUrl: "", ossId: "" })');
  });

  it("supports highlighting the slot currently targeted by an image drag", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("highlightedSlotKey");
    expect(source).toContain("isHighlightedDropTarget");
    expect(source).toContain("ring-cyan-100/70");
  });

  it("does not use whole image node drag hit testing for batch replacement slots", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("getDraggedImageReferenceRect");
    expect(source).not.toContain("getVideoBatchSlotDropTarget");
    expect(source).not.toContain("activeVideoBatchDropTarget");
    expect(source).not.toContain("draggedImageReferenceRef");
  });

  it("requires a selected image model for batch submit", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).toContain("请选择批量替换的图片模型后再提交");
    expect(source).toContain("getVideoBatchReplacementModelId(batchNode)");
    expect(source).not.toContain("return imageModels[0] ?? null");
  });

  it("builds batch submit prompt from valid slot prompts", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).toContain("buildBatchReplacementPrompt(slots)");
    expect(source).toContain("`{{ Image${index + 1}}} 是 ${slot.prompt.trim() || slot.title}`");
  });
});
