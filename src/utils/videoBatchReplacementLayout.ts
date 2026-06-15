import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { GraphLink, GraphNode } from "../types";

const BATCH_REPLACEMENT_GAP_X = 160;
const BATCH_REPLACEMENT_NODE_WIDTH = 520;
const BATCH_REPLACEMENT_VERTICAL_GAP = 96;
const DEFAULT_VIDEO_CHILD_HEIGHT = 540;

export type VideoBatchReplacementSlotKey = "front" | "side" | "back";
export type VideoBatchReplacementMode = "product" | "scene";

export type VideoBatchReplacementModeOption = {
  label: string;
  value: VideoBatchReplacementMode;
};

export const DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS: VideoBatchReplacementModeOption[] = [
  { label: "产品替换", value: "product" },
  { label: "场景替换", value: "scene" },
];

export type VideoBatchReplacementSlot = {
  key: VideoBatchReplacementSlotKey;
  title: string;
  placeholder: string;
  imageUrl: string;
  ossId?: string;
  prompt: string;
};

export type VideoBatchReplacementSnapshot = {
  nodes: GraphNode[];
  links: GraphLink[];
  createdNode: GraphNode;
};

export function createVideoBatchReplacementSlots(): VideoBatchReplacementSlot[] {
  return [
    {
      key: "front",
      title: "正面",
      placeholder: "请上传正面图",
      imageUrl: "",
      prompt: "正面",
    },
    {
      key: "side",
      title: "侧面",
      placeholder: "请上传侧面图",
      imageUrl: "",
      prompt: "侧面",
    },
    {
      key: "back",
      title: "背面",
      placeholder: "请上传背面图",
      imageUrl: "",
      prompt: "背面",
    },
  ];
}

export function hasFrameAnalysisDescendant(nodes: GraphNode[], sourceNodeId: string) {
  return nodes.some(
    (node) =>
      node.type === "image_node" &&
      node.data?.frameCaptureSourceNodeId === sourceNodeId &&
      node.data?.isFrameStrip === true
  );
}

function getNodeRight(node: GraphNode) {
  const width =
    node.data?.imageNodeWidth ??
    node.data?.videoNodeWidth ??
    node.data?.imageDisplayWidth ??
    node.data?.videoDisplayWidth ??
    BATCH_REPLACEMENT_NODE_WIDTH;
  return node.x + (typeof width === "number" && width > 0 ? width : BATCH_REPLACEMENT_NODE_WIDTH);
}

function getNodeBottom(node: GraphNode) {
  const height =
    node.data?.imageNodeHeight ??
    node.data?.videoNodeHeight ??
    node.data?.imageDisplayHeight ??
    node.data?.videoDisplayHeight ??
    DEFAULT_VIDEO_CHILD_HEIGHT;
  return node.y + (typeof height === "number" && height > 0 ? height : DEFAULT_VIDEO_CHILD_HEIGHT);
}

function getSourceDirectChildNodes(nodes: GraphNode[], links: GraphLink[], sourceNodeId: string) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return links
    .filter((link) => link.fromNodeId === sourceNodeId)
    .map((link) => nodeById.get(link.toNodeId))
    .filter((node): node is GraphNode => Boolean(node))
    .filter((node) => node.type !== "image_node" || node.data?.isFrameStrip !== true)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function getDirectChildPlacement(nodes: GraphNode[], links: GraphLink[], sourceNode: GraphNode) {
  const directChildren = getSourceDirectChildNodes(nodes, links, sourceNode.id);
  if (directChildren.length === 0) {
    return {
      x: getNodeRight(sourceNode) + BATCH_REPLACEMENT_GAP_X,
      y: sourceNode.y,
    };
  }

  const firstColumnChild = directChildren[0];
  const maxBottom = Math.max(...directChildren.map(getNodeBottom));
  return {
    x: firstColumnChild.x,
    y: maxBottom + BATCH_REPLACEMENT_VERTICAL_GAP,
  };
}

export function createVideoBatchReplacementSnapshot({
  nodes,
  links,
  sourceNodeId,
  makeId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  sourceNodeId: string;
  makeId: (prefix: string) => string;
}): VideoBatchReplacementSnapshot | null {
  const sourceNode = nodes.find(
    (node) =>
      node.id === sourceNodeId && node.type === "image_node" && node.data?.isFrameStrip === true
  );
  if (!sourceNode) return null;

  const placement = getDirectChildPlacement(nodes, links, sourceNode);
  const createdNode = createNodeFromType(
    "video_batch_replacement_node",
    makeId("node"),
    placement.x,
    placement.y
  );
  createdNode.title = "批量替换";
  createdNode.data = {
    ...(createdNode.data || {}),
    frameAnalysisSourceNodeId: sourceNode.id,
    frameCaptureSourceNodeId:
      typeof sourceNode.data?.frameCaptureSourceNodeId === "string"
        ? sourceNode.data.frameCaptureSourceNodeId
        : "",
    batchReplacementSlots: createVideoBatchReplacementSlots(),
    batchReplacementMode: "product",
    batchReplacementResolution: "1K",
    batchReplacementAspectRatio: "9:16",
  };

  return {
    nodes: [...nodes, createdNode],
    links: [
      ...links,
      {
        id: makeId("link"),
        fromNodeId: sourceNode.id,
        fromOutputIndex: 0,
        toNodeId: createdNode.id,
        toInputIndex: 0,
      },
    ],
    createdNode,
  };
}
