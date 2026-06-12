import type { GraphNode } from "../types";
import { getNodeHeight, getNodeWidth } from "../components/canvas/geometry";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LinkSourceDraft {
  fromNodeId: string;
  fromOutputIndex: number;
}

export function normalizeSelectionRect(start: Point, end: Point): Rect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x,
    y,
  };
}

export function getNodeRect(node: GraphNode): Rect {
  return {
    height: getNodeHeight(node),
    width: getNodeWidth(node),
    x: node.x,
    y: node.y,
  };
}

export function rectContainsRect(container: Rect, child: Rect): boolean {
  return (
    child.x >= container.x &&
    child.y >= container.y &&
    child.x + child.width <= container.x + container.width &&
    child.y + child.height <= container.y + container.height
  );
}

export function getNodesFullyInsideSelection(nodes: GraphNode[], selection: Rect): GraphNode[] {
  return nodes.filter((node) => rectContainsRect(selection, getNodeRect(node)));
}

export function getSelectionBounds(nodes: GraphNode[], padding = 0): Rect | null {
  if (nodes.length === 0) return null;

  const rects = nodes.map(getNodeRect);
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    height: maxY - minY + padding * 2,
    width: maxX - minX + padding * 2,
    x: minX - padding,
    y: minY - padding,
  };
}

export function getBatchOutputDrafts(nodes: GraphNode[]): LinkSourceDraft[] {
  return nodes
    .filter((node) => node.outputs.length > 0)
    .map((node) => ({ fromNodeId: node.id, fromOutputIndex: 0 }));
}

export function getClickDragDistance(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function isClickWithoutDrag(start: Point, end: Point, threshold = 5): boolean {
  return getClickDragDistance(start, end) <= threshold;
}
