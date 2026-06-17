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

export type GroupBatchReplacementSourceImage = {
  node: GraphNode;
  ossId: string;
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

function normalizeOssIdValue(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "bigint") return String(value);
  return "";
}

function collectOssIdsFromValue(value: unknown, seen = new Set<unknown>()): string[] {
  const single = normalizeOssIdValue(value);
  if (single) return [single];
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectOssIdsFromValue(item, seen));
  const record = value as Record<string, unknown>;
  return [
    ...collectOssIdsFromValue(record.ossId, seen),
    ...collectOssIdsFromValue(record.ossIds, seen),
    ...collectOssIdsFromValue(record.data, seen),
    ...collectOssIdsFromValue(record.result, seen),
    ...collectOssIdsFromValue(record.results, seen),
    ...collectOssIdsFromValue(record.outputs, seen),
  ];
}

function getGroupImageNodeOssId(node: GraphNode): string {
  return (
    collectOssIdsFromValue(node.data?.ossId)[0] ??
    collectOssIdsFromValue(node.data?.ossIds)[0] ??
    collectOssIdsFromValue(node.properties.ossId)[0] ??
    collectOssIdsFromValue(node.properties.ossIds)[0] ??
    collectOssIdsFromValue(node.data?.frameImageOssIds)[0] ??
    ""
  );
}

export function getGroupBatchReplacementSourceImages(
  nodes: GraphNode[],
  groupId: string
): GroupBatchReplacementSourceImage[] {
  return nodes
    .filter((node) => node.groupId === groupId && node.type === "image_node")
    .map((node) => ({ node, ossId: getGroupImageNodeOssId(node) }))
    .filter((source) => source.ossId.length > 0)
    .sort((a, b) => a.node.y - b.node.y || a.node.x - b.node.x);
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

export function createGroupVideoBatchReplacementSnapshot({
  nodes,
  links,
  groupId,
  makeId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  groupId: string;
  makeId: (prefix: string) => string;
}): VideoBatchReplacementSnapshot | null {
  const sources = getGroupBatchReplacementSourceImages(nodes, groupId);
  if (sources.length === 0) return null;

  const sourceNodes = sources.map((source) => source.node);
  const rightEdge = Math.max(...sourceNodes.map(getNodeRight));
  const top = Math.min(...sourceNodes.map((node) => node.y));
  const createdNode = createNodeFromType(
    "video_batch_replacement_node",
    makeId("node"),
    rightEdge + BATCH_REPLACEMENT_GAP_X,
    top
  );
  createdNode.title = "批量替换";
  createdNode.groupId = groupId;
  createdNode.data = {
    ...(createdNode.data || {}),
    batchReplacementSlots: createVideoBatchReplacementSlots(),
    batchReplacementMode: "product",
    batchReplacementResolution: "1K",
    batchReplacementAspectRatio: "9:16",
    groupBatchReplacementSourceNodeIds: sources.map((source) => source.node.id),
    groupBatchReplacementSourceOssIds: sources.map((source) => source.ossId),
  };

  return {
    nodes: [...nodes, createdNode],
    links: [
      ...links,
      ...sources.map((source) => ({
        id: makeId("link"),
        fromNodeId: source.node.id,
        fromOutputIndex: 0,
        toNodeId: createdNode.id,
        toInputIndex: 0,
      })),
    ],
    createdNode,
  };
}
