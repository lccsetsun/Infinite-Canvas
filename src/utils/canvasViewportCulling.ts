import { getNodeHeight, getNodeWidth } from "../components/canvas/geometry";
import type { GraphNode } from "../types";

export interface CanvasWorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEFAULT_BUFFER_PX = 360;

function hasMeasurableViewport(canvasSize: { width: number; height: number }) {
  return canvasSize.width > 0 && canvasSize.height > 0;
}

function normalizeZoom(zoom: number) {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

export function getVisibleWorldRect({
  bufferPx = DEFAULT_BUFFER_PX,
  canvasSize,
  pan,
  zoom,
}: {
  canvasSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  bufferPx?: number;
}): CanvasWorldRect {
  if (!hasMeasurableViewport(canvasSize)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  const safeZoom = normalizeZoom(zoom);
  const worldBuffer = Math.max(0, bufferPx) / safeZoom;

  return {
    minX: (-pan.x - Math.max(0, bufferPx)) / safeZoom,
    minY: (-pan.y - Math.max(0, bufferPx)) / safeZoom,
    maxX: (canvasSize.width - pan.x) / safeZoom + worldBuffer,
    maxY: (canvasSize.height - pan.y) / safeZoom + worldBuffer,
  };
}

function rectsIntersect(
  a: CanvasWorldRect,
  b: CanvasWorldRect
) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function getNodeRect(node: GraphNode): CanvasWorldRect {
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + getNodeWidth(node),
    maxY: node.y + getNodeHeight(node),
  };
}

export function getVisibleCanvasNodeIds({
  alwaysVisibleNodeIds,
  bufferPx,
  canvasSize,
  nodes,
  pan,
  zoom,
}: {
  nodes: GraphNode[];
  canvasSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  bufferPx?: number;
  alwaysVisibleNodeIds?: Set<string>;
}): Set<string> {
  if (!hasMeasurableViewport(canvasSize)) {
    return new Set([
      ...nodes.map((node) => node.id),
      ...(alwaysVisibleNodeIds ? Array.from(alwaysVisibleNodeIds) : []),
    ]);
  }

  const visibleWorldRect = getVisibleWorldRect({ bufferPx, canvasSize, pan, zoom });
  const visibleIds = new Set(alwaysVisibleNodeIds ?? []);

  nodes.forEach((node) => {
    if (visibleIds.has(node.id)) return;
    if (rectsIntersect(visibleWorldRect, getNodeRect(node))) {
      visibleIds.add(node.id);
    }
  });

  return visibleIds;
}
