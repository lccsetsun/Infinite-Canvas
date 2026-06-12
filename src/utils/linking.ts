import { DataType, GraphLink, GraphNode } from "../types";
import { getGraphLinkKey } from "./canvasGraphIndex";
import { isSourceNode } from "./sourceNodes";

export type LinkDraftIssueCode =
  | "MISSING_ENDPOINTS"
  | "SAME_NODE"
  | "NODE_NOT_FOUND"
  | "NO_OUTPUT_PORTS"
  | "NO_INPUT_PORTS"
  | "SOURCE_NODE_TARGET"
  | "INVALID_OUTPUT_INDEX"
  | "INVALID_INPUT_INDEX"
  | "INCOMPATIBLE_TYPES"
  | "DUPLICATE_LINK";

export interface LinkDraftIssueDetail {
  code: LinkDraftIssueCode;
  message: string;
}

export function isDataTypeCompatible(outputType: DataType, inputType: DataType): boolean {
  return outputType === "ANY" || inputType === "ANY" || outputType === inputType;
}

export function findFirstCompatibleOutputIndex(
  fromNode: GraphNode,
  toNode: GraphNode,
  toInputIndex: number
): number {
  if (!fromNode.outputs.length || !toNode.inputs.length) return 0;
  if (toInputIndex < 0 || toInputIndex >= toNode.inputs.length) return 0;

  const inputType = toNode.inputs[toInputIndex].type;
  const idx = fromNode.outputs.findIndex((o) => isDataTypeCompatible(o.type, inputType));
  return idx >= 0 ? idx : 0;
}

export function findFirstCompatibleInputIndex(
  fromNode: GraphNode,
  toNode: GraphNode,
  fromOutputIndex: number
): number {
  if (!fromNode.outputs.length || !toNode.inputs.length) return 0;
  if (fromOutputIndex < 0 || fromOutputIndex >= fromNode.outputs.length) return 0;

  const outputType = fromNode.outputs[fromOutputIndex].type;
  const exactIdx = toNode.inputs.findIndex((i) => i.type === outputType);
  if (exactIdx >= 0) return exactIdx;

  const idx = toNode.inputs.findIndex((i) => isDataTypeCompatible(outputType, i.type));
  return idx >= 0 ? idx : 0;
}

export function getLinkDraftIssueDetail(args: {
  fromNodeId: string;
  toNodeId: string;
  fromOutputIndex: number;
  toInputIndex: number;
  linkKeySet?: Set<string>;
  nodes: GraphNode[];
  nodeById?: Map<string, GraphNode>;
  links: GraphLink[];
}): LinkDraftIssueDetail | null {
  const {
    fromNodeId,
    toNodeId,
    fromOutputIndex,
    toInputIndex,
    linkKeySet,
    nodes,
    nodeById,
    links,
  } = args;

  if (!fromNodeId || !toNodeId) {
    return { code: "MISSING_ENDPOINTS", message: "请选择起点节点和终点节点。" };
  }
  if (fromNodeId === toNodeId) {
    return { code: "SAME_NODE", message: "起点和终点不能是同一个节点。" };
  }

  const fromNode = nodeById?.get(fromNodeId) ?? nodes.find((n) => n.id === fromNodeId);
  const toNode = nodeById?.get(toNodeId) ?? nodes.find((n) => n.id === toNodeId);
  if (!fromNode || !toNode) {
    return { code: "NODE_NOT_FOUND", message: "节点不存在或已被删除。" };
  }
  if (fromNode.outputs.length === 0) {
    return { code: "NO_OUTPUT_PORTS", message: "起点节点没有输出端口。" };
  }
  if (isSourceNode(toNode)) {
    return { code: "SOURCE_NODE_TARGET", message: "源节点没有输入端口，不能作为连线终点。" };
  }
  if (toNode.inputs.length === 0) {
    return { code: "NO_INPUT_PORTS", message: "终点节点没有输入端口。" };
  }
  if (fromOutputIndex < 0 || fromOutputIndex >= fromNode.outputs.length) {
    return { code: "INVALID_OUTPUT_INDEX", message: "起点输出端口无效。" };
  }
  if (toInputIndex < 0 || toInputIndex >= toNode.inputs.length) {
    return { code: "INVALID_INPUT_INDEX", message: "终点输入端口无效。" };
  }

  const outType = fromNode.outputs[fromOutputIndex].type;
  const inType = toNode.inputs[toInputIndex].type;
  if (!isDataTypeCompatible(outType, inType)) {
    return {
      code: "INCOMPATIBLE_TYPES",
      message: `端口类型不兼容：${outType} -> ${inType}`,
    };
  }

  const exists = linkKeySet
    ? linkKeySet.has(getGraphLinkKey({ fromNodeId, fromOutputIndex, toNodeId, toInputIndex }))
    : links.some(
        (l) =>
          l.fromNodeId === fromNodeId &&
          l.fromOutputIndex === fromOutputIndex &&
          l.toNodeId === toNodeId &&
          l.toInputIndex === toInputIndex
      );
  if (exists) {
    return { code: "DUPLICATE_LINK", message: "该连线已存在。" };
  }

  return null;
}

export function getLinkDraftIssue(args: {
  fromNodeId: string;
  toNodeId: string;
  fromOutputIndex: number;
  toInputIndex: number;
  linkKeySet?: Set<string>;
  nodes: GraphNode[];
  nodeById?: Map<string, GraphNode>;
  links: GraphLink[];
}): string | null {
  return getLinkDraftIssueDetail(args)?.message ?? null;
}
