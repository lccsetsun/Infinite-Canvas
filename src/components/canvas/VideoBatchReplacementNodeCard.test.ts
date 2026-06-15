import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canSubmitVideoBatchReplacement,
  formatVideoBatchReplacementElapsedTime,
  getVideoBatchReplacementElapsedLabel,
  getVideoBatchReplacementCustomSize,
  getVideoBatchReplacementModelId,
  getVideoBatchReplacementMode,
  getVideoBatchReplacementSlotPlaceholder,
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
    title: "鎵归噺鏇挎崲",
    x: 100,
    y: 200,
    inputs: [{ name: "source_video", type: "VIDEO" }],
    outputs: [{ name: "鏇挎崲閰嶇疆", type: "ANY" }],
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
          title: "姝ｉ潰",
          placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
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
      "请上传正面图",
      "请上传侧面图",
      "请上传背面图",
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
                title: "姝ｉ潰",
                placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "姝ｉ潰",
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
                title: "姝ｉ潰",
                placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
                imageUrl: "https://oss.example.com/front.png",
                prompt: "姝ｉ潰",
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
                title: "姝ｉ潰",
                placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "姝ｉ潰",
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
                title: "姝ｉ潰",
                placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "姝ｉ潰",
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
                title: "姝ｉ潰",
                placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
                imageUrl: "https://oss.example.com/front.png",
                ossId: "oss-front",
                prompt: "姝ｉ潰",
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
          title: "姝ｉ潰",
          placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
          imageUrl: "https://oss.example.com/front.png",
          prompt: "front prompt",
        },
        {
          key: "side",
          title: "渚ч潰",
          placeholder: "璇蜂笂浼犱骇鍝佸浘渚ч潰",
          imageUrl: "",
          prompt: "渚ч潰",
        },
        {
          key: "back",
          title: "鑳岄潰",
          placeholder: "璇蜂笂浼犱骇鍝佸浘鑳岄潰",
          imageUrl: "",
          prompt: "鑳岄潰",
        },
      ],
    });

    const result = updateVideoBatchReplacementSlot(node, "side", {
      imageUrl: "https://oss.example.com/side.png",
    });

    expect(result.batchReplacementSlots?.map((slot) => slot.placeholder)).toEqual([
      "请上传正面图",
      "请上传侧面图",
      "请上传背面图",
    ]);
    expect(result.batchReplacementSlots?.[0]).toMatchObject({
      key: "front",
      title: "正面",
      imageUrl: "https://oss.example.com/front.png",
      prompt: "front prompt",
    });
    expect(result.batchReplacementSlots?.[1]).toMatchObject({
      key: "side",
      title: "侧面",
      imageUrl: "https://oss.example.com/side.png",
    });
    expect(result.batchReplacementSlots?.[2]).toMatchObject({
      key: "back",
      title: "背面",
      imageUrl: "",
    });
  });

  it("clears one uploaded slot without changing its prompt", () => {
    const node = makeBatchNode({
      batchReplacementSlots: [
        {
          key: "front",
          title: "姝ｉ潰",
          placeholder: "璇蜂笂浼犱骇鍝佸浘姝ｉ潰",
          imageUrl: "https://oss.example.com/front.png",
          prompt: "front prompt",
        },
        {
          key: "side",
          title: "渚ч潰",
          placeholder: "璇蜂笂浼犱骇鍝佸浘渚ч潰",
          imageUrl: "https://oss.example.com/side.png",
          prompt: "渚ч潰",
        },
      ],
    });

    const result = updateVideoBatchReplacementSlot(node, "front", { imageUrl: "", ossId: "" });

    expect(result.batchReplacementSlots?.map((slot) => slot.placeholder)).toEqual([
      "请上传正面图",
      "请上传侧面图",
      "请上传背面图",
    ]);
    expect(result.batchReplacementSlots?.[0]).toMatchObject({
      key: "front",
      title: "正面",
      imageUrl: "",
      ossId: "",
      prompt: "front prompt",
    });
    expect(result.batchReplacementSlots?.[1]).toMatchObject({
      key: "side",
      title: "侧面",
      imageUrl: "https://oss.example.com/side.png",
    });
    expect(result.batchReplacementSlots?.[2]).toMatchObject({
      key: "back",
      title: "背面",
      imageUrl: "",
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

  it("formats batch replacement elapsed time as seconds, minutes, and hours", () => {
    expect(formatVideoBatchReplacementElapsedTime(900)).toBe("1s");
    expect(formatVideoBatchReplacementElapsedTime(59_000)).toBe("59s");
    expect(formatVideoBatchReplacementElapsedTime(60_000)).toBe("1m");
    expect(formatVideoBatchReplacementElapsedTime(3_599_000)).toBe("59m");
    expect(formatVideoBatchReplacementElapsedTime(3_600_000)).toBe("1h");
  });

  it("shows short directional upload placeholder text regardless of selected mode", () => {
    const slot = getVideoBatchReplacementSlots(makeBatchNode())[0];

    expect(getVideoBatchReplacementSlotPlaceholder(slot, "product")).toBe("请上传正面图");
    expect(getVideoBatchReplacementSlotPlaceholder(slot, "scene")).toBe("请上传正面图");
  });

  it("derives the live or final batch replacement elapsed label from node timestamps", () => {
    expect(
      getVideoBatchReplacementElapsedLabel({
        finishedAt: undefined,
        isSubmitting: true,
        now: 4_000,
        startedAt: 1_000,
      })
    ).toBe("3s");
    expect(
      getVideoBatchReplacementElapsedLabel({
        finishedAt: 62_000,
        isSubmitting: false,
        now: 120_000,
        startedAt: 1_000,
      })
    ).toBe("1m");
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
    expect(source).toContain("getVideoBatchReplacementSlotPlaceholder(slot, replacementMode)");
    expect(source).toContain("disabled={!canSubmit}");
    expect(source).toContain("onSubmit?.(node.id, slots, replacementMode)");
    expect(source).toContain("ImageResolutionPicker");
    expect(source).toContain("getVideoBatchReplacementCustomSize");
    expect(source).toContain("getVideoBatchReplacementModelLabel");
    expect(source).toContain("updateVideoBatchReplacementModel");
    expect(source).toContain("isSubmitting");
    expect(source).toContain("Loader2");
    expect(source).toContain("Send");
  });

  it("uses the same dark floating model menu style as image nodes instead of a native select", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("<select");
    expect(source).not.toContain("<option");
    expect(source).toContain("createPortal");
    expect(source).toContain("getFloatingMenuPosition");
    expect(source).toContain("modelMenuPortalRef");
    expect(source).toContain("bg-[#121923]/96");
    expect(source).toContain("backdrop-blur-2xl");
    expect(source).toContain("writeModelPatch(model.modelId)");
  });

  it("disables the batch replacement controls while submitting", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("controlsDisabled");
    expect(source).toContain("aria-disabled={controlsDisabled}");
    expect(source).toContain("pointer-events-none");
    expect(source).toContain("disabled={controlsDisabled}");
    expect(source).toContain("if (controlsDisabled) return");
  });

  it("renders live and final generation elapsed time in the title area", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("elapsedLabel");
    expect(source).toContain("batchReplacementStartedAt");
    expect(source).toContain("batchReplacementFinishedAt");
  });

  it("renders product and scene replacement mode in a floating dropdown", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS");
    expect(source).toContain("replacementModeOptions");
    expect(source).toContain("modeMenuRef");
    expect(source).toContain("modeMenuPortalRef");
    expect(source).toContain("getVideoBatchReplacementModeLabel(replacementMode, modeOptions)");
    expect(source).toContain("modeOptions.map");
    expect(source).toContain("replacementMode === option.value");
    expect(source).toContain("writeModePatch(option.value)");
  });

  it("closes floating dropdowns from outside pointer capture and blocks canvas wheel while open", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('window.addEventListener("pointerdown", handlePointerDown, true)');
    expect(source).toContain('window.removeEventListener("pointerdown", handlePointerDown, true)');
    expect(source).toContain(
      'window.addEventListener("wheel", blockCanvasWheel, { capture: true, passive: false })'
    );
    expect(source).toContain('window.removeEventListener("wheel", blockCanvasWheel, true)');
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("event.stopPropagation();");
  });

  it("does not render the top-right copy action", () => {
    const source = readFileSync(
      new URL("./VideoBatchReplacementNodeCard.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain(">澶嶅埗<");
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

    expect(source).toContain("getVideoBatchReplacementModelId(batchNode)");
    expect(source).not.toContain("return imageModels[0] ?? null");
  });

  it("builds batch submit prompt from valid slot prompts", () => {
    const source = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");

    expect(source).toContain("buildBatchReplacementPrompt(slots)");
    expect(source).toContain("`{{ Image${index + 1}}} 是 ${slot.prompt.trim() || slot.title}`");
  });
});
