import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import { collectTextNodeReferences } from "./textNodeReferences";

function makeNode(id: string, type: GraphNode["type"], title: string, value?: string): GraphNode {
  const isImage = type === "image_node";
  const isVideo = type === "video_node";
  return {
    id,
    type,
    title,
    x: 0,
    y: 0,
    inputs: [],
    outputs: [{ name: "out", type: isImage ? "IMAGE" : isVideo ? "VIDEO" : "STRING" }],
    properties: isImage ? { imageUrl: value } : isVideo ? { videoUrl: value } : { text: value },
    data: {},
  };
}

describe("collectTextNodeReferences", () => {
  it("collects upstream image, text, and video references for a text node", () => {
    const textNode = makeNode("target", "text_node", "Text node");
    const imageNode = makeNode(
      "image",
      "image_node",
      "Image node",
      "https://oss.example.com/a.png"
    );
    const upstreamText = makeNode("text", "text_node", "Upstream text", "Prompt text");
    const videoNode = makeNode(
      "video",
      "video_node",
      "Video node",
      "https://oss.example.com/a.mp4"
    );

    const references = collectTextNodeReferences({
      nodes: [textNode, imageNode, upstreamText, videoNode],
      links: [
        { id: "l1", fromNodeId: "image", fromOutputIndex: 0, toNodeId: "target", toInputIndex: 1 },
        { id: "l2", fromNodeId: "text", fromOutputIndex: 0, toNodeId: "target", toInputIndex: 1 },
        { id: "l3", fromNodeId: "video", fromOutputIndex: 0, toNodeId: "target", toInputIndex: 1 },
      ],
      nodeOutputs: new Map([
        ["text", new Map([[0, "Generated text"]])],
        ["video", new Map([[0, "https://oss.example.com/generated.mp4"]])],
      ]),
      textNodeId: "target",
    });

    expect(references).toMatchObject([
      { kind: "image", title: "Image node", value: "https://oss.example.com/a.png" },
      { kind: "text", title: "Upstream text", value: "Generated text" },
      { kind: "video", title: "Video node", value: "https://oss.example.com/generated.mp4" },
    ]);
  });

  it("expands a frame-strip image node into ordered image references", () => {
    const textNode = makeNode("target", "text_node", "Text node");
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://oss.example.com/frame-${index + 1}.png`
    );
    const frameNode: GraphNode = {
      ...makeNode("frames", "image_node", "逐帧分析 1", frameImages[0]),
      data: {
        imageUrl: frameImages[0],
        imageUrls: frameImages,
        isFrameStrip: true,
      },
    };

    const references = collectTextNodeReferences({
      nodes: [textNode, frameNode],
      links: [
        {
          id: "frame-link",
          fromNodeId: "frames",
          fromOutputIndex: 0,
          toNodeId: "target",
          toInputIndex: 1,
        },
      ],
      nodeOutputs: new Map([["frames", new Map([[0, frameImages]])]]),
      textNodeId: "target",
    });

    expect(references).toHaveLength(7);
    expect(references.map((reference) => reference.value)).toEqual(frameImages);
    expect(references.map((reference) => reference.title)).toEqual(
      frameImages.map((_, index) => `逐帧分析 1 · ${index + 1}`)
    );
  });
});
