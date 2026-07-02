import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { GraphLink, GraphNode } from "../types";

const VIDEO_SUPER_RESOLUTION_CHILD_GAP_X = 120;
const VIDEO_SUPER_RESOLUTION_FALLBACK_WIDTH = 540;
const VIDEO_SUPER_RESOLUTION_FALLBACK_HEIGHT = 304;

function getVideoSourceInputIndex(node: GraphNode) {
  const index = node.inputs.findIndex((input) => input.name === "source_video");
  return index >= 0 ? index : 0;
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function getVideoNodeSize(node: GraphNode) {
  const width = positiveNumber(
    node.data?.videoNodeWidth ?? node.data?.videoDisplayWidth ?? node.data?.videoNaturalWidth,
    VIDEO_SUPER_RESOLUTION_FALLBACK_WIDTH
  );
  const height = positiveNumber(
    node.data?.videoNodeHeight ?? node.data?.videoDisplayHeight ?? node.data?.videoNaturalHeight,
    VIDEO_SUPER_RESOLUTION_FALLBACK_HEIGHT
  );
  const displayWidth = positiveNumber(node.data?.videoDisplayWidth, width);
  const displayHeight = positiveNumber(node.data?.videoDisplayHeight, height);
  return { displayHeight, displayWidth, height, width };
}

export function createVideoSuperResolutionChildSnapshot({
  links,
  makeId,
  nodes,
  sourceNodeId,
  sourceVideoUrl,
}: {
  links: GraphLink[];
  makeId: (prefix: string) => string;
  nodes: GraphNode[];
  sourceNodeId: string;
  sourceVideoUrl: string;
}): { createdNode: GraphNode; links: GraphLink[]; nodes: GraphNode[] } | null {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId && node.type === "video_node");
  if (!sourceNode) return null;

  const id = makeId("node");
  const size = getVideoNodeSize(sourceNode);
  const childNode = createNodeFromType(
    "video_node",
    id,
    sourceNode.x + size.width + VIDEO_SUPER_RESOLUTION_CHILD_GAP_X,
    sourceNode.y
  );
  childNode.title = `${sourceNode.title} 超分`;
  childNode.properties = {
    ...childNode.properties,
    videoUrl: "",
    text: "",
  };
  childNode.data = {
    ...(childNode.data || {}),
    videoUrl: "",
    sourceVideoUrl,
    videoSuperResolutionChild: true,
    videoSuperResolutionSourceNodeId: sourceNode.id,
    videoNaturalWidth: sourceNode.data?.videoNaturalWidth,
    videoNaturalHeight: sourceNode.data?.videoNaturalHeight,
    videoDisplayWidth: size.displayWidth,
    videoDisplayHeight: size.displayHeight,
    videoNodeWidth: size.displayWidth,
    videoNodeHeight: size.displayHeight,
    videoPortCenterY: Math.round(size.displayHeight / 2),
    generationStartedAt: Date.now(),
    generationFinishedAt: undefined,
    loading: true,
    loadingOperation: "video-super-resolution",
    status: "loading",
  };

  const link: GraphLink = {
    id: makeId("link"),
    fromNodeId: sourceNode.id,
    fromOutputIndex: 0,
    toNodeId: childNode.id,
    toInputIndex: getVideoSourceInputIndex(childNode),
    locked: true,
  };

  return {
    createdNode: childNode,
    links: [...links, link],
    nodes: [...nodes, childNode],
  };
}

export function completeVideoSuperResolutionChildSnapshot({
  nodeId,
  nodes,
  videoUrl,
}: {
  nodeId: string;
  nodes: GraphNode[];
  videoUrl: string;
}): { nodeOutputValue: string; nodes: GraphNode[] } {
  return {
    nodeOutputValue: videoUrl,
    nodes: nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            properties: {
              ...node.properties,
              videoUrl,
              status: "success",
            },
            data: {
              ...(node.data || {}),
              videoUrl,
              generationFinishedAt: Date.now(),
              loading: false,
              loadingOperation: undefined,
              status: "success",
              error: undefined,
            },
          }
        : node
    ),
  };
}

export function failVideoSuperResolutionChildSnapshot({
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
          properties: {
            ...node.properties,
            status: "error",
          },
          data: {
            ...(node.data || {}),
            error,
            generationFinishedAt: Date.now(),
            loading: false,
            loadingOperation: undefined,
            status: "error",
          },
        }
      : node
  );
}
