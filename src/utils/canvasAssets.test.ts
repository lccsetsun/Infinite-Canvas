import { describe, expect, it } from "vitest";
import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphNode } from "../types";
import { collectCanvasAssets } from "./canvasAssets";

function makeNode(partial: Partial<GraphNode>): GraphNode {
  return {
    id: "node-1",
    inputs: [],
    outputs: [],
    properties: {},
    title: "图片节点 1",
    type: "image_node",
    x: 0,
    y: 0,
    ...partial,
  };
}

describe("canvas asset collection", () => {
  it("collects media urls from node data, properties, and outputs without duplicates", () => {
    const node = makeNode({
      data: {
        generationFinishedAt: 1_717_286_400_000,
        imageUrl: "https://oss.example.com/a.png",
        imageUrls: [
          "https://oss.example.com/a.png",
          "https://oss.example.com/b.webp",
          "__batch_replacement_frame_placeholder__",
        ],
        videoUrl: "https://oss.example.com/demo.mp4",
      },
      properties: {
        audioUrl: "https://oss.example.com/demo.mp3",
        imageUrls: ["data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E"],
      },
    });
    const nodeOutputs: NodeOutputMap = new Map([
      [
        node.id,
        new Map([
          [
            0,
            {
              url: "https://oss.example.com/c.jpg",
              nested: ["https://oss.example.com/demo.mp4"],
            },
          ],
        ]),
      ],
    ]);

    expect(collectCanvasAssets({ nodes: [node], nodeOutputs }).map((asset) => asset.url)).toEqual([
      "https://oss.example.com/a.png",
      "https://oss.example.com/b.webp",
      "https://oss.example.com/demo.mp4",
      "https://oss.example.com/demo.mp3",
      "https://oss.example.com/c.jpg",
    ]);
    expect(collectCanvasAssets({ nodes: [node], nodeOutputs })[0]?.createdAt).toBe(
      1_717_286_400_000
    );
  });
});
