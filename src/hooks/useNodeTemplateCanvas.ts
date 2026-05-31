import React from "react";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import { AVAILABLE_NODE_TYPES } from "../features/nodes/nodeRegistry";
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

export function useNodeTemplateCanvas() {
  const [templatePan, setTemplatePan] = React.useState({ x: 120, y: 100 });
  const [templateZoom, setTemplateZoom] = React.useState(0.9);
  const [templateNodes, setTemplateNodes] = React.useState<GraphNode[]>([]);
  const templateDragRef = React.useRef<DragState>({ mode: null, startX: 0, startY: 0 });
  const templateDragFrameRef = React.useRef<number | null>(null);
  const pendingTemplateDragRef = React.useRef<PendingDrag | null>(null);

  React.useEffect(() => {
    const cols = 3;
    const FEATURED_TYPES: NodeClass[] = ["text_node", "image_node", "video_node"];
    const laidOut = FEATURED_TYPES.map((type, idx) =>
      createNodeFromType(type, `tpl_${type}`, 80 + (idx % cols) * 350, 120)
    );
    setTemplateNodes(laidOut);
  }, []);

  const onTemplateNodeDragStart = React.useCallback((e: React.PointerEvent, node: GraphNode) => {
    e.preventDefault();
    e.stopPropagation();
    templateDragRef.current = {
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

  const onTemplateCanvasPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, [role='button'], [data-no-canvas-drag='true']")) return;
      e.preventDefault();
      templateDragRef.current = {
        mode: "canvas",
        startX: e.clientX,
        startY: e.clientY,
        panStartX: templatePan.x,
        panStartY: templatePan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [templatePan.x, templatePan.y]
  );

  const scheduleTemplateDragUpdate = React.useCallback(() => {
    if (templateDragFrameRef.current !== null) return;
    templateDragFrameRef.current = window.requestAnimationFrame(() => {
      const pending = pendingTemplateDragRef.current;
      templateDragFrameRef.current = null;
      pendingTemplateDragRef.current = null;
      if (!pending) return;
      if (pending.mode === "canvas") {
        setTemplatePan({ x: pending.x, y: pending.y });
      } else {
        setTemplateNodes((prev) =>
          prev.map((n) => (n.id === pending.nodeId ? { ...n, x: pending.x, y: pending.y } : n))
        );
      }
    });
  }, []);

  const onTemplatePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const d = templateDragRef.current;
      if (d.mode === "canvas") {
        pendingTemplateDragRef.current = {
          mode: "canvas",
          x: (d.panStartX ?? 0) + (e.clientX - d.startX),
          y: (d.panStartY ?? 0) + (e.clientY - d.startY),
        };
        scheduleTemplateDragUpdate();
      } else if (d.mode === "node" && d.nodeId) {
        const dx = (e.clientX - d.startX) / templateZoom;
        const dy = (e.clientY - d.startY) / templateZoom;
        const nextX = (d.nodeStartX ?? 0) + dx;
        const nextY = (d.nodeStartY ?? 0) + dy;
        if (d.nodeElement) {
          d.nodeElement.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
        }
        pendingTemplateDragRef.current = {
          mode: "node",
          nodeId: d.nodeId,
          x: nextX,
          y: nextY,
        };
        scheduleTemplateDragUpdate();
      }
    },
    [scheduleTemplateDragUpdate, templateZoom]
  );

  const updateTemplateNodeProperty = (nodeId: string, key: string, value: unknown) => {
    setTemplateNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, properties: { ...n.properties, [key]: value } } : n
      )
    );
  };

  const updateTemplateNodeData = (nodeId: string, data: Partial<GraphNode["data"]>) => {
    setTemplateNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...data } } : n
      )
    );
  };

  const onTemplatePointerUp = React.useCallback(() => {
    if (templateDragFrameRef.current !== null) {
      window.cancelAnimationFrame(templateDragFrameRef.current);
      templateDragFrameRef.current = null;
    }
    const pending = pendingTemplateDragRef.current;
    if (pending?.mode === "canvas") {
      setTemplatePan({ x: pending.x, y: pending.y });
    } else if (pending?.mode === "node") {
      setTemplateNodes((prev) =>
        prev.map((n) => (n.id === pending.nodeId ? { ...n, x: pending.x, y: pending.y } : n))
      );
    }
    pendingTemplateDragRef.current = null;
    templateDragRef.current = { mode: null, startX: 0, startY: 0 };
  }, []);

  const onTemplateWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTemplateZoom((z) => Math.max(0.35, Math.min(1.8, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, []);

  React.useEffect(() => {
    return () => {
      if (templateDragFrameRef.current !== null) {
        window.cancelAnimationFrame(templateDragFrameRef.current);
      }
    };
  }, []);

  return {
    templateNodes,
    templatePan,
    templateZoom,
    onTemplateNodeDragStart,
    onTemplateCanvasPointerDown,
    onTemplatePointerMove,
    onTemplatePointerUp,
    onTemplateWheel,
    updateTemplateNodeProperty,
    updateTemplateNodeData,
  };
}
