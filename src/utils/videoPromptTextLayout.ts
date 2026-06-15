import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphLink, GraphNode } from "../types";

const PROMPT_TEXT_NODE_OFFSET_X = 620;
const PROMPT_TEXT_NODE_OFFSET_Y = 0;
const PROMPT_TEXT_NODE_FRAME_CHILD_GAP = 96;
const FALLBACK_FRAME_CHILD_HEIGHT = 360;

export type VideoPromptTextSnapshot = {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  createdNode: GraphNode;
};

function getInputIndex(node: GraphNode, inputName: string, fallbackIndex: number) {
  const index = node.inputs.findIndex((input) => input.name === inputName);
  return index >= 0 ? index : fallbackIndex;
}

function getFrameCaptureChildHeight(node: GraphNode) {
  const height =
    node.data?.videoNodeHeight ??
    node.data?.imageNodeHeight ??
    node.data?.textNodeHeight ??
    node.data?.videoDisplayHeight ??
    node.data?.imageDisplayHeight ??
    node.data?.imageNaturalHeight ??
    node.data?.videoNaturalHeight;
  return typeof height === "number" && Number.isFinite(height) && height > 0
    ? height
    : FALLBACK_FRAME_CHILD_HEIGHT;
}

function getVideoPromptTextPosition(nodes: GraphNode[], sourceNode: GraphNode) {
  const frameCaptureChildren = nodes
    .filter((node) => node.data?.frameCaptureSourceNodeId === sourceNode.id)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const firstChild = frameCaptureChildren[0];
  if (firstChild) {
    return {
      x: firstChild.x,
      y: firstChild.y + getFrameCaptureChildHeight(firstChild) + PROMPT_TEXT_NODE_FRAME_CHILD_GAP,
    };
  }

  return {
    x: sourceNode.x + PROMPT_TEXT_NODE_OFFSET_X,
    y: sourceNode.y + PROMPT_TEXT_NODE_OFFSET_Y,
  };
}

export function createVideoPromptTextSnapshot({
  nodes,
  links,
  nodeOutputs,
  sourceNodeId,
  prompt,
  makeId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  sourceNodeId: string;
  prompt: string;
  makeId: (prefix: string) => string;
}): VideoPromptTextSnapshot | null {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId);
  const normalizedPrompt = prompt.trim();
  if (!sourceNode || !normalizedPrompt) return null;
  const position = getVideoPromptTextPosition(nodes, sourceNode);

  const textNodeId = makeId("node");
  const textNode = createNodeFromType(
    "text_node",
    textNodeId,
    position.x,
    position.y
  );
  textNode.title = "视频反推提示词";
  textNode.properties = {
    ...textNode.properties,
    response: normalizedPrompt,
    status: "success",
    text: normalizedPrompt,
    textMode: "plain",
  };
  textNode.data = {
    ...(textNode.data || {}),
    response: normalizedPrompt,
    status: "success",
    loading: false,
  };

  const nextOutputs = new Map(nodeOutputs);
  nextOutputs.set(textNodeId, new Map([[0, normalizedPrompt]]));

  const nextLinks = [
    ...links,
    {
      id: makeId("link"),
      fromNodeId: sourceNode.id,
      fromOutputIndex: 0,
      toNodeId: textNodeId,
      toInputIndex: getInputIndex(textNode, "source_video", 3),
    },
  ];

  return {
    nodes: [...nodes, textNode],
    links: nextLinks,
    nodeOutputs: nextOutputs,
    createdNode: textNode,
  };
}
