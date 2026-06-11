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

const TEXT_NODE_FOCUS_WIDTH = 620;
const TEXT_NODE_FOCUS_HEIGHT = 610;

function getNodeFocusBounds(node: GraphNode) {
  if (node.type === "text_node") {
    const width = getNodeWidth(node);
    const focusWidth = Math.max(TEXT_NODE_FOCUS_WIDTH, width);
    const focusMinX = node.x - (focusWidth - width) / 2;
    return {
      minX: focusMinX,
      minY: node.y - 40,
      maxX: focusMinX + focusWidth,
      maxY: node.y + TEXT_NODE_FOCUS_HEIGHT,
    };
  }
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + getNodeWidth(node),
    maxY: node.y + getNodeHeight(node),
  };
}

interface UseCanvasInteractionOptions {
  nodes: GraphNode[];
  initialViewport?: CanvasViewport | null;
  snapToGridEnabled?: boolean;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  viewportKey?: string | null;
}

export type CanvasViewport = {
  pan: { x: number; y: number };
  zoom: number;
};

export function getDraggedNodePosition({
  altKey = false,
  clientX,
  clientY,
  nodeStartX,
  nodeStartY,
  snapToGridEnabled = true,
  startX,
  startY,
  zoom,
}: {
  altKey?: boolean;
  clientX: number;
  clientY: number;
  nodeStartX: number;
  nodeStartY: number;
  snapToGridEnabled?: boolean;
  startX: number;
  startY: number;
  zoom: number;
}) {
  const point = {
    x: nodeStartX + (clientX - startX) / zoom,
    y: nodeStartY + (clientY - startY) / zoom,
  };
  return !snapToGridEnabled || altKey ? point : snapPointToGrid(point);
}

export function shouldStartCanvasPan(button: number) {
  return button === 1;
}

export function getWheelPanPosition({
  deltaX,
  deltaY,
  pan,
}: {
  deltaX: number;
  deltaY: number;
  pan: { x: number; y: number };
}) {
  return {
    x: pan.x - deltaX,
    y: pan.y - deltaY,
  };
}

export function useCanvasInteraction({
  initialViewport,
  nodes,
  snapToGridEnabled = true,
  updateNodePosition,
  viewportKey,
}: UseCanvasInteractionOptions) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState>({ mode: null, startX: 0, startY: 0 });
  const dragFrameRef = React.useRef<number | null>(null);
  const pendingDragRef = React.useRef<PendingDrag | null>(null);
  const viewportKeyRef = React.useRef(viewportKey ?? null);
  const [pan, setPan] = React.useState(() => initialViewport?.pan ?? { x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(() => initialViewport?.zoom ?? 1);
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [isCanvasPanning, setIsCanvasPanning] = React.useState(false);

  React.useEffect(() => {
    const nextKey = viewportKey ?? null;
    if (viewportKeyRef.current === nextKey) return;

    viewportKeyRef.current = nextKey;
    setPan(initialViewport?.pan ?? { x: 0, y: 0 });
    setZoom(initialViewport?.zoom ?? 1);
  }, [initialViewport?.pan.x, initialViewport?.pan.y, initialViewport?.zoom, viewportKey]);

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

    const nodeBounds = nodes.map(getNodeFocusBounds);
    const minX = Math.min(...nodeBounds.map((bounds) => bounds.minX));
    const minY = Math.min(...nodeBounds.map((bounds) => bounds.minY));

    const maxX = Math.max(...nodeBounds.map((bounds) => bounds.maxX));
    const maxY = Math.max(...nodeBounds.map((bounds) => bounds.maxY));

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    const padding = 160;
    const targetZoom = Math.max(
      0.35,
      Math.min(1.1, Math.min((rect.width - padding) / width, (rect.height - padding) / height))
    );

    setZoom(targetZoom);

    setPan({
      x: rect.width / 2 - (minX + width / 2) * targetZoom + 30,
      y: rect.height / 2 - (minY + height / 2) * targetZoom,
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

  const focusWorldRect = React.useCallback(
    (
      bounds: { minX: number; minY: number; maxX: number; maxY: number },
      options?: { maxZoom?: number; padding?: number; offsetX?: number; offsetY?: number }
    ) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = Math.max(1, bounds.maxX - bounds.minX);
      const height = Math.max(1, bounds.maxY - bounds.minY);
      const padding = options?.padding ?? 300;
      const targetZoom = Math.max(
        0.45,
        Math.min(
          options?.maxZoom ?? 0.72,
          Math.min((rect.width - padding) / width, (rect.height - padding * 0.55) / height)
        )
      );
      const centerX = bounds.minX + width / 2;
      const centerY = bounds.minY + height / 2;

      setZoom(targetZoom);
      setPan({
        x: rect.width / 2 - centerX * targetZoom + (options?.offsetX ?? 0),
        y: rect.height / 2 - centerY * targetZoom + (options?.offsetY ?? 0),
      });
    },
    []
  );

  const autoLayout = React.useCallback(() => {
    const columns = 4;
    nodes.forEach((node, i) => {
      const snapped = snapPointToGrid({
        x: 144 + (i % columns) * 312,
        y: 168 + Math.floor(i / columns) * 240,
      });
      updateNodePosition(node.id, snapped.x, snapped.y);
    });
    setTimeout(fitView, 0);
  }, [fitView, nodes, updateNodePosition]);

  const onNodeDragStart = React.useCallback((e: React.PointerEvent, node: GraphNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingNodeId(node.id);
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
      if (!shouldStartCanvasPan(e.button)) return;
      e.preventDefault();
      dragRef.current = {
        mode: "canvas",
        startX: e.clientX,
        startY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      setIsCanvasPanning(true);
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
        const next = getDraggedNodePosition({
          altKey: e.altKey,
          clientX: e.clientX,
          clientY: e.clientY,
          nodeStartX: d.nodeStartX ?? 0,
          nodeStartY: d.nodeStartY ?? 0,
          snapToGridEnabled,
          startX: d.startX,
          startY: d.startY,
          zoom,
        });
        pendingDragRef.current = {
          mode: "node",
          nodeId: d.nodeId,
          x: next.x,
          y: next.y,
        };
        scheduleDragUpdate();
      }
    },
    [scheduleDragUpdate, snapToGridEnabled, zoom]
  );

  const onPointerUp = React.useCallback(
    (_event?: React.PointerEvent) => {
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
      setIsCanvasPanning(false);
      dragRef.current = { mode: null, startX: 0, startY: 0 };
      setDraggingNodeId(null);
    },
    [updateNodePosition]
  );

  const onWheel = React.useCallback(
    (e: WheelEvent) => {
      // Allow wheel scrolling inside overlays (e.g. settings panels) that opted
      // into pass-through mode. Otherwise the global wheel handler would
      // preventDefault and starve the inner overflow-y-auto container.
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-canvas-passthrough='true']")) {
        return;
      }

      e.preventDefault();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (!(e.ctrlKey || e.metaKey)) {
        setPan(getWheelPanPosition({ deltaX: e.deltaX, deltaY: e.deltaY, pan }));
        return;
      }

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
    focusWorldRect,
    autoLayout,
    draggingNodeId,
    isCanvasPanning,
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
