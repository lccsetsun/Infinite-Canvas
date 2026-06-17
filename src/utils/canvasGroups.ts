import type { GraphNode, GroupBox } from "../types";
import { getNodeHeight, getNodeWidth } from "../components/canvas/geometry";

export function getNextGroupTitle(groups: GroupBox[]): string {
  return `分组${groups.length + 1}`;
}

export function getGroupBoundsForNodes(nodes: GraphNode[], padding = 24) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + getNodeWidth(node)));
  const maxY = Math.max(...nodes.map((node) => node.y + getNodeHeight(node)));

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function expandGroupBoundsToIncludeNodes(
  group: GroupBox,
  nodes: GraphNode[],
  padding = 24
): GroupBox {
  if (nodes.length === 0) return group;

  const bounds = getGroupBoundsForNodes(nodes, padding);
  const left = Math.min(group.x, bounds.x);
  const top = Math.min(group.y, bounds.y);
  const right = Math.max(group.x + group.width, bounds.x + bounds.width);
  const bottom = Math.max(group.y + group.height, bounds.y + bounds.height);

  if (
    left === group.x &&
    top === group.y &&
    right === group.x + group.width &&
    bottom === group.y + group.height
  ) {
    return group;
  }

  return {
    ...group,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getNodeCenter(node: GraphNode) {
  return {
    x: node.x + getNodeWidth(node) / 2,
    y: node.y + getNodeHeight(node) / 2,
  };
}

function containsPoint(group: GroupBox, point: { x: number; y: number }) {
  return (
    point.x >= group.x &&
    point.x <= group.x + group.width &&
    point.y >= group.y &&
    point.y <= group.y + group.height
  );
}

export function findTopGroupAtPoint(
  groups: GroupBox[],
  point: { x: number; y: number }
): GroupBox | null {
  return [...groups].reverse().find((group) => containsPoint(group, point)) ?? null;
}

export function getMovedGroupMemberPositions({
  dx,
  dy,
  nodeStarts,
}: {
  dx: number;
  dy: number;
  nodeStarts: Array<{ nodeId: string; x: number; y: number }>;
}) {
  return nodeStarts.map((node) => ({
    nodeId: node.nodeId,
    x: node.x + dx,
    y: node.y + dy,
  }));
}

export function syncNodeGroupMembership(nodes: GraphNode[], groups: GroupBox[]): GraphNode[] {
  if (groups.length === 0 || nodes.length === 0) return nodes;
  let changed = false;
  const nextNodes = nodes.map((node) => {
    const center = getNodeCenter(node);
    const containingGroup = [...groups].reverse().find((group) => containsPoint(group, center));
    const nextGroupId = containingGroup?.id ?? null;
    if ((node.groupId ?? null) === nextGroupId) return node;
    changed = true;
    return { ...node, groupId: nextGroupId };
  });
  return changed ? nextNodes : nodes;
}
