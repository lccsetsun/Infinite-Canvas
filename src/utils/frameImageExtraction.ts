import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphLink, GraphNode } from "../types";

const EXTRACTED_FRAME_CHILD_MAX_WIDTH = 360;
const EXTRACTED_FRAME_CHILD_MAX_HEIGHT = 270;

function fitExtractedFrameChildSize(sourceNode: GraphNode) {
  const width =
    typeof sourceNode.data?.imageNaturalWidth === "number" && sourceNode.data.imageNaturalWidth > 0
      ? sourceNode.data.imageNaturalWidth
      : typeof sourceNode.data?.imageDisplayWidth === "number" && sourceNode.data.imageDisplayWidth > 0
        ? sourceNode.data.imageDisplayWidth
        : 16;
  const height =
    typeof sourceNode.data?.imageNaturalHeight === "number" && sourceNode.data.imageNaturalHeight > 0
      ? sourceNode.data.imageNaturalHeight
      : typeof sourceNode.data?.imageDisplayHeight === "number" && sourceNode.data.imageDisplayHeight > 0
        ? sourceNode.data.imageDisplayHeight
        : 9;
  const ratio = width / height;
  if (ratio >= EXTRACTED_FRAME_CHILD_MAX_WIDTH / EXTRACTED_FRAME_CHILD_MAX_HEIGHT) {
    return {
      width: EXTRACTED_FRAME_CHILD_MAX_WIDTH,
      height: Math.round(EXTRACTED_FRAME_CHILD_MAX_WIDTH / ratio),
    };
  }
  return {
    width: Math.round(EXTRACTED_FRAME_CHILD_MAX_HEIGHT * ratio),
    height: EXTRACTED_FRAME_CHILD_MAX_HEIGHT,
  };
}

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
  position,
  sourceNodeId,
}: {
  frameIndex: number;
  links: GraphLink[];
  makeId: (prefix: string) => string;
  nodes: GraphNode[];
  position?: { x: number; y: number };
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
    position?.x ?? sourceNode.x + sourceWidth + 120,
    position?.y ?? sourceNode.y
  );
  const childDisplaySize = fitExtractedFrameChildSize(sourceNode);
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
    imageDisplayWidth: childDisplaySize.width,
    imageDisplayHeight: childDisplaySize.height,
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

export function replaceFrameImageUrlSnapshot({
  frameIndex,
  nodeOutputs,
  nodes,
  replacementUrl,
  sourceNodeId,
}: {
  frameIndex: number;
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
  replacementUrl: string;
  sourceNodeId: string;
}): {
  nodes: GraphNode[];
  nodeOutputs: NodeOutputMap;
  sourceNodeId: string;
  frameIndex: number;
} | null {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId && node.type === "image_node");
  const sourceImageUrls = sourceNode ? getImageUrls(sourceNode) : [];
  if (
    !sourceNode ||
    sourceNode.data?.isFrameStrip !== true ||
    !replacementUrl.trim() ||
    frameIndex < 0 ||
    frameIndex >= sourceImageUrls.length
  ) {
    return null;
  }

  const nextImageUrls = sourceImageUrls.map((url, index) =>
    index === frameIndex ? replacementUrl : url
  );
  const activeImageIndex =
    typeof sourceNode.data?.activeImageIndex === "number" ? sourceNode.data.activeImageIndex : 0;
  const shouldUpdatePrimary = frameIndex === 0 || activeImageIndex === frameIndex;

  const nextNodes = nodes.map((node) =>
    node.id === sourceNode.id
      ? {
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
        }
      : node
  );

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
