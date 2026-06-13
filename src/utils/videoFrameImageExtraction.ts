import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { GraphLink, GraphNode } from "../types";

const VIDEO_FRAME_IMAGE_MAX_WIDTH = 540;
const VIDEO_FRAME_IMAGE_MAX_HEIGHT = 540;
const VIDEO_FRAME_IMAGE_CHILD_GAP = 96;
// Temporarily disabled: auto-align one child with the source video and center multiple
// capture children as a group. Keep the helpers below so the layout can be restored later.
const VIDEO_FRAME_IMAGE_AUTO_LAYOUT_ENABLED = false;

export type VideoFrameImageCaptureMode = "current" | "first" | "last";

const CAPTURE_MODE_LABEL: Record<VideoFrameImageCaptureMode, string> = {
  current: "当前帧",
  first: "首帧",
  last: "尾帧",
};

function fitVideoFrameImageSize(size: { width: number; height: number }) {
  const width = Number.isFinite(size.width) && size.width > 0 ? size.width : 16;
  const height = Number.isFinite(size.height) && size.height > 0 ? size.height : 9;
  const ratio = width / height;
  if (ratio >= VIDEO_FRAME_IMAGE_MAX_WIDTH / VIDEO_FRAME_IMAGE_MAX_HEIGHT) {
    return {
      width: VIDEO_FRAME_IMAGE_MAX_WIDTH,
      height: Math.round(VIDEO_FRAME_IMAGE_MAX_WIDTH / ratio),
    };
  }
  return {
    width: Math.round(VIDEO_FRAME_IMAGE_MAX_HEIGHT * ratio),
    height: VIDEO_FRAME_IMAGE_MAX_HEIGHT,
  };
}

function getVideoSourceInputIndex(node: GraphNode) {
  const index = node.inputs.findIndex((input) => input.name === "source_video");
  return index >= 0 ? index : 0;
}

function getVideoFrameImageChildren(nodes: GraphNode[], sourceNodeId: string) {
  return nodes.filter(
    (node) =>
      node.type === "image_node" &&
      node.data?.extractedFrameSourceNodeId === sourceNodeId &&
      node.data?.videoFrameCaptureChild === true
  );
}

function getNodeDisplayHeight(node: GraphNode, fallback: number) {
  const height = node.data?.imageDisplayHeight ?? node.data?.videoDisplayHeight;
  return typeof height === "number" && height > 0 ? height : fallback;
}

function getSourceVideoDisplayHeight(sourceNode: GraphNode, fallback: number) {
  const height =
    sourceNode.data?.videoDisplayHeight ??
    sourceNode.data?.videoNodeHeight ??
    sourceNode.data?.imageDisplayHeight;
  return typeof height === "number" && height > 0 ? height : fallback;
}

function layoutVideoFrameImageChildren({
  childDisplayHeight,
  nodes,
  sourceNode,
}: {
  childDisplayHeight: number;
  nodes: GraphNode[];
  sourceNode: GraphNode;
}) {
  const children = getVideoFrameImageChildren(nodes, sourceNode.id);
  if (children.length === 0) return nodes;

  const childIds = new Set(children.map((node) => node.id));
  const childX = sourceNode.x + VIDEO_FRAME_IMAGE_MAX_WIDTH + 120;
  if (children.length === 1) {
    return nodes.map((node) =>
      childIds.has(node.id) ? { ...node, x: childX, y: sourceNode.y } : node
    );
  }

  const heights = children.map((node) => getNodeDisplayHeight(node, childDisplayHeight));
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    (children.length - 1) * VIDEO_FRAME_IMAGE_CHILD_GAP;
  const sourceCenterY =
    sourceNode.y + getSourceVideoDisplayHeight(sourceNode, childDisplayHeight) / 2;
  let nextY = sourceCenterY - totalHeight / 2;
  const positions = new Map<string, number>();
  children.forEach((node, index) => {
    positions.set(node.id, nextY);
    nextY += heights[index] + VIDEO_FRAME_IMAGE_CHILD_GAP;
  });

  return nodes.map((node) =>
    childIds.has(node.id) ? { ...node, x: childX, y: positions.get(node.id) ?? node.y } : node
  );
}

export function relayoutVideoFrameImageChildSnapshots(nodes: GraphNode[]): GraphNode[] {
  if (!VIDEO_FRAME_IMAGE_AUTO_LAYOUT_ENABLED) return nodes;

  const sourceNodeIds = new Set(
    nodes
      .filter((node) => node.data?.videoFrameCaptureChild === true)
      .map((node) => node.data?.extractedFrameSourceNodeId)
      .filter((nodeId): nodeId is string => typeof nodeId === "string" && nodeId.length > 0)
  );

  return Array.from(sourceNodeIds).reduce((currentNodes, sourceNodeId) => {
    const sourceNode = currentNodes.find(
      (node) => node.id === sourceNodeId && node.type === "video_node"
    );
    if (!sourceNode) return currentNodes;
    const firstChild = getVideoFrameImageChildren(currentNodes, sourceNodeId)[0];
    const childDisplayHeight = getNodeDisplayHeight(firstChild, VIDEO_FRAME_IMAGE_MAX_HEIGHT);
    return layoutVideoFrameImageChildren({
      childDisplayHeight,
      nodes: currentNodes,
      sourceNode,
    });
  }, nodes);
}

export function createVideoFrameImageChildSnapshot({
  captureMode,
  links,
  makeId,
  naturalSize,
  nodes,
  previewUrl,
  sourceNodeId,
}: {
  captureMode: VideoFrameImageCaptureMode;
  links: GraphLink[];
  makeId: (prefix: string) => string;
  naturalSize: { width: number; height: number };
  nodes: GraphNode[];
  previewUrl: string;
  sourceNodeId: string;
}): { nodes: GraphNode[]; links: GraphLink[]; createdNode: GraphNode } | null {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId && node.type === "video_node");
  if (!sourceNode) return null;

  const id = makeId("node");
  const displaySize = fitVideoFrameImageSize(naturalSize);
  const existingChildCount = getVideoFrameImageChildren(nodes, sourceNode.id).length;
  const childNode = createNodeFromType(
    "image_node",
    id,
    sourceNode.x + VIDEO_FRAME_IMAGE_MAX_WIDTH + 120,
    sourceNode.y + existingChildCount * (displaySize.height + VIDEO_FRAME_IMAGE_CHILD_GAP)
  );
  childNode.title = `${sourceNode.title} ${CAPTURE_MODE_LABEL[captureMode]}`;
  childNode.properties = {
    ...childNode.properties,
    imageUrl: previewUrl,
    text: "",
  };
  childNode.data = {
    ...(childNode.data || {}),
    imageUrl: previewUrl,
    imageUrls: previewUrl.trim() ? [previewUrl] : [],
    activeImageIndex: 0,
    extractedFrameSourceNodeId: sourceNode.id,
    imageNaturalWidth: naturalSize.width,
    imageNaturalHeight: naturalSize.height,
    imageDisplayWidth: displaySize.width,
    imageDisplayHeight: displaySize.height,
    isSourceNode: true,
    videoFrameCaptureChild: true,
    loading: true,
    status: "uploading",
    uploadingAsset: true,
  };

  const link: GraphLink = {
    id: makeId("link"),
    fromNodeId: sourceNode.id,
    fromOutputIndex: 0,
    toNodeId: childNode.id,
    toInputIndex: getVideoSourceInputIndex(childNode),
    locked: true,
  };

  const nextNodes = VIDEO_FRAME_IMAGE_AUTO_LAYOUT_ENABLED
    ? layoutVideoFrameImageChildren({
        childDisplayHeight: displaySize.height,
        nodes: [...nodes, childNode],
        sourceNode,
      })
    : [...nodes, childNode];
  const createdNode = nextNodes.find((node) => node.id === childNode.id) ?? childNode;

  return {
    nodes: nextNodes,
    links: [...links, link],
    createdNode,
  };
}

export function completeVideoFrameImageChildSnapshot({
  nodeId,
  nodes,
  ossId,
  uploadedUrl,
}: {
  nodeId: string;
  nodes: GraphNode[];
  ossId?: string;
  uploadedUrl: string;
}): { nodes: GraphNode[]; nodeOutputValue: string } {
  return {
    nodes: nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            properties: {
              ...node.properties,
              imageUrl: uploadedUrl,
            },
            data: {
              ...(node.data || {}),
              imageUrl: uploadedUrl,
              imageUrls: [uploadedUrl],
              ossId,
              loading: false,
              status: "success",
              uploadingAsset: false,
              error: undefined,
              isSourceNode: true,
            },
          }
        : node
    ),
    nodeOutputValue: uploadedUrl,
  };
}

export function failVideoFrameImageChildSnapshot({
  error,
  nodeId,
  nodes,
}: {
  error: string;
  nodeId: string;
  nodes: GraphNode[];
}): GraphNode[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...(node.data || {}),
            error,
            loading: false,
            status: "error",
            uploadingAsset: false,
          },
        }
      : node
  );
}
