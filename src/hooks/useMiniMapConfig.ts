import React from "react";
import { MiniMapConfig } from "../components/app/MiniMap";
import { getNodeHeight, getNodeWidth } from "../components/canvas/geometry";
import { GraphNode } from "../types";

interface CanvasSize {
  width: number;
  height: number;
}

interface PanPoint {
  x: number;
  y: number;
}

export function useMiniMapConfig(nodes: GraphNode[], canvasSize: CanvasSize, pan: PanPoint, zoom: number) {
  return React.useMemo(() => {
    const innerW = 196;
    const innerH = 126;
    const padding = 10;
    if (nodes.length === 0) return null;
    const minX = Math.min(...nodes.map((n) => n.x)) - 200;
    const minY = Math.min(...nodes.map((n) => n.y)) - 200;
    const maxX = Math.max(...nodes.map((n) => n.x + getNodeWidth(n))) + 200;
    const maxY = Math.max(...nodes.map((n) => n.y + getNodeHeight(n))) + 200;
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const scale = Math.min((innerW - padding * 2) / worldW, (innerH - padding * 2) / worldH);
    const contentW = worldW * scale;
    const contentH = worldH * scale;
    const offsetX = (innerW - contentW) / 2;
    const offsetY = (innerH - contentH) / 2;

    const nodeRects = nodes.map((n) => {
      const w = getNodeWidth(n);
      const h = getNodeHeight(n);
      return {
        id: n.id,
        left: offsetX + (n.x - minX) * scale,
        top: offsetY + (n.y - minY) * scale,
        width: Math.max(10, w * scale),
        height: Math.max(8, h * scale),
      };
    });

    let viewportRect: MiniMapConfig["viewportRect"] = null;
    if (canvasSize.width && canvasSize.height) {
      const vLeft = -pan.x / zoom;
      const vTop = -pan.y / zoom;
      const vWidth = canvasSize.width / zoom;
      const vHeight = canvasSize.height / zoom;

      viewportRect = {
        left: offsetX + (vLeft - minX) * scale,
        top: offsetY + (vTop - minY) * scale,
        width: vWidth * scale,
        height: vHeight * scale,
      };
    }

    return { nodeRects, viewportRect, minX, minY, scale, offsetX, offsetY } satisfies MiniMapConfig;
  }, [canvasSize.height, canvasSize.width, nodes, pan.x, pan.y, zoom]);
}
