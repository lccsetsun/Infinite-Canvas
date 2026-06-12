import { GraphLink, GraphNode } from "../types";
import type { CanvasGraphIndex } from "./canvasGraphIndex";
import { findFirstCompatibleInputIndex, getLinkDraftIssue, isDataTypeCompatible } from "./linking";

export function resolveAutoConnectTarget(args: {
  candidateInputIndex?: number;
  candidateNodeId: string;
  fromNodeId: string;
  fromOutputIndex: number;
  graphIndex?: CanvasGraphIndex;
  links: GraphLink[];
  nodes: GraphNode[];
}): { nodeId: string; inputIndex: number } | null {
  const { candidateInputIndex = 0, candidateNodeId, fromNodeId, fromOutputIndex, graphIndex, links, nodes } = args;
  const fromNode = graphIndex?.nodeById.get(fromNodeId) ?? nodes.find((node) => node.id === fromNodeId);
  const toNode = graphIndex?.nodeById.get(candidateNodeId) ?? nodes.find((node) => node.id === candidateNodeId);
  const fromOutput = fromNode?.outputs[fromOutputIndex];
  if (!fromNode || !toNode || !fromOutput || toNode.inputs.length === 0) return null;

  const requestedInput = toNode.inputs[candidateInputIndex];
  const inputIndex =
    !requestedInput || !isDataTypeCompatible(fromOutput.type, requestedInput.type)
      ? findFirstCompatibleInputIndex(fromNode, toNode, fromOutputIndex)
      : candidateInputIndex;

  const issue = getLinkDraftIssue({
    fromNodeId,
    toNodeId: candidateNodeId,
    fromOutputIndex,
    linkKeySet: graphIndex?.linkKeySet,
    nodeById: graphIndex?.nodeById,
    toInputIndex: inputIndex,
    nodes,
    links,
  });

  return issue ? null : { nodeId: candidateNodeId, inputIndex };
}
