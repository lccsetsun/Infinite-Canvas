import { GraphNode } from "../../types";

const NODE_WIDTH = 240;
const TEXT_NODE_WIDTH = 360;
const TEXT_NODE_HEIGHT = 360;
const LEGACY_TEXT_NODE_DEFAULT_SIZE = 420;
const MEDIA_NODE_FOOTPRINT_WIDTH = 540;
const MEDIA_NODE_FOOTPRINT_HEIGHT = 540;
const MEDIA_NODE_WIDTH = 520;
export const VIDEO_NODE_WIDTH = MEDIA_NODE_WIDTH;
const VIDEO_BATCH_REPLACEMENT_NODE_WIDTH = 520;
const VIDEO_BATCH_REPLACEMENT_NODE_HEIGHT = 464;
const AUDIO_NODE_WIDTH = MEDIA_NODE_FOOTPRINT_WIDTH;
const AUDIO_NODE_HEIGHT = MEDIA_NODE_FOOTPRINT_HEIGHT;
const NODE_HEIGHT = 180;

function parseAspectRatio(ratio: unknown) {
  if (typeof ratio !== "string") return 16 / 9;
  const [w, h] = ratio.split(":").map((value) => Number.parseFloat(value));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return 16 / 9;
  return w / h;
}

function fitNodeFootprint(aspectRatio: unknown) {
  const ratio = parseAspectRatio(aspectRatio);
  if (ratio >= MEDIA_NODE_FOOTPRINT_WIDTH / MEDIA_NODE_FOOTPRINT_HEIGHT) {
    return {
      width: MEDIA_NODE_FOOTPRINT_WIDTH,
      height: Math.round(MEDIA_NODE_FOOTPRINT_WIDTH / ratio),
    };
  }
  return {
    width: Math.round(MEDIA_NODE_FOOTPRINT_HEIGHT * ratio),
    height: MEDIA_NODE_FOOTPRINT_HEIGHT,
  };
}

export function getNodeWidth(node: GraphNode) {
  if (node.type === "text_node") {
    const nodeWidth = node.data?.textNodeWidth;
    if (
      typeof nodeWidth === "number" &&
      Number.isFinite(nodeWidth) &&
      nodeWidth > 0 &&
      nodeWidth !== LEGACY_TEXT_NODE_DEFAULT_SIZE
    )
      return nodeWidth;
    return TEXT_NODE_WIDTH;
  }
  if (node.type === "image_node") {
    const nodeWidth = node.data?.imageNodeWidth;
    if (typeof nodeWidth === "number" && Number.isFinite(nodeWidth) && nodeWidth > 0)
      return nodeWidth;
    const displayWidth = node.data?.imageDisplayWidth;
    if (typeof displayWidth === "number" && Number.isFinite(displayWidth) && displayWidth > 0)
      return displayWidth;
    return fitNodeFootprint(node.properties.aspect_ratio).width;
  }
  if (node.type === "video_node") {
    const nodeWidth = node.data?.videoNodeWidth;
    if (typeof nodeWidth === "number" && Number.isFinite(nodeWidth) && nodeWidth > 0)
      return nodeWidth;
    const displayWidth = node.data?.videoDisplayWidth;
    if (typeof displayWidth === "number" && Number.isFinite(displayWidth) && displayWidth > 0)
      return displayWidth;
    return fitNodeFootprint(node.properties.aspect_ratio).width;
  }
  if (node.type === "audio_node") return AUDIO_NODE_WIDTH;
  if (node.type === "video_batch_replacement_node") return VIDEO_BATCH_REPLACEMENT_NODE_WIDTH;
  return NODE_WIDTH;
}

export function getNodeHeight(node: GraphNode) {
  if (node.type === "image_node") {
    const nodeHeight = node.data?.imageNodeHeight;
    if (typeof nodeHeight === "number" && Number.isFinite(nodeHeight) && nodeHeight > 0)
      return nodeHeight;
    const displayHeight = node.data?.imageDisplayHeight;
    if (typeof displayHeight === "number" && Number.isFinite(displayHeight) && displayHeight > 0)
      return displayHeight + 30;
    return fitNodeFootprint(node.properties.aspect_ratio).height;
  }
  if (node.type === "text_node") {
    const nodeHeight = node.data?.textNodeHeight;
    if (
      typeof nodeHeight === "number" &&
      Number.isFinite(nodeHeight) &&
      nodeHeight > 0 &&
      nodeHeight !== LEGACY_TEXT_NODE_DEFAULT_SIZE
    )
      return nodeHeight;
    return TEXT_NODE_HEIGHT;
  }
  if (node.type === "video_node") {
    const nodeHeight = node.data?.videoNodeHeight;
    if (typeof nodeHeight === "number" && Number.isFinite(nodeHeight) && nodeHeight > 0)
      return nodeHeight;
    const displayHeight = node.data?.videoDisplayHeight;
    if (typeof displayHeight === "number" && Number.isFinite(displayHeight) && displayHeight > 0)
      return displayHeight + 30;
    return fitNodeFootprint(node.properties.aspect_ratio).height;
  }
  if (node.type === "audio_node") return AUDIO_NODE_HEIGHT;
  if (node.type === "video_batch_replacement_node") return VIDEO_BATCH_REPLACEMENT_NODE_HEIGHT;
  if (node.type === "group") return 0;
  return NODE_HEIGHT;
}
const NODE_HEADER_HEIGHT = 40;
export const GRID_SIZE = 24;

export function snapToGrid(value: number, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPointToGrid(point: { x: number; y: number }, gridSize = GRID_SIZE) {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}

export function getNodeById(nodes: GraphNode[], id: string) {
  return nodes.find((n) => n.id === id) ?? null;
}

export function getInputAnchor(node: GraphNode, inputIndex: number) {
  const height = getNodeHeight(node);

  // 对于 LibTV 风格的生成类节点，输入锚点固定在左侧中心
  if (
    [
      "text_node",
      "image_node",
      "video_node",
      "video_batch_replacement_node",
      "audio_node",
    ].includes(node.type)
  ) {
    if (node.type === "image_node" && typeof node.data?.imagePortCenterY === "number") {
      return { x: node.x, y: node.y + node.data.imagePortCenterY };
    }
    if (node.type === "video_node" && typeof node.data?.videoPortCenterY === "number") {
      return { x: node.x, y: node.y + node.data.videoPortCenterY };
    }
    return { x: node.x, y: node.y + height / 2 };
  }

  const step = Math.max(28, (height - NODE_HEADER_HEIGHT) / Math.max(1, node.inputs.length + 1));
  return { x: node.x, y: node.y + NODE_HEADER_HEIGHT + step * (inputIndex + 1) };
}

export function getOutputAnchor(node: GraphNode, outputIndex: number) {
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);

  // 对于 LibTV 风格的生成类节点，输出锚点固定在右侧中心
  if (
    [
      "text_node",
      "image_node",
      "video_node",
      "video_batch_replacement_node",
      "audio_node",
    ].includes(node.type)
  ) {
    if (node.type === "image_node" && typeof node.data?.imagePortCenterY === "number") {
      return { x: node.x + width, y: node.y + node.data.imagePortCenterY };
    }
    if (node.type === "video_node" && typeof node.data?.videoPortCenterY === "number") {
      return { x: node.x + width, y: node.y + node.data.videoPortCenterY };
    }
    return { x: node.x + width, y: node.y + height / 2 };
  }

  const step = Math.max(28, (height - NODE_HEADER_HEIGHT) / Math.max(1, node.outputs.length + 1));
  return { x: node.x + width, y: node.y + NODE_HEADER_HEIGHT + step * (outputIndex + 1) };
}

export function linkPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.max(80, Math.abs(to.x - from.x) * 0.35);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}
