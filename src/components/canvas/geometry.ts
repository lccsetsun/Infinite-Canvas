import { GraphNode } from "../../types";

export const NODE_WIDTH = 240;
export const TEXT_NODE_WIDTH = 392;
export const MEDIA_NODE_WIDTH = 520;
export const GENERATIVE_NODE_HEIGHT = 290;
export const IMAGE_NODE_WIDTH = MEDIA_NODE_WIDTH;
export const VIDEO_NODE_WIDTH = MEDIA_NODE_WIDTH;
export const AUDIO_NODE_WIDTH = 560;
export const NODE_HEIGHT = 180;

export function getNodeWidth(node: GraphNode) {
  if (node.type === "text_node") return TEXT_NODE_WIDTH;
  if (node.type === "image_node") {
    const nodeWidth = node.data?.imageNodeWidth;
    if (node.data?.imageUrl && typeof nodeWidth === "number" && Number.isFinite(nodeWidth) && nodeWidth > 0) return nodeWidth;
    const displayWidth = node.data?.imageDisplayWidth;
    if (node.data?.imageUrl && typeof displayWidth === "number" && Number.isFinite(displayWidth) && displayWidth > 0) return displayWidth;
    return IMAGE_NODE_WIDTH;
  }
  if (node.type === "video_node") {
    const nodeWidth = node.data?.videoNodeWidth;
    if (node.data?.videoUrl && typeof nodeWidth === "number" && Number.isFinite(nodeWidth) && nodeWidth > 0) return nodeWidth;
    const displayWidth = node.data?.videoDisplayWidth;
    if (node.data?.videoUrl && typeof displayWidth === "number" && Number.isFinite(displayWidth) && displayWidth > 0) return displayWidth;
    return VIDEO_NODE_WIDTH;
  }
  if (node.type === "audio_node") return AUDIO_NODE_WIDTH;
  return NODE_WIDTH;
}

export function getNodeHeight(node: GraphNode) {
  if (node.type === "image_node") {
    const nodeHeight = node.data?.imageNodeHeight;
    if (node.data?.imageUrl && typeof nodeHeight === "number" && Number.isFinite(nodeHeight) && nodeHeight > 0) return nodeHeight;
    const displayHeight = node.data?.imageDisplayHeight;
    if (node.data?.imageUrl && typeof displayHeight === "number" && Number.isFinite(displayHeight) && displayHeight > 0) return displayHeight + 30;
    return GENERATIVE_NODE_HEIGHT;
  }
  if (node.type === "text_node") return GENERATIVE_NODE_HEIGHT;
  if (node.type === "video_node") {
    const nodeHeight = node.data?.videoNodeHeight;
    if (node.data?.videoUrl && typeof nodeHeight === "number" && Number.isFinite(nodeHeight) && nodeHeight > 0) return nodeHeight;
    const displayHeight = node.data?.videoDisplayHeight;
    if (node.data?.videoUrl && typeof displayHeight === "number" && Number.isFinite(displayHeight) && displayHeight > 0) return displayHeight + 30;
    return GENERATIVE_NODE_HEIGHT;
  }
  if (node.type === "audio_node") return 280;
  if (node.type === "group") return 0;
  return NODE_HEIGHT;
}
export const NODE_HEADER_HEIGHT = 40;
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
  if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type)) {
    return { x: node.x, y: node.y + height / 2 };
  }
  
  const step = Math.max(28, (height - NODE_HEADER_HEIGHT) / Math.max(1, node.inputs.length + 1));
  return { x: node.x, y: node.y + NODE_HEADER_HEIGHT + step * (inputIndex + 1) };
}

export function getOutputAnchor(node: GraphNode, outputIndex: number) {
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);
  
  // 对于 LibTV 风格的生成类节点，输出锚点固定在右侧中心
  if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type)) {
    return { x: node.x + width, y: node.y + height / 2 };
  }
  
  const step = Math.max(28, (height - NODE_HEADER_HEIGHT) / Math.max(1, node.outputs.length + 1));
  return { x: node.x + width, y: node.y + NODE_HEADER_HEIGHT + step * (outputIndex + 1) };
}

export function linkPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.max(80, Math.abs(to.x - from.x) * 0.35);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}
