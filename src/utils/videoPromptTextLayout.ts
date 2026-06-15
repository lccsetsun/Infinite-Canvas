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

function getExistingPromptTextChildren(
  nodes: GraphNode[],
  links: GraphLink[],
  sourceNode: GraphNode
) {
  const linkedTargetIds = new Set(
    links.filter((link) => link.fromNodeId === sourceNode.id).map((link) => link.toNodeId)
  );
  return nodes.filter(
    (node) =>
      node.type === "text_node" && node.title === "视频反推提示词" && linkedTargetIds.has(node.id)
  );
}

function getVideoPromptTextPosition(nodes: GraphNode[], links: GraphLink[], sourceNode: GraphNode) {
  const placementChildren = [
    ...nodes.filter((node) => node.data?.frameCaptureSourceNodeId === sourceNode.id),
    ...getExistingPromptTextChildren(nodes, links, sourceNode),
  ].sort((a, b) => a.y - b.y || a.x - b.x);
  const firstChild = placementChildren[0];
  if (firstChild) {
    const maxChildBottom = Math.max(
      ...placementChildren.map((node) => node.y + getFrameCaptureChildHeight(node))
    );
    return {
      x: firstChild.x,
      y: maxChildBottom + PROMPT_TEXT_NODE_FRAME_CHILD_GAP,
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
  const position = getVideoPromptTextPosition(nodes, links, sourceNode);

  const textNodeId = makeId("node");
  const textNode = createNodeFromType("text_node", textNodeId, position.x, position.y);
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
