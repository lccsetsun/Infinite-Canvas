import type { GraphNode } from "../types";

export interface NodePositionUpdate {
  nodeId: string;
  x: number;
  y: number;
}

export function applyNodePositionUpdates(
  nodes: GraphNode[],
  updates: NodePositionUpdate[]
): GraphNode[] {
  if (updates.length === 0) return nodes;

  const updateById = new Map(updates.map((update) => [update.nodeId, update]));
  let changed = false;
  const nextNodes = nodes.map((node) => {
    const update = updateById.get(node.id);
    if (!update || (node.x === update.x && node.y === update.y)) return node;
    changed = true;
    return { ...node, x: update.x, y: update.y };
  });

  return changed ? nextNodes : nodes;
}
