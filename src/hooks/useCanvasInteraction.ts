import React from "react";
import { NODE_HEIGHT, NODE_WIDTH } from "../components/canvas/geometry";
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
  nodeElement?: HTMLElement;
};

type PendingDrag =
  | { mode: "canvas"; x: number; y: number }
  | { mode: "node"; nodeId: string; x: number; y: number };

interface UseCanvasInteractionOptions {
  nodes: GraphNode[];
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
}

export function useCanvasInteraction({ nodes, updateNodePosition }: UseCanvasInteractionOptions) {
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

  const fitView = React.useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const targetZoom = Math.max(0.4, Math.min(1.2, Math.min((rect.width - 120) / width, (rect.height - 120) / height)));
    setZoom(targetZoom);
    setPan({
      x: rect.width / 2 - (minX + width / 2) * targetZoom,
      y: rect.height / 2 - (minY + height / 2) * targetZoom,
    });
  }, [nodes]);

  const autoLayout = React.useCallback(() => {
    const columns = 4;
    nodes.forEach((node, i) => {
      updateNodePosition(node.id, 140 + (i % columns) * 320, 160 + Math.floor(i / columns) * 240);
    });
    setTimeout(fitView, 0);
  }, [fitView, nodes, updateNodePosition]);

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
      nodeElement: e.currentTarget as HTMLElement,
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
        const nextX = (d.nodeStartX ?? 0) + dx;
        const nextY = (d.nodeStartY ?? 0) + dy;
        if (d.nodeElement) {
          d.nodeElement.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
        }
        pendingDragRef.current = {
          mode: "node",
          nodeId: d.nodeId,
          x: nextX,
          y: nextY,
        };
        scheduleDragUpdate();
      }
    },
    [scheduleDragUpdate, zoom]
  );

  const onPointerUp = React.useCallback(() => {
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

  const onWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.35, Math.min(1.8, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, []);

  React.useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  return {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    autoLayout,
    onNodeDragStart,
    onCanvasPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
  };
}
