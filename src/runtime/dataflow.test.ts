import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import { resolveNodeInputs } from "./dataflow";

function makeTextNode(id: string, text: string, inputs: GraphNode["inputs"] = []): GraphNode {
  return {
    id,
    type: "text_node",
    title: id,
    x: 0,
    y: 0,
    inputs,
    outputs: [{ name: "text", type: "STRING" }],
    properties: { text, textMode: "plain" },
    data: {},
  };
}

function makeImageNode(id: string, imageUrl: string): GraphNode {
  return {
    id,
    type: "image_node",
    title: id,
    x: 0,
    y: 0,
    inputs: [],
    outputs: [{ name: "image", type: "IMAGE" }],
    properties: { imageUrl },
    data: {},
  };
}

function makeImageGroupNode(id: string, imageUrls: string[]): GraphNode {
  return {
    id,
    type: "image_node",
    title: id,
    x: 0,
    y: 0,
    inputs: [],
    outputs: [{ name: "image", type: "IMAGE" }],
    properties: { imageUrl: imageUrls[0] },
    data: { imageUrl: imageUrls[0], imageUrls },
  };
}

describe("resolveNodeInputs", () => {
  it("falls back to source text node properties when the source has not been executed", () => {
    const source = makeTextNode("source", "Cats, dogs, and pigs");
    const target = makeTextNode("target", "Summarize source", [
      { name: "system_prompt", type: "STRING" },
      { name: "user_prompt", type: "ANY" },
    ]);

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-1",
          fromNodeId: "source",
          fromOutputIndex: 0,
          toNodeId: "target",
          toInputIndex: 1,
        },
      ],
      new Map(),
      [source, target]
    );

    expect(inputs.user_prompt).toBe("Cats, dogs, and pigs");
  });

  it("treats legacy text-node input port zero as the user prompt", () => {
    const source = makeTextNode("source", "Legacy linked source");
    const target = makeTextNode("target", "", [
      { name: "system_prompt", type: "STRING" },
      { name: "user_prompt", type: "ANY" },
    ]);

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-legacy",
          fromNodeId: "source",
          fromOutputIndex: 0,
          toNodeId: "target",
          toInputIndex: 0,
        },
      ],
      new Map(),
      [source, target]
    );

    expect(inputs).toEqual({ user_prompt: "Legacy linked source" });
  });

  it("collects multiple links into the same input as an ordered array", () => {
    const imageA = makeImageNode("image-a", "https://oss.example.com/a.png");
    const imageB = makeImageNode("image-b", "https://oss.example.com/b.png");
    const target: GraphNode = {
      id: "video",
      type: "video_node",
      title: "video",
      x: 0,
      y: 0,
      inputs: [{ name: "image", type: "IMAGE" }],
      outputs: [{ name: "video", type: "VIDEO" }],
      properties: {},
      data: {},
    };

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-a",
          fromNodeId: "image-a",
          fromOutputIndex: 0,
          toNodeId: "video",
          toInputIndex: 0,
        },
        {
          id: "link-b",
          fromNodeId: "image-b",
          fromOutputIndex: 0,
          toNodeId: "video",
          toInputIndex: 0,
        },
      ],
      new Map(),
      [imageA, imageB, target]
    );

    expect(inputs.image).toEqual([
      "https://oss.example.com/a.png",
      "https://oss.example.com/b.png",
    ]);
  });

  it("falls back to the full image group from source node data", () => {
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );
    const frameGrid = makeImageGroupNode("frame-grid", frameImages);
    const target: GraphNode = {
      id: "image-target",
      type: "image_node",
      title: "image target",
      x: 0,
      y: 0,
      inputs: [{ name: "source_image", type: "IMAGE" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {},
    };

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-frames",
          fromNodeId: frameGrid.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 0,
        },
      ],
      new Map(),
      [frameGrid, target]
    );

    expect(inputs.source_image).toEqual(frameImages);
  });

  it("filters excluded frame images while keeping the grouped link connected", () => {
    const frameImages = Array.from(
      { length: 3 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );
    const frameGrid = makeImageGroupNode("frame-grid", frameImages);
    const target: GraphNode = {
      id: "image-target",
      type: "image_node",
      title: "image target",
      x: 0,
      y: 0,
      inputs: [{ name: "source_image", type: "IMAGE" }],
      outputs: [{ name: "image", type: "IMAGE" }],
      properties: {},
      data: {},
    };

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-frames",
          excludedInputValues: [frameImages[1]],
          fromNodeId: frameGrid.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 0,
        },
      ],
      new Map(),
      [frameGrid, target]
    );

    expect(inputs.source_image).toEqual([frameImages[0], frameImages[2]]);
  });

  it("prefers the full image group when stale outputs only contain the first image", () => {
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );
    const frameGrid = makeImageGroupNode("frame-grid", frameImages);
    const target: GraphNode = {
      id: "audio-target",
      type: "audio_node",
      title: "audio target",
      x: 0,
      y: 0,
      inputs: [{ name: "source_image", type: "IMAGE" }],
      outputs: [{ name: "audio", type: "AUDIO" }],
      properties: {},
      data: {},
    };

    const inputs = resolveNodeInputs(
      target,
      [
        {
          id: "link-frames",
          fromNodeId: frameGrid.id,
          fromOutputIndex: 0,
          toNodeId: target.id,
          toInputIndex: 0,
        },
      ],
      new Map([[frameGrid.id, new Map([[0, frameImages[0]]])]]),
      [frameGrid, target]
    );

    expect(inputs.source_image).toEqual(frameImages);
  });

  it("resolves extracted frame child inputs to only the source frame", () => {
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );
    const frameGrid = makeImageGroupNode("frame-grid", frameImages);
    const child: GraphNode = {
      ...makeImageNode("child", frameImages[3]),
      inputs: [{ name: "source_image", type: "IMAGE" }],
      data: {
        imageUrl: frameImages[3],
        imageUrls: [frameImages[3]],
        extractedFrameSourceNodeId: frameGrid.id,
        extractedFrameIndex: 3,
      },
    };

    const inputs = resolveNodeInputs(
      child,
      [
        {
          id: "locked-frame-link",
          fromNodeId: frameGrid.id,
          fromOutputIndex: 0,
          toNodeId: child.id,
          toInputIndex: 0,
          locked: true,
        },
      ],
      new Map([[frameGrid.id, new Map([[0, frameImages]])]]),
      [frameGrid, child]
    );

    expect(inputs.source_image).toBe(frameImages[3]);
  });
});
