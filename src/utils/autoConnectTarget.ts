import { GraphLink, GraphNode } from "../types";
import { findFirstCompatibleInputIndex, getLinkDraftIssue, isDataTypeCompatible } from "./linking";

export function resolveAutoConnectTarget(args: {
  candidateInputIndex?: number;
  candidateNodeId: string;
  fromNodeId: string;
  fromOutputIndex: number;
  links: GraphLink[];
  nodes: GraphNode[];
}): { nodeId: string; inputIndex: number } | null {
  const { candidateInputIndex = 0, candidateNodeId, fromNodeId, fromOutputIndex, links, nodes } = args;
  const fromNode = nodes.find((node) => node.id === fromNodeId);
  const toNode = nodes.find((node) => node.id === candidateNodeId);
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
    toInputIndex: inputIndex,
    nodes,
    links,
  });

  return issue ? null : { nodeId: candidateNodeId, inputIndex };
}
