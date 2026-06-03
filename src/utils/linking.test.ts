import { describe, expect, it } from "vitest";
import {
  findFirstCompatibleInputIndex,
  findFirstCompatibleOutputIndex,
  getLinkDraftIssue,
  getLinkDraftIssueDetail,
  isDataTypeCompatible,
} from "./linking";
import { GraphLink, GraphNode } from "../types";

function mockNode(
  partial: Partial<GraphNode> & Pick<GraphNode, "id" | "title" | "type">
): GraphNode {
  return {
    id: partial.id,
    title: partial.title,
    type: partial.type,
    x: 0,
    y: 0,
    inputs: partial.inputs ?? [],
    outputs: partial.outputs ?? [],
    properties: partial.properties ?? {},
    data: {},
  };
}

describe("isDataTypeCompatible", () => {
  it("accepts same types", () => {
    expect(isDataTypeCompatible("STRING", "STRING")).toBe(true);
  });

  it("accepts ANY from either side", () => {
    expect(isDataTypeCompatible("ANY", "IMAGE")).toBe(true);
    expect(isDataTypeCompatible("VIDEO", "ANY")).toBe(true);
  });

  it("rejects incompatible concrete types", () => {
    expect(isDataTypeCompatible("STRING", "NUMBER")).toBe(false);
  });
});

describe("compatible index helpers", () => {
  const from = mockNode({
    id: "f",
    title: "from",
    type: "string_input",
    outputs: [
      { name: "out0", type: "NUMBER" },
      { name: "out1", type: "STRING" },
    ],
  });
  const to = mockNode({
    id: "t",
    title: "to",
    type: "gemini_assistant",
    inputs: [
      { name: "in0", type: "IMAGE" },
      { name: "in1", type: "STRING" },
    ],
  });

  it("finds first compatible output", () => {
    expect(findFirstCompatibleOutputIndex(from, to, 1)).toBe(1);
  });

  it("finds first compatible input", () => {
    expect(findFirstCompatibleInputIndex(from, to, 1)).toBe(1);
  });

  it("selects the prompt input for legacy video nodes when connecting text output", () => {
    const textNode = mockNode({
      id: "text",
      title: "文本节点",
      type: "text_node",
      outputs: [{ name: "文本", type: "STRING" }],
    });
    const legacyVideoNode = mockNode({
      id: "video",
      title: "视频节点",
      type: "video_node",
      inputs: [
        { name: "duration", type: "NUMBER" },
        { name: "prompt", type: "STRING" },
        { name: "aspect_ratio", type: "STRING" },
      ],
    });

    expect(findFirstCompatibleInputIndex(textNode, legacyVideoNode, 0)).toBe(1);
  });

  it("selects the image input for video nodes when connecting image output", () => {
    const imageNode = mockNode({
      id: "image",
      title: "图片节点",
      type: "image_node",
      outputs: [{ name: "图片", type: "IMAGE" }],
    });
    const videoNode = mockNode({
      id: "video",
      title: "视频节点",
      type: "video_node",
      inputs: [
        { name: "prompt", type: "STRING" },
        { name: "image", type: "IMAGE" },
        { name: "duration", type: "NUMBER" },
      ],
    });

    expect(findFirstCompatibleInputIndex(imageNode, videoNode, 0)).toBe(1);
    expect(
      getLinkDraftIssue({
        fromNodeId: "image",
        toNodeId: "video",
        fromOutputIndex: 0,
        toInputIndex: 1,
        nodes: [imageNode, videoNode],
        links: [],
      })
    ).toBeNull();
  });
});

describe("getLinkDraftIssue", () => {
  const from = mockNode({
    id: "n1",
    title: "from",
    type: "string_input",
    outputs: [{ name: "out", type: "STRING" }],
  });
  const to = mockNode({
    id: "n2",
    title: "to",
    type: "gemini_assistant",
    inputs: [{ name: "in", type: "STRING" }],
  });

  it("returns null for valid link", () => {
    expect(
      getLinkDraftIssue({
        fromNodeId: "n1",
        toNodeId: "n2",
        fromOutputIndex: 0,
        toInputIndex: 0,
        nodes: [from, to],
        links: [],
      })
    ).toBeNull();
  });

  it("rejects duplicate links", () => {
    const links: GraphLink[] = [
      {
        id: "l1",
        fromNodeId: "n1",
        fromOutputIndex: 0,
        toNodeId: "n2",
        toInputIndex: 0,
      },
    ];
    expect(
      getLinkDraftIssue({
        fromNodeId: "n1",
        toNodeId: "n2",
        fromOutputIndex: 0,
        toInputIndex: 0,
        nodes: [from, to],
        links,
      })
    ).toBe("该连线已存在。");
  });

  it("rejects incompatible types", () => {
    const toImage = mockNode({
      id: "n3",
      title: "toImage",
      type: "image_filter",
      inputs: [{ name: "in", type: "IMAGE" }],
    });
    expect(
      getLinkDraftIssue({
        fromNodeId: "n1",
        toNodeId: "n3",
        fromOutputIndex: 0,
        toInputIndex: 0,
        nodes: [from, toImage],
        links: [],
      })
    ).toBe("端口类型不兼容：STRING -> IMAGE");
  });

  it("rejects same-node links", () => {
    expect(
      getLinkDraftIssue({
        fromNodeId: "n1",
        toNodeId: "n1",
        fromOutputIndex: 0,
        toInputIndex: 0,
        nodes: [from, to],
        links: [],
      })
    ).toBe("起点和终点不能是同一个节点。");
  });

  it("rejects invalid output index", () => {
    expect(
      getLinkDraftIssue({
        fromNodeId: "n1",
        toNodeId: "n2",
        fromOutputIndex: 2,
        toInputIndex: 0,
        nodes: [from, to],
        links: [],
      })
    ).toBe("起点输出端口无效。");
  });

  it("rejects node without ports", () => {
    const fromEmpty = mockNode({
      id: "empty",
      title: "empty",
      type: "vae_decode",
      outputs: [],
    });
    expect(
      getLinkDraftIssue({
        fromNodeId: "empty",
        toNodeId: "n2",
        fromOutputIndex: 0,
        toInputIndex: 0,
        nodes: [fromEmpty, to],
        links: [],
      })
    ).toBe("起点节点没有输出端口。");
  });
});

describe("getLinkDraftIssueDetail", () => {
  const from = mockNode({
    id: "n1",
    title: "from",
    type: "string_input",
    outputs: [{ name: "out", type: "STRING" }],
  });
  const to = mockNode({
    id: "n2",
    title: "to",
    type: "gemini_assistant",
    inputs: [{ name: "in", type: "STRING" }],
  });

  it("returns structured code for duplicate link", () => {
    const links: GraphLink[] = [
      {
        id: "l1",
        fromNodeId: "n1",
        fromOutputIndex: 0,
        toNodeId: "n2",
        toInputIndex: 0,
      },
    ];
    const issue = getLinkDraftIssueDetail({
      fromNodeId: "n1",
      toNodeId: "n2",
      fromOutputIndex: 0,
      toInputIndex: 0,
      nodes: [from, to],
      links,
    });

    expect(issue?.code).toBe("DUPLICATE_LINK");
    expect(issue?.message).toBe("该连线已存在。");
  });
});
