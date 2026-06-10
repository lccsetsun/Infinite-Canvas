import type { GraphNode } from "../types";

type SourceMediaUrls = {
  audioUrl?: string;
  imageUrl?: string;
  ossId?: string;
  videoUrl?: string;
};

const SOURCE_NODE_TYPES = new Set<GraphNode["type"]>([
  "text_node",
  "image_node",
  "video_node",
  "audio_node",
]);

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function firstImageUrl(node: GraphNode) {
  const activeIndex =
    typeof node.data?.activeImageIndex === "number" && node.data.activeImageIndex >= 0
      ? node.data.activeImageIndex
      : 0;
  const imageUrls = Array.isArray(node.data?.imageUrls) ? node.data.imageUrls : [];
  return firstString(node.data?.imageUrl, imageUrls[activeIndex], imageUrls[0], node.properties.imageUrl);
}

function inferSourceUrls(node: GraphNode): SourceMediaUrls {
  if (node.type === "image_node") return { imageUrl: firstImageUrl(node) };
  if (node.type === "video_node") return { videoUrl: firstString(node.data?.videoUrl, node.properties.videoUrl) };
  if (node.type === "audio_node") return { audioUrl: firstString(node.data?.audioUrl, node.properties.audioUrl) };
  return {};
}

function inferSourceText(node: GraphNode) {
  return firstString(node.properties.text, node.data?.response, node.properties.response, node.data?.text);
}

export function isSourceNode(node: GraphNode): boolean {
  return (
    node.properties?.isSourceNode === true ||
    node.data?.isSourceNode === true ||
    (node.type === "text_node" && node.properties?.textMode === "plain")
  );
}

export function markNodeAsSource(node: GraphNode, sourceUrls: SourceMediaUrls = {}): GraphNode {
  const inferredUrls = inferSourceUrls(node);
  const imageUrl = sourceUrls.imageUrl || inferredUrls.imageUrl;
  const videoUrl = sourceUrls.videoUrl || inferredUrls.videoUrl;
  const audioUrl = sourceUrls.audioUrl || inferredUrls.audioUrl;
  const ossId = sourceUrls.ossId || firstString(node.data?.ossId, node.properties.ossId);
  const nextProperties: GraphNode["properties"] = {
    ...node.properties,
    isSourceNode: true,
  };
  const nextData: GraphNode["data"] = {
    ...(node.data || {}),
    isSourceNode: true,
    loading: false,
  };

  if (node.type === "text_node") {
    nextProperties.textMode = "plain";
    if (!firstString(nextProperties.text)) {
      const text = inferSourceText(node);
      if (text) nextProperties.text = text;
    }
  }

  if (imageUrl) {
    nextProperties.imageUrl = imageUrl;
    nextData.imageUrl = imageUrl;
    nextData.imageUrls = [imageUrl];
    nextData.activeImageIndex = 0;
  }
  if (videoUrl) {
    nextProperties.videoUrl = videoUrl;
    nextData.videoUrl = videoUrl;
  }
  if (audioUrl) {
    nextProperties.audioUrl = audioUrl;
    nextData.audioUrl = audioUrl;
  }
  if (ossId) {
    nextProperties.ossId = ossId;
    nextData.ossId = ossId;
  }

  return {
    ...node,
    inputs: [],
    properties: nextProperties,
    data: nextData,
  };
}

export function normalizeSourceNode(node: GraphNode): GraphNode {
  return isSourceNode(node) ? markNodeAsSource(node) : node;
}

export function duplicateNodeAsSource(
  sourceNode: GraphNode,
  id: string,
  title: string
): GraphNode {
  const clone: GraphNode = {
    ...sourceNode,
    id,
    x: sourceNode.x + 36,
    y: sourceNode.y + 36,
    inputs: sourceNode.inputs.map((input) => ({ ...input })),
    outputs: sourceNode.outputs.map((output) => ({ ...output })),
    properties: { ...sourceNode.properties },
    data: sourceNode.data ? { ...sourceNode.data } : {},
    title,
  };

  return SOURCE_NODE_TYPES.has(sourceNode.type) ? markNodeAsSource(clone) : clone;
}
