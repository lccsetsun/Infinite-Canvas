import { GraphNode } from "../../types";

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 180;
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
  const step = Math.max(28, (NODE_HEIGHT - NODE_HEADER_HEIGHT) / Math.max(1, node.inputs.length + 1));
  return { x: node.x, y: node.y + NODE_HEADER_HEIGHT + step * (inputIndex + 1) };
}

export function getOutputAnchor(node: GraphNode, outputIndex: number) {
  const step = Math.max(28, (NODE_HEIGHT - NODE_HEADER_HEIGHT) / Math.max(1, node.outputs.length + 1));
  return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEADER_HEIGHT + step * (outputIndex + 1) };
}

export function linkPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.max(80, Math.abs(to.x - from.x) * 0.35);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}
