import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import type { NodeOutputMap } from "../runtime/dataflow";
import {
  createFrameImageChildSnapshot,
  replaceFrameImageFromChildSnapshot,
  replaceFrameImageUrlSnapshot,
} from "./frameImageExtraction";

function makeFrameNode(imageUrls: string[], frameImageOssIds: string[] = []): GraphNode {
  return {
    id: "frames",
    type: "image_node",
    title: "逐帧分析 1",
    x: 100,
    y: 200,
    inputs: [],
    outputs: [{ name: "image", type: "IMAGE" }],
    properties: { imageUrl: imageUrls[0] },
    data: {
      imageUrl: imageUrls[0],
      imageUrls,
      frameImageOssIds,
      activeImageIndex: 0,
      isFrameStrip: true,
      frameGridColumns: 5,
      frameGridRows: 2,
    },
  };
}

describe("createFrameImageChildSnapshot", () => {
  it("creates an editable image node linked to a source frame index", () => {
    const imageUrls = ["https://oss.example.com/1.png", "https://oss.example.com/2.png"];
    const result = createFrameImageChildSnapshot({
      nodes: [makeFrameNode(imageUrls)],
      links: [],
      sourceNodeId: "frames",
      frameIndex: 1,
      makeId: (prefix) => (prefix === "link" ? "link-child" : "child"),
    });

    expect(result?.createdNode.id).toBe("child");
    expect(result?.createdNode.type).toBe("image_node");
    expect(result?.createdNode.title).toBe("逐帧分析 1 · 第 2 帧");
    expect(result?.createdNode.data).toMatchObject({
      imageUrl: imageUrls[1],
      imageUrls: [imageUrls[1]],
      activeImageIndex: 0,
      extractedFrameSourceNodeId: "frames",
      extractedFrameIndex: 1,
      imageDisplayWidth: 540,
      imageDisplayHeight: 304,
      isSourceNode: true,
      status: "success",
      loading: false,
    });
    expect(result?.links).toEqual([
      {
        id: "link-child",
        fromNodeId: "frames",
        fromOutputIndex: 0,
        toNodeId: "child",
        toInputIndex: 0,
        locked: true,
      },
    ]);
  });

  it("copies the selected frame oss id onto the extracted image node", () => {
    const result = createFrameImageChildSnapshot({
      nodes: [
        makeFrameNode(
          ["https://oss.example.com/1.png", "https://oss.example.com/2.png"],
          ["oss-frame-1", "oss-frame-2"]
        ),
      ],
      links: [],
      sourceNodeId: "frames",
      frameIndex: 1,
      makeId: (prefix) => (prefix === "link" ? "link-child" : "child"),
    });

    expect(result?.createdNode.properties.ossId).toBe("oss-frame-2");
    expect(result?.createdNode.data?.ossId).toBe("oss-frame-2");
  });

  it("uses provided frame dimensions for the initial extracted node preview", () => {
    const result = createFrameImageChildSnapshot({
      nodes: [makeFrameNode(["https://oss.example.com/portrait-frame.png"])],
      links: [],
      sourceNodeId: "frames",
      frameIndex: 0,
      frameNaturalSize: { width: 496, height: 864 },
      makeId: (prefix) => (prefix === "link" ? "link-child" : "child"),
    });

    expect(result?.createdNode.data).toMatchObject({
      imageNaturalWidth: 496,
      imageNaturalHeight: 864,
      imageDisplayWidth: 310,
      imageDisplayHeight: 540,
    });
  });

  it("extracts completed batch replacement result images without requiring an isFrameStrip flag", () => {
    const resultNode: GraphNode = {
      ...makeFrameNode(
        ["https://oss.example.com/result-1.png", "https://oss.example.com/result-2.png"],
        ["oss-result-1", "oss-result-2"]
      ),
      id: "batch-results",
      title: "批量替换结果",
      data: {
        imageUrls: ["https://oss.example.com/result-1.png", "https://oss.example.com/result-2.png"],
        frameImageOssIds: ["oss-result-1", "oss-result-2"],
        batchReplacementRunId: "run-1",
        batchReplacementResultCount: 2,
        isFrameStrip: undefined,
      },
    };

    const result = createFrameImageChildSnapshot({
      nodes: [resultNode],
      links: [],
      sourceNodeId: "batch-results",
      frameIndex: 1,
      makeId: (prefix) => (prefix === "link" ? "link-child" : "child"),
    });

    expect(result?.createdNode.data?.imageUrl).toBe("https://oss.example.com/result-2.png");
    expect(result?.createdNode.data?.ossId).toBe("oss-result-2");
    expect(result?.createdNode.data?.imageNaturalWidth).toBeUndefined();
    expect(result?.createdNode.data?.imageNaturalHeight).toBeUndefined();
    expect(result?.createdNode.data?.imageDisplayWidth).toBeUndefined();
    expect(result?.createdNode.data?.imageDisplayHeight).toBeUndefined();
  });

  it("uses the requested drop position when one is provided", () => {
    const result = createFrameImageChildSnapshot({
      nodes: [makeFrameNode(["https://oss.example.com/1.png"])],
      links: [],
      sourceNodeId: "frames",
      frameIndex: 0,
      position: { x: 420, y: 260 },
      makeId: (prefix) => (prefix === "link" ? "link-child" : "child"),
    });

    expect(result?.createdNode.x).toBe(420);
    expect(result?.createdNode.y).toBe(260);
  });
});

describe("replaceFrameImageFromChildSnapshot", () => {
  it("replaces the original frame without changing order", () => {
    const imageUrls = [
      "https://oss.example.com/1.png",
      "https://oss.example.com/2.png",
      "https://oss.example.com/3.png",
    ];
    const frameNode = makeFrameNode(imageUrls);
    const child = createFrameImageChildSnapshot({
      nodes: [frameNode],
      links: [],
      sourceNodeId: "frames",
      frameIndex: 1,
      makeId: () => "child",
    })!.createdNode;
    const editedChild: GraphNode = {
      ...child,
      data: {
        ...child.data,
        imageUrl: "https://oss.example.com/edited.png",
        imageUrls: ["https://oss.example.com/edited.png"],
      },
      properties: {
        ...child.properties,
        imageUrl: "https://oss.example.com/edited.png",
      },
    };
    const nodeOutputs: NodeOutputMap = new Map<string, Map<number, unknown>>([
      [frameNode.id, new Map<number, unknown>([[0, imageUrls]])],
      [editedChild.id, new Map<number, unknown>([[0, "https://oss.example.com/edited.png"]])],
    ]);

    const result = replaceFrameImageFromChildSnapshot({
      nodes: [frameNode, editedChild],
      nodeOutputs,
      childNodeId: editedChild.id,
    });

    const updatedFrameNode = result?.nodes.find((node) => node.id === frameNode.id);
    expect(updatedFrameNode?.data?.imageUrls).toEqual([
      "https://oss.example.com/1.png",
      "https://oss.example.com/edited.png",
      "https://oss.example.com/3.png",
    ]);
    expect(result?.nodeOutputs.get(frameNode.id)?.get(0)).toEqual(
      updatedFrameNode?.data?.imageUrls
    );
  });

  it("replaces the original frame oss id when the edited child has a new oss id", () => {
    const imageUrls = [
      "https://oss.example.com/1.png",
      "https://oss.example.com/2.png",
      "https://oss.example.com/3.png",
    ];
    const frameNode = makeFrameNode(imageUrls, ["oss-1", "oss-2", "oss-3"]);
    const child = createFrameImageChildSnapshot({
      nodes: [frameNode],
      links: [],
      sourceNodeId: "frames",
      frameIndex: 1,
      makeId: () => "child",
    })!.createdNode;
    const editedChild: GraphNode = {
      ...child,
      data: {
        ...child.data,
        imageUrl: "https://oss.example.com/edited.png",
        imageUrls: ["https://oss.example.com/edited.png"],
        ossId: "oss-edited",
      },
      properties: {
        ...child.properties,
        imageUrl: "https://oss.example.com/edited.png",
        ossId: "oss-edited",
      },
    };
    const nodeOutputs: NodeOutputMap = new Map<string, Map<number, unknown>>([
      [frameNode.id, new Map<number, unknown>([[0, imageUrls]])],
    ]);

    const result = replaceFrameImageFromChildSnapshot({
      nodes: [frameNode, editedChild],
      nodeOutputs,
      childNodeId: editedChild.id,
    });

    const updatedFrameNode = result?.nodes.find((node) => node.id === frameNode.id);
    expect(updatedFrameNode?.data?.frameImageOssIds).toEqual(["oss-1", "oss-edited", "oss-3"]);
    expect(updatedFrameNode?.properties.frameImageOssIds).toEqual(["oss-1", "oss-edited", "oss-3"]);
  });
});

describe("replaceFrameImageUrlSnapshot", () => {
  it("replaces a target frame from an external image url without changing order", () => {
    const imageUrls = [
      "https://oss.example.com/1.png",
      "https://oss.example.com/2.png",
      "https://oss.example.com/3.png",
    ];
    const frameNode = makeFrameNode(imageUrls);
    const nodeOutputs: NodeOutputMap = new Map<string, Map<number, unknown>>([
      [frameNode.id, new Map<number, unknown>([[0, imageUrls]])],
    ]);

    const result = replaceFrameImageUrlSnapshot({
      nodes: [frameNode],
      nodeOutputs,
      sourceNodeId: frameNode.id,
      frameIndex: 2,
      replacementUrl: "https://oss.example.com/replacement.png",
    });

    const updatedFrameNode = result?.nodes.find((node) => node.id === frameNode.id);
    expect(updatedFrameNode?.data?.imageUrls).toEqual([
      "https://oss.example.com/1.png",
      "https://oss.example.com/2.png",
      "https://oss.example.com/replacement.png",
    ]);
    expect(result?.nodeOutputs.get(frameNode.id)?.get(0)).toEqual(
      updatedFrameNode?.data?.imageUrls
    );
  });

  it("replaces the target frame oss id when a dragged image provides one", () => {
    const imageUrls = [
      "https://oss.example.com/1.png",
      "https://oss.example.com/2.png",
      "https://oss.example.com/3.png",
    ];
    const frameNode = makeFrameNode(imageUrls, ["oss-1", "oss-2", "oss-3"]);
    const nodeOutputs: NodeOutputMap = new Map<string, Map<number, unknown>>([
      [frameNode.id, new Map<number, unknown>([[0, imageUrls]])],
    ]);

    const result = replaceFrameImageUrlSnapshot({
      nodes: [frameNode],
      nodeOutputs,
      sourceNodeId: frameNode.id,
      frameIndex: 2,
      replacementUrl: "https://oss.example.com/replacement.png",
      replacementOssId: "oss-replacement",
    });

    const updatedFrameNode = result?.nodes.find((node) => node.id === frameNode.id);
    expect(updatedFrameNode?.data?.frameImageOssIds).toEqual(["oss-1", "oss-2", "oss-replacement"]);
    expect(updatedFrameNode?.properties.frameImageOssIds).toEqual([
      "oss-1",
      "oss-2",
      "oss-replacement",
    ]);
  });

  it("replaces a completed batch replacement result image without requiring an isFrameStrip flag", () => {
    const resultNode: GraphNode = {
      ...makeFrameNode(
        ["https://oss.example.com/result-1.png", "https://oss.example.com/result-2.png"],
        ["oss-result-1", "oss-result-2"]
      ),
      id: "batch-results",
      title: "批量替换结果",
      data: {
        imageUrls: ["https://oss.example.com/result-1.png", "https://oss.example.com/result-2.png"],
        frameImageOssIds: ["oss-result-1", "oss-result-2"],
        batchReplacementRunId: "run-1",
        batchReplacementResultCount: 2,
        isFrameStrip: undefined,
      },
    };
    const nodeOutputs: NodeOutputMap = new Map<string, Map<number, unknown>>([
      [resultNode.id, new Map<number, unknown>([[0, resultNode.data?.imageUrls]])],
    ]);

    const result = replaceFrameImageUrlSnapshot({
      nodes: [resultNode],
      nodeOutputs,
      sourceNodeId: resultNode.id,
      frameIndex: 0,
      replacementUrl: "https://oss.example.com/replacement.png",
      replacementOssId: "oss-replacement",
    });

    const updatedFrameNode = result?.nodes.find((node) => node.id === resultNode.id);
    expect(updatedFrameNode?.data?.imageUrls).toEqual([
      "https://oss.example.com/replacement.png",
      "https://oss.example.com/result-2.png",
    ]);
    expect(updatedFrameNode?.data?.frameImageOssIds).toEqual(["oss-replacement", "oss-result-2"]);
  });
});
