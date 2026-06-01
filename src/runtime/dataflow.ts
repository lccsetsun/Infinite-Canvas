import { GraphLink, GraphNode } from "../types";

export type NodeOutputMap = Map<string, Map<number, unknown>>;

export interface TopoSortResult {
  sorted: GraphNode[];
  hasCycle: boolean;
  cyclePath: string[];
}

export function topologicalSort(nodes: GraphNode[], links: GraphLink[]): TopoSortResult {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeById = new Map<string, GraphNode>();

  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
    nodeById.set(node.id, node);
  });

  links.forEach((link) => {
    if (!nodeById.has(link.fromNodeId) || !nodeById.has(link.toNodeId)) return;
    adjacency.get(link.fromNodeId)!.push(link.toNodeId);
    inDegree.set(link.toNodeId, (inDegree.get(link.toNodeId) || 0) + 1);
  });

  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  const sorted: GraphNode[] = [];
  const visited = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodeById.get(id);
    if (node) sorted.push(node);
    adjacency.get(id)!.forEach((next) => {
      const nextDegree = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    });
  }

  if (sorted.length === nodes.length) {
    return { sorted, hasCycle: false, cyclePath: [] };
  }

  const cyclePath: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree > 0) cyclePath.push(id);
  });

  return { sorted, hasCycle: true, cyclePath };
}

export function resolveNodeInputs(
  target: GraphNode,
  links: GraphLink[],
  nodeOutputs: NodeOutputMap
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  target.inputs.forEach((input, idx) => {
    const link = links.find((l) => l.toNodeId === target.id && l.toInputIndex === idx);
    if (!link) return;
    const sourceOutputs = nodeOutputs.get(link.fromNodeId);
    if (!sourceOutputs) return;
    if (sourceOutputs.has(link.fromOutputIndex)) {
      inputs[input.name] = sourceOutputs.get(link.fromOutputIndex);
    }
  });
  return inputs;
}

export function buildResolvedInputsMap(
  nodes: GraphNode[],
  links: GraphLink[],
  nodeOutputs: NodeOutputMap
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  nodes.forEach((node) => {
    result.set(node.id, resolveNodeInputs(node, links, nodeOutputs));
  });
  return result;
}

export interface LeveledTopoResult {
  levels: GraphNode[][];
  hasCycle: boolean;
  cyclePath: string[];
}

export function topologicalLevels(nodes: GraphNode[], links: GraphLink[]): LeveledTopoResult {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeById = new Map<string, GraphNode>();

  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
    nodeById.set(node.id, node);
  });

  links.forEach((link) => {
    if (!nodeById.has(link.fromNodeId) || !nodeById.has(link.toNodeId)) return;
    adjacency.get(link.fromNodeId)!.push(link.toNodeId);
    inDegree.set(link.toNodeId, (inDegree.get(link.toNodeId) || 0) + 1);
  });

  const remaining = new Map(inDegree);
  const levels: GraphNode[][] = [];
  let frontier: GraphNode[] = nodes.filter((n) => (remaining.get(n.id) || 0) === 0);

  while (frontier.length) {
    levels.push(frontier);
    const next: GraphNode[] = [];
    for (const node of frontier) {
      const neighbors = adjacency.get(node.id) || [];
      for (const nextId of neighbors) {
        const d = (remaining.get(nextId) || 0) - 1;
        remaining.set(nextId, d);
        if (d === 0) {
          const n = nodeById.get(nextId);
          if (n) next.push(n);
        }
      }
    }
    frontier = next;
  }

  const totalReached = levels.reduce((sum, lv) => sum + lv.length, 0);
  if (totalReached === nodes.length) {
    return { levels, hasCycle: false, cyclePath: [] };
  }

  const cyclePath: string[] = [];
  remaining.forEach((d, id) => {
    if (d > 0) cyclePath.push(id);
  });
  return { levels, hasCycle: true, cyclePath };
}
