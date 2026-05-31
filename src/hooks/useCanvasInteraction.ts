import React from "react";
import { getNodeHeight, getNodeWidth, snapPointToGrid } from "../components/canvas/geometry";
import { GraphNode } from "../types";

type DragState = {
  mode: "node" | "canvas" | null;
  nodeId?: string;
  startX: number;
  startY: number;
  nodeStartX?: number;
  nodeStartY?: number;
  panStartX?: number;
  panStartY?: number;
};

type PendingDrag =
  | { mode: "canvas"; x: number; y: number }
  | { mode: "node"; nodeId: string; x: number; y: number };

interface UseCanvasInteractionOptions {
  nodes: GraphNode[];
  snapToGridEnabled?: boolean;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
}

const CANVAS_SAFE_PADDING = 24;

export function useCanvasInteraction({ nodes, snapToGridEnabled = true, updateNodePosition }: UseCanvasInteractionOptions) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState>({ mode: null, startX: 0, startY: 0 });
  const dragFrameRef = React.useRef<number | null>(null);
  const pendingDragRef = React.useRef<PendingDrag | null>(null);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);

  const toWorld = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX, y: clientY };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  const clampNodePosition = React.useCallback(
    (point: { x: number; y: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const minWorldX = rect ? (CANVAS_SAFE_PADDING - pan.x) / zoom : CANVAS_SAFE_PADDING;
      const minWorldY = rect ? (CANVAS_SAFE_PADDING - pan.y) / zoom : CANVAS_SAFE_PADDING;
      return {
        x: Math.max(point.x, minWorldX),
        y: Math.max(point.y, minWorldY),
      };
    },
    [pan.x, pan.y, zoom]
  );

  const fitView = React.useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;

    // Calculate actual bounds including dynamic widths
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    
    const maxX = Math.max(...nodes.map((n) => {
      return n.x + getNodeWidth(n);
    }));
    const maxY = Math.max(...nodes.map((n) => {
      const estimatedHeight = n.type === "text_node" ? 420 : getNodeHeight(n);
      return n.y + estimatedHeight;
    }));

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    
    const padding = 160;
    const targetZoom = Math.max(0.35, Math.min(1.1, Math.min((rect.width - padding) / width, (rect.height - padding) / height)));
    
    setZoom(targetZoom);
    
    setPan({
      x: (rect.width / 2) - (minX + width / 2) * targetZoom + 30,
      y: (rect.height / 2) - (minY + height / 2) * targetZoom,
    });
  }, [nodes]);

  const scrollToNode = React.useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!node || !rect) return;

      setPan({
        x: rect.width / 2 - (node.x + getNodeWidth(node) / 2) * zoom,
        y: rect.height / 2 - (node.y + getNodeHeight(node) / 2) * zoom,
      });
    },
    [nodes, zoom]
  );

  const jumpToWorldPos = React.useCallback(
    (worldX: number, worldY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPan({
        x: rect.width / 2 - worldX * zoom,
        y: rect.height / 2 - worldY * zoom,
      });
    },
    [zoom]
  );

  const autoLayout = React.useCallback(() => {
    const columns = 4;
    nodes.forEach((node, i) => {
      const snapped = snapPointToGrid(
        clampNodePosition({
          x: 144 + (i % columns) * 312,
          y: 168 + Math.floor(i / columns) * 240,
        })
      );
      updateNodePosition(node.id, snapped.x, snapped.y);
    });
    setTimeout(fitView, 0);
  }, [clampNodePosition, fitView, nodes, updateNodePosition]);

  const onNodeDragStart = React.useCallback((e: React.PointerEvent, node: GraphNode) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: "node",
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.x,
      nodeStartY: node.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onCanvasPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, [role='button'], [data-no-canvas-drag='true']")) return;
      e.preventDefault();
      dragRef.current = {
        mode: "canvas",
        startX: e.clientX,
        startY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y]
  );

  const scheduleDragUpdate = React.useCallback(() => {
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      const pending = pendingDragRef.current;
      dragFrameRef.current = null;
      pendingDragRef.current = null;
      if (!pending) return;
      if (pending.mode === "canvas") {
        setPan({ x: pending.x, y: pending.y });
      } else {
        updateNodePosition(pending.nodeId, pending.x, pending.y);
      }
    });
  }, [updateNodePosition]);

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (d.mode === "canvas") {
        pendingDragRef.current = {
          mode: "canvas",
          x: (d.panStartX ?? 0) + (e.clientX - d.startX),
          y: (d.panStartY ?? 0) + (e.clientY - d.startY),
        };
        scheduleDragUpdate();
      } else if (d.mode === "node" && d.nodeId) {
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        const unclamped = { x: (d.nodeStartX ?? 0) + dx, y: (d.nodeStartY ?? 0) + dy };
        const next = clampNodePosition(
          !snapToGridEnabled || e.altKey ? unclamped : snapPointToGrid(unclamped)
        );
        pendingDragRef.current = {
          mode: "node",
          nodeId: d.nodeId,
          x: next.x,
          y: next.y,
        };
        scheduleDragUpdate();
      }
    },
    [clampNodePosition, scheduleDragUpdate, snapToGridEnabled, zoom]
  );

  const onPointerUp = React.useCallback((_event?: React.PointerEvent) => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const pending = pendingDragRef.current;
    if (pending?.mode === "canvas") {
      setPan({ x: pending.x, y: pending.y });
    } else if (pending?.mode === "node") {
      updateNodePosition(pending.nodeId, pending.x, pending.y);
    }
    pendingDragRef.current = null;
    dragRef.current = { mode: null, startX: 0, startY: 0 };
  }, [updateNodePosition]);

  const onWheel = React.useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Before zoom world position
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;

      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      const nextZoom = Math.max(0.15, Math.min(3, zoom * factor));

      // New pan to keep world position under mouse
      const nextPanX = mouseX - worldX * nextZoom;
      const nextPanY = mouseY - worldY * nextZoom;

      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
    },
    [pan, zoom]
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, [onWheel]);

  return {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    scrollToNode,
    jumpToWorldPos,
    autoLayout,
    onNodeDragStart,
    onCanvasPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      // Logic will be handled in App.tsx
    },
  };
}
