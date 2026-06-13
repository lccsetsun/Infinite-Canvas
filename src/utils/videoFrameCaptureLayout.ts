import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphLink, GraphNode } from "../types";
import type { VideoFrameCaptureItem } from "../features/video/frameCapture";

const FRAME_GRID_COLUMNS = 5;
const CAPTURE_VIDEO_NODE_FOOTPRINT_WIDTH = 540;
const CAPTURE_VIDEO_NODE_FOOTPRINT_HEIGHT = 540;
const CAPTURE_VERTICAL_GAP = 96;

export type VideoFrameCaptureSnapshot = {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  createdNodes: GraphNode[];
};

function getSourceVideoUrl(sourceNode: GraphNode) {
  return (sourceNode.data?.videoUrl as string) || (sourceNode.properties.videoUrl as string) || "";
}

function getInputIndex(node: GraphNode, inputName: string, fallbackIndex: number) {
  const index = node.inputs.findIndex((input) => input.name === inputName);
  return index >= 0 ? index : fallbackIndex;
}

function getSourceVideoAspectRatio(sourceNode: GraphNode) {
  const naturalWidth = sourceNode.data?.videoNaturalWidth;
  const naturalHeight = sourceNode.data?.videoNaturalHeight;
  if (
    typeof naturalWidth === "number" &&
    typeof naturalHeight === "number" &&
    naturalWidth > 0 &&
    naturalHeight > 0
  ) {
    return naturalWidth / naturalHeight;
  }

  const displayWidth = sourceNode.data?.videoDisplayWidth;
  const displayHeight = sourceNode.data?.videoDisplayHeight;
  if (
    typeof displayWidth === "number" &&
    typeof displayHeight === "number" &&
    displayWidth > 0 &&
    displayHeight > 0
  ) {
    return displayWidth / displayHeight;
  }

  return 16 / 9;
}

function makeFrameGridSize(
  frameCount: number,
  videoDisplaySize: { width: number; height: number }
) {
  const rows = Math.max(1, Math.ceil(frameCount / FRAME_GRID_COLUMNS));
  const tileWidth = Math.max(1, Math.round(videoDisplaySize.width / 2));
  const tileHeight = Math.max(1, Math.round(videoDisplaySize.height / 2));
  return {
    width: FRAME_GRID_COLUMNS * tileWidth,
    height: rows * tileHeight,
    rows,
    tileWidth,
    tileHeight,
  };
}

function makeCaptureVideoDisplaySize(sourceNode: GraphNode) {
  const naturalWidth = sourceNode.data?.videoNaturalWidth;
  const naturalHeight = sourceNode.data?.videoNaturalHeight;
  if (
    typeof naturalWidth === "number" &&
    typeof naturalHeight === "number" &&
    naturalWidth > 0 &&
    naturalHeight > 0
  ) {
    const scale = Math.min(
      CAPTURE_VIDEO_NODE_FOOTPRINT_WIDTH / naturalWidth,
      CAPTURE_VIDEO_NODE_FOOTPRINT_HEIGHT / naturalHeight
    );
    return {
      width: Math.round(naturalWidth * scale),
      height: Math.round(naturalHeight * scale),
    };
  }

  const displayWidth = sourceNode.data?.videoDisplayWidth;
  const displayHeight = sourceNode.data?.videoDisplayHeight;
  if (
    typeof displayWidth === "number" &&
    typeof displayHeight === "number" &&
    displayWidth > 0 &&
    displayHeight > 0
  ) {
    return { width: displayWidth, height: displayHeight };
  }

  return {
    width: CAPTURE_VIDEO_NODE_FOOTPRINT_WIDTH,
    height: Math.round(CAPTURE_VIDEO_NODE_FOOTPRINT_WIDTH / getSourceVideoAspectRatio(sourceNode)),
  };
}

export function createVideoFrameCaptureSnapshot({
  nodes,
  links,
  nodeOutputs,
  sourceNodeId,
  captures,
  makeId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  sourceNodeId: string;
  captures: VideoFrameCaptureItem[];
  makeId: (prefix: string) => string;
}): VideoFrameCaptureSnapshot | null {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId);
  if (!sourceNode || captures.length === 0) return null;

  const sourceVideoUrl = getSourceVideoUrl(sourceNode);
  const staleNodeIds = new Set(
    nodes
      .filter((node) => node.data?.frameCaptureSourceNodeId === sourceNodeId)
      .map((node) => node.id)
  );
  const nextNodes = nodes.filter((node) => !staleNodeIds.has(node.id));
  const nextLinks = links.filter(
    (link) => !staleNodeIds.has(link.fromNodeId) && !staleNodeIds.has(link.toNodeId)
  );
  const nextOutputs: NodeOutputMap = new Map(nodeOutputs);
  staleNodeIds.forEach((nodeId) => nextOutputs.delete(nodeId));
  const createdNodes: GraphNode[] = [];
  const baseX = sourceNode.x + 520;
  const frameNodeX = baseX + CAPTURE_VIDEO_NODE_FOOTPRINT_WIDTH + 120;
  let nextY = sourceNode.y;

  captures.forEach((capture, captureIndex) => {
    const displayIndex = captureIndex + 1;
    const segmentVideoUrl = capture.videoUrl || sourceVideoUrl;
    const frameImages = capture.frameImages;
    const frameImageOssIds = capture.frameImageOssIds;
    const videoDisplaySize = makeCaptureVideoDisplaySize(sourceNode);
    const gridSize =
      frameImages.length > 0 ? makeFrameGridSize(frameImages.length, videoDisplaySize) : null;
    const y = nextY;

    const videoId = makeId("node");
    const videoNode = createNodeFromType("video_node", videoId, baseX, y);
    videoNode.title = `\u5206\u6bb5 ${displayIndex}`;
    videoNode.properties = {
      ...videoNode.properties,
      videoUrl: segmentVideoUrl,
      text: "",
    };
    videoNode.data = {
      ...(videoNode.data || {}),
      videoUrl: segmentVideoUrl,
      videoNaturalWidth: sourceNode.data?.videoNaturalWidth,
      videoNaturalHeight: sourceNode.data?.videoNaturalHeight,
      videoDisplayWidth: videoDisplaySize.width,
      videoDisplayHeight: videoDisplaySize.height,
      frameCaptureSourceNodeId: sourceNodeId,
      status: "success",
      loading: false,
    };
    nextNodes.push(videoNode);
    createdNodes.push(videoNode);
    nextOutputs.set(videoId, new Map([[0, segmentVideoUrl]]));
    nextLinks.push({
      id: makeId("link"),
      fromNodeId: sourceNode.id,
      fromOutputIndex: 0,
      toNodeId: videoId,
      toInputIndex: getInputIndex(videoNode, "prompt", 0),
    });

    if (gridSize) {
      const frameNodeId = makeId("node");
      const frameNode = createNodeFromType("image_node", frameNodeId, frameNodeX, y);
      frameNode.title = `\u9010\u5e27\u5206\u6790 ${displayIndex}`;
      frameNode.properties = {
        ...frameNode.properties,
        imageUrl: frameImages[0],
        text: "",
      };
      frameNode.data = {
        ...(frameNode.data || {}),
        imageUrl: frameImages[0],
        imageUrls: frameImages,
        frameImageOssIds,
        activeImageIndex: 0,
        imageNaturalWidth: gridSize.width,
        imageNaturalHeight: gridSize.height,
        imageDisplayWidth: gridSize.width,
        imageDisplayHeight: gridSize.height,
        isFrameStrip: true,
        frameGridColumns: FRAME_GRID_COLUMNS,
        frameGridRows: gridSize.rows,
        frameTileHeight: gridSize.tileHeight,
        frameTileWidth: gridSize.tileWidth,
        frameCaptureSourceNodeId: sourceNodeId,
        status: "success",
        loading: false,
      };
      nextNodes.push(frameNode);
      createdNodes.push(frameNode);
      nextOutputs.set(frameNodeId, new Map([[0, frameImages]]));
      nextLinks.push({
        id: makeId("link"),
        fromNodeId: videoId,
        fromOutputIndex: 0,
        toNodeId: frameNodeId,
        toInputIndex: getInputIndex(frameNode, "source_video", 0),
      });
    }

    nextY += Math.max(videoDisplaySize.height ?? 0, gridSize?.height ?? 0) + CAPTURE_VERTICAL_GAP;
  });

  return {
    nodes: nextNodes,
    links: nextLinks,
    nodeOutputs: nextOutputs,
    createdNodes,
  };
}
