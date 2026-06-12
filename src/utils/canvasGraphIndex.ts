import type { GraphLink, GraphNode } from "../types";

export interface GraphLinkKeyParts {
  fromNodeId: string;
  fromOutputIndex: number;
  toNodeId: string;
  toInputIndex: number;
}

export interface CanvasGraphIndex {
  linkKeySet: Set<string>;
  linksBySourceNodeId: Map<string, GraphLink[]>;
  linksByTargetNodeId: Map<string, GraphLink[]>;
  nodeById: Map<string, GraphNode>;
}

export function getGraphLinkKey(link: GraphLinkKeyParts): string {
  return `${link.fromNodeId}:${link.fromOutputIndex}->${link.toNodeId}:${link.toInputIndex}`;
}

export function hasGraphLink(linkKeySet: Set<string>, link: GraphLinkKeyParts): boolean {
  return linkKeySet.has(getGraphLinkKey(link));
}

function appendGroupedLink(map: Map<string, GraphLink[]>, key: string, link: GraphLink) {
  const existing = map.get(key);
  if (existing) existing.push(link);
  else map.set(key, [link]);
}

export function buildCanvasGraphIndex(
  nodes: GraphNode[],
  links: GraphLink[]
): CanvasGraphIndex {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const linkKeySet = new Set<string>();
  const linksBySourceNodeId = new Map<string, GraphLink[]>();
  const linksByTargetNodeId = new Map<string, GraphLink[]>();

  links.forEach((link) => {
    linkKeySet.add(getGraphLinkKey(link));
    appendGroupedLink(linksBySourceNodeId, link.fromNodeId, link);
    appendGroupedLink(linksByTargetNodeId, link.toNodeId, link);
  });

  return {
    linkKeySet,
    linksBySourceNodeId,
    linksByTargetNodeId,
    nodeById,
  };
}
