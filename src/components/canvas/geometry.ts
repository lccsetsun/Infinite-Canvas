import { GraphNode } from "../../types";

export const NODE_WIDTH = 240;
export const TEXT_NODE_WIDTH = 320;
export const IMAGE_NODE_WIDTH = 320;
export const VIDEO_NODE_WIDTH = 320;
export const NODE_HEIGHT = 180;

export function getNodeWidth(node: GraphNode) {
  if (node.type === "text_node") return TEXT_NODE_WIDTH;
  if (node.type === "image_node") return IMAGE_NODE_WIDTH;
  if (node.type === "video_node") return VIDEO_NODE_WIDTH;
  return NODE_WIDTH;
}

export function getNodeHeight(node: GraphNode) {
  if (node.type === "image_node") return 520;
  if (node.type === "text_node") return 400;
  if (node.type === "video_node") return 600;
  if (node.type === "upload_image") return 300;
  if (node.type === "upload_video") {
    return node.properties.frameAnalysis && node.properties.frameAnalysis !== "none" ? 420 : 240;
  }
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
  const step = Math.max(28, (height - NODE_HEADER_HEIGHT) / Math.max(1, node.inputs.length + 1));
  return { x: node.x, y: node.y + NODE_HEADER_HEIGHT + step * (inputIndex + 1) };
}

export function getOutputAnchor(node: GraphNode, outputIndex: number) {
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);
  const step = Math.max(28, (height - NODE_HEADER_HEIGHT) / Math.max(1, node.outputs.length + 1));
  return { x: node.x + width, y: node.y + NODE_HEADER_HEIGHT + step * (outputIndex + 1) };
}

export function linkPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.max(80, Math.abs(to.x - from.x) * 0.35);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}
