import type { GraphLink, GraphNode, NodeClass } from "../types";
import { getNodeRect, type Point, type Rect } from "./multiSelection";

export type MultiNodeLayoutCommand =
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontal"
  | "distribute-vertical";

export interface MultiNodeClipboardPayload {
  kind: "ai-studio/multi-node-selection";
  version: 1;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface PastedMultiNodePayload {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodeIds: string[];
}

type IdFactory = (prefix: "node" | "link") => string;

const NUMBERED_NODE_TITLE_PREFIX: Partial<Record<NodeClass, string>> = {
  audio_node: "音频节点",
  image_node: "图片节点",
  text_node: "文本节点",
  video_node: "视频节点",
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMultiNodeClipboardPayload(
  nodes: GraphNode[],
  links: GraphLink[],
  selectedNodeIds: Iterable<string>
): MultiNodeClipboardPayload {
  const selectedIdSet = new Set(selectedNodeIds);
  const selectedNodes = nodes.filter((node) => selectedIdSet.has(node.id)).map(cloneJson);
  const internalLinks = links
    .filter((link) => selectedIdSet.has(link.fromNodeId) && selectedIdSet.has(link.toNodeId))
    .map(cloneJson);

  return {
    kind: "ai-studio/multi-node-selection",
    links: internalLinks,
    nodes: selectedNodes,
    version: 1,
  };
}

export function parseMultiNodeClipboardPayload(text: string): MultiNodeClipboardPayload | null {
  try {
    const payload = JSON.parse(text) as Partial<MultiNodeClipboardPayload>;
    if (
      payload?.kind !== "ai-studio/multi-node-selection" ||
      payload.version !== 1 ||
      !Array.isArray(payload.nodes) ||
      !Array.isArray(payload.links)
    ) {
      return null;
    }

    return {
      kind: payload.kind,
      links: payload.links as GraphLink[],
      nodes: payload.nodes as GraphNode[],
      version: payload.version,
    };
  } catch {
    return null;
  }
}

export function pasteMultiNodeClipboardPayload(
  payload: MultiNodeClipboardPayload,
  {
    anchor,
    existingNodes = [],
    idFactory,
    offset = { x: 48, y: 48 },
  }: {
    anchor?: Point;
    existingNodes?: GraphNode[];
    idFactory: IdFactory;
    offset?: Point;
  }
): PastedMultiNodePayload {
  if (payload.nodes.length === 0) return { links: [], nodes: [], selectedNodeIds: [] };

  const minX = Math.min(...payload.nodes.map((node) => node.x));
  const minY = Math.min(...payload.nodes.map((node) => node.y));
  const dx = anchor ? anchor.x - minX : offset.x;
  const dy = anchor ? anchor.y - minY : offset.y;
  const nodeIdMap = new Map<string, string>();
  const nextTitleNodes = [...existingNodes];

  const nodes = payload.nodes.map((node) => {
    const nextId = idFactory("node");
    nodeIdMap.set(node.id, nextId);
    const nextNode = {
      ...cloneJson(node),
      groupId: null,
      id: nextId,
      title: getNextNumberedNodeTitle(nextTitleNodes, node.type) ?? node.title,
      x: node.x + dx,
      y: node.y + dy,
    };
    nextTitleNodes.push(nextNode);
    return nextNode;
  });

  const links = payload.links
    .filter((link) => nodeIdMap.has(link.fromNodeId) && nodeIdMap.has(link.toNodeId))
    .map((link) => ({
      ...cloneJson(link),
      fromNodeId: nodeIdMap.get(link.fromNodeId)!,
      id: idFactory("link"),
      toNodeId: nodeIdMap.get(link.toNodeId)!,
    }));

  return {
    links,
    nodes,
    selectedNodeIds: nodes.map((node) => node.id),
  };
}

export function getNextNumberedNodeTitle(nodes: GraphNode[], type: NodeClass): string | null {
  const prefix = NUMBERED_NODE_TITLE_PREFIX[type];
  if (!prefix) return null;
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`);
  const max = nodes.reduce((currentMax, node) => {
    if (node.type !== type) return currentMax;
    const match = node.title.match(pattern);
    if (!match) return currentMax;
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return `${prefix} ${max + 1}`;
}

export function getMultiNodeLayoutUpdates(
  nodes: GraphNode[],
  command: MultiNodeLayoutCommand,
  visualRects?: Map<string, Rect>
): Array<{ nodeId: string; x: number; y: number }> {
  if (nodes.length < 2) return [];

  const items = nodes.map((node) => ({ node, rect: visualRects?.get(node.id) ?? getNodeRect(node) }));
  const minX = Math.min(...items.map((item) => item.rect.x));
  const minY = Math.min(...items.map((item) => item.rect.y));
  const maxRight = Math.max(...items.map((item) => item.rect.x + item.rect.width));
  const maxBottom = Math.max(...items.map((item) => item.rect.y + item.rect.height));
  const centerX = (minX + maxRight) / 2;
  const centerY = (minY + maxBottom) / 2;
  const toNodePosition = (
    item: (typeof items)[number],
    nextRectX: number,
    nextRectY: number
  ) => ({
    nodeId: item.node.id,
    x: item.node.x + (nextRectX - item.rect.x),
    y: item.node.y + (nextRectY - item.rect.y),
  });

  if (command === "distribute-horizontal") {
    if (items.length < 3) return [];
    const sorted = [...items].sort((a, b) => a.rect.x - b.rect.x);
    const totalWidth = sorted.reduce((sum, item) => sum + item.rect.width, 0);
    const gap = (maxRight - minX - totalWidth) / (sorted.length - 1);
    let nextX = minX;
    return sorted.map((item) => {
      const update = toNodePosition(item, nextX, item.rect.y);
      nextX += item.rect.width + gap;
      return update;
    });
  }

  if (command === "distribute-vertical") {
    if (items.length < 3) return [];
    const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y);
    const totalHeight = sorted.reduce((sum, item) => sum + item.rect.height, 0);
    const gap = (maxBottom - minY - totalHeight) / (sorted.length - 1);
    let nextY = minY;
    return sorted.map((item) => {
      const update = toNodePosition(item, item.rect.x, nextY);
      nextY += item.rect.height + gap;
      return update;
    });
  }

  return items.map(({ node, rect }) => {
    switch (command) {
      case "align-left":
        return toNodePosition({ node, rect }, minX, rect.y);
      case "align-center":
        return toNodePosition({ node, rect }, centerX - rect.width / 2, rect.y);
      case "align-right":
        return toNodePosition({ node, rect }, maxRight - rect.width, rect.y);
      case "align-top":
        return toNodePosition({ node, rect }, rect.x, minY);
      case "align-middle":
        return toNodePosition({ node, rect }, rect.x, centerY - rect.height / 2);
      case "align-bottom":
        return toNodePosition({ node, rect }, rect.x, maxBottom - rect.height);
      default:
        return { nodeId: node.id, x: node.x, y: node.y };
    }
  });
}
