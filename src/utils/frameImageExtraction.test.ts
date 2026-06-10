import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import type { NodeOutputMap } from "../runtime/dataflow";
import {
  createFrameImageChildSnapshot,
  replaceFrameImageFromChildSnapshot,
} from "./frameImageExtraction";

function makeFrameNode(imageUrls: string[]): GraphNode {
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
});
