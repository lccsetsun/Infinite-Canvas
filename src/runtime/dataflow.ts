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
  nodeOutputs: NodeOutputMap,
  nodes: GraphNode[] = []
): Record<string, unknown> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const inputs: Record<string, unknown> = {};
  target.inputs.forEach((input, idx) => {
    const inputLinks = links.filter((l) => l.toNodeId === target.id && l.toInputIndex === idx);
    if (inputLinks.length === 0) return;
    const inputName = getResolvedInputName(target, input.name);
    const values = inputLinks
      .map((link) => {
        const sourceNode = nodeById.get(link.fromNodeId);
        const extractedFrameInput = sourceNode
          ? getExtractedFrameInputOutput(target, sourceNode)
          : undefined;
        if (extractedFrameInput !== undefined) return extractedFrameInput;
        const groupedSourceOutput = sourceNode ? getGroupedNodeOutput(sourceNode) : undefined;
        if (groupedSourceOutput !== undefined) return groupedSourceOutput;
        const sourceOutputs = nodeOutputs.get(link.fromNodeId);
        if (sourceOutputs?.has(link.fromOutputIndex)) {
          return sourceOutputs.get(link.fromOutputIndex);
        }
        return sourceNode ? getNodePropertyOutputFallback(sourceNode) : undefined;
      })
      .filter((value) => value !== undefined);
    if (values.length === 0) return;
    inputs[inputName] = values.length === 1 ? values[0] : values;
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
    result.set(node.id, resolveNodeInputs(node, links, nodeOutputs, nodes));
  });
  return result;
}

function pickFirstValue(...values: unknown[]): unknown {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (value !== null && value !== undefined) return value;
  }
  return undefined;
}

function pickStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

function getGroupedNodeOutput(node: GraphNode): unknown {
  if (node.type === "image_node" || node.type === "load_image") {
    return pickStringArray(node.data?.imageUrls) || pickStringArray(node.properties.imageUrls);
  }
  return undefined;
}

function getExtractedFrameInputOutput(target: GraphNode, sourceNode: GraphNode): unknown {
  if (target.type !== "image_node" || sourceNode.type !== "image_node") return undefined;
  if (target.data?.extractedFrameSourceNodeId !== sourceNode.id) return undefined;
  const frameIndex =
    typeof target.data?.extractedFrameIndex === "number" ? target.data.extractedFrameIndex : -1;
  if (frameIndex < 0) return undefined;
  const urls =
    pickStringArray(sourceNode.data?.imageUrls) || pickStringArray(sourceNode.properties.imageUrls);
  return urls?.[frameIndex];
}

function getNodePropertyOutputFallback(node: GraphNode): unknown {
  if (node.type === "text_node") {
    return pickFirstValue(
      node.data?.response,
      node.properties.response,
      node.properties.text,
      node.data?.text
    );
  }

  if (node.type === "image_node" || node.type === "load_image") {
    const imageUrls = getGroupedNodeOutput(node);
    if (imageUrls) return imageUrls;
    return pickFirstValue(
      node.data?.imageUrl,
      node.properties.imageUrl,
      node.data?.image,
      node.properties.image
    );
  }

  if (node.type === "video_node" || node.type === "video_viewer") {
    return pickFirstValue(node.data?.videoUrl, node.properties.videoUrl);
  }

  if (node.type === "audio_node") {
    return pickFirstValue(node.data?.audioUrl, node.properties.audioUrl);
  }

  return pickFirstValue(
    node.data?.response,
    node.properties.response,
    node.properties.value,
    node.properties.text,
    node.data?.text
  );
}

function getResolvedInputName(target: GraphNode, inputName: string): string {
  if (target.type === "text_node" && inputName === "system_prompt") {
    return "user_prompt";
  }
  return inputName;
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
