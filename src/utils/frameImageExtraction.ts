import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphLink, GraphNode } from "../types";

function getImageUrls(node: GraphNode): string[] {
  const raw = Array.isArray(node.data?.imageUrls)
    ? node.data.imageUrls
    : Array.isArray(node.properties.imageUrls)
      ? node.properties.imageUrls
      : [];
  return raw.filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

function getNodeImageUrl(node: GraphNode): string {
  const urls = getImageUrls(node);
  return (
    urls[0] ||
    (typeof node.data?.imageUrl === "string" && node.data.imageUrl.trim()) ||
    (typeof node.properties.imageUrl === "string" && node.properties.imageUrl.trim()) ||
    ""
  );
}

export function createFrameImageChildSnapshot({
  frameIndex,
  links,
  makeId,
  nodes,
  sourceNodeId,
}: {
  frameIndex: number;
  links: GraphLink[];
  makeId: (prefix: string) => string;
  nodes: GraphNode[];
  sourceNodeId: string;
}): { nodes: GraphNode[]; links: GraphLink[]; createdNode: GraphNode } | null {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId && node.type === "image_node");
  if (!sourceNode || sourceNode.data?.isFrameStrip !== true) return null;

  const imageUrls = getImageUrls(sourceNode);
  const imageUrl = imageUrls[frameIndex];
  if (!imageUrl) return null;

  const id = makeId("node");
  const sourceWidth =
    typeof sourceNode.data?.imageDisplayWidth === "number" && sourceNode.data.imageDisplayWidth > 0
      ? sourceNode.data.imageDisplayWidth
      : 560;
  const childNode = createNodeFromType(
    "image_node",
    id,
    sourceNode.x + sourceWidth + 120,
    sourceNode.y
  );
  childNode.title = `${sourceNode.title} · 第 ${frameIndex + 1} 帧`;
  childNode.properties = {
    ...childNode.properties,
    imageUrl,
    text: "",
  };
  childNode.data = {
    ...(childNode.data || {}),
    imageUrl,
    imageUrls: [imageUrl],
    activeImageIndex: 0,
    extractedFrameSourceNodeId: sourceNode.id,
    extractedFrameIndex: frameIndex,
    imageNaturalWidth: sourceNode.data?.imageNaturalWidth,
    imageNaturalHeight: sourceNode.data?.imageNaturalHeight,
    isSourceNode: true,
    status: "success",
    loading: false,
  };

  const sourceImageInputIndex = Math.max(
    0,
    childNode.inputs.findIndex((input) => input.name === "source_image")
  );
  const link: GraphLink = {
    id: makeId("link"),
    fromNodeId: sourceNode.id,
    fromOutputIndex: 0,
    toNodeId: childNode.id,
    toInputIndex: sourceImageInputIndex,
    locked: true,
  };

  return {
    nodes: [...nodes, childNode],
    links: [...links, link],
    createdNode: childNode,
  };
}

export function replaceFrameImageFromChildSnapshot({
  childNodeId,
  nodeOutputs,
  nodes,
}: {
  childNodeId: string;
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
}): {
  nodes: GraphNode[];
  nodeOutputs: NodeOutputMap;
  sourceNodeId: string;
  frameIndex: number;
} | null {
  const childNode = nodes.find((node) => node.id === childNodeId && node.type === "image_node");
  const sourceNodeId =
    typeof childNode?.data?.extractedFrameSourceNodeId === "string"
      ? childNode.data.extractedFrameSourceNodeId
      : "";
  const frameIndex =
    typeof childNode?.data?.extractedFrameIndex === "number"
      ? childNode.data.extractedFrameIndex
      : -1;
  const sourceNode = nodes.find((node) => node.id === sourceNodeId && node.type === "image_node");
  if (!childNode || !sourceNode || frameIndex < 0) return null;

  const replacementUrl = getNodeImageUrl(childNode);
  const sourceImageUrls = getImageUrls(sourceNode);
  if (!replacementUrl || frameIndex >= sourceImageUrls.length) return null;

  const nextImageUrls = sourceImageUrls.map((url, index) =>
    index === frameIndex ? replacementUrl : url
  );
  const activeImageIndex =
    typeof sourceNode.data?.activeImageIndex === "number" ? sourceNode.data.activeImageIndex : 0;

  const nextNodes = nodes.map((node) => {
    if (node.id !== sourceNode.id) return node;
    const shouldUpdatePrimary = frameIndex === 0 || activeImageIndex === frameIndex;
    return {
      ...node,
      properties: {
        ...node.properties,
        ...(frameIndex === 0 ? { imageUrl: replacementUrl } : {}),
        imageUrls: nextImageUrls,
      },
      data: {
        ...(node.data || {}),
        imageUrls: nextImageUrls,
        ...(shouldUpdatePrimary ? { imageUrl: replacementUrl } : {}),
      },
    };
  });

  const nextOutputs: NodeOutputMap = new Map(nodeOutputs);
  const existingOutputs = nextOutputs.get(sourceNode.id);
  const sourceOutputs = new Map<number, unknown>(
    existingOutputs instanceof Map ? existingOutputs : []
  );
  sourceOutputs.set(0, nextImageUrls);
  nextOutputs.set(sourceNode.id, sourceOutputs);

  return {
    nodes: nextNodes,
    nodeOutputs: nextOutputs,
    sourceNodeId,
    frameIndex,
  };
}
