import React from "react";
import { GraphLink, GraphNode } from "../types";
import { resolveAutoConnectTarget } from "../utils/autoConnectTarget";
import { getLinkDraftIssue } from "../utils/linking";

interface WorldPoint {
  x: number;
  y: number;
}

interface UseCanvasLinkingOptions {
  addLinkFromDraft: (draft: {
    fromNodeId: string;
    toNodeId: string;
    fromOutputIndex: number;
    toInputIndex: number;
  }) => boolean;
  clearLinkDraft: () => void;
  linkFromNodeId: string;
  linkFromOutputIndex: number;
  linkToInputIndex: number;
  linkToNodeId: string;
  links: GraphLink[];
  nodes: GraphNode[];
  setLinkFromNodeId: (nodeId: string) => void;
  setLinkFromOutputIndex: (outputIndex: number) => void;
  setLinkToInputIndex: (inputIndex: number) => void;
  setLinkToNodeId: (nodeId: string) => void;
  setSelectedNodeId: (nodeId: string) => void;
  showNotice: (message: string, duration?: number) => void;
  toWorld: (clientX: number, clientY: number) => WorldPoint;
  onBlankLinkDrop?: (draft: {
    clientX: number;
    clientY: number;
    fromNodeId: string;
    fromOutputIndex: number;
    worldPoint: WorldPoint;
  }) => void;
}

export function useCanvasLinking({
  addLinkFromDraft,
  clearLinkDraft,
  linkFromNodeId,
  linkFromOutputIndex,
  linkToInputIndex,
  linkToNodeId,
  links,
  nodes,
  setLinkFromNodeId,
  setLinkFromOutputIndex,
  setLinkToInputIndex,
  setLinkToNodeId,
  setSelectedNodeId,
  showNotice,
  toWorld,
  onBlankLinkDrop,
}: UseCanvasLinkingOptions) {
  const [isLinkingOnCanvas, setIsLinkingOnCanvas] = React.useState(false);
  const [draftCursor, setDraftCursor] = React.useState<WorldPoint | null>(null);

  const resetCanvasLinkDraft = React.useCallback(() => {
    clearLinkDraft();
    setDraftCursor(null);
    setIsLinkingOnCanvas(false);
  }, [clearLinkDraft]);

  const beginCanvasLink = React.useCallback(
    (nodeId: string, outputIndex: number, clientX: number, clientY: number) => {
      setSelectedNodeId(nodeId);
      setLinkFromNodeId(nodeId);
      setLinkFromOutputIndex(outputIndex);
      setLinkToNodeId("");
      setLinkToInputIndex(0);
      setDraftCursor(toWorld(clientX, clientY));
      setIsLinkingOnCanvas(true);
    },
    [setSelectedNodeId, setLinkFromNodeId, setLinkFromOutputIndex, setLinkToNodeId, setLinkToInputIndex, toWorld]
  );

  const hoverCanvasLinkTarget = React.useCallback(
    (nodeId: string, inputIndex: number) => {
      if (!isLinkingOnCanvas) return;
      const issue = getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: nodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: inputIndex,
        nodes,
        links,
      });
      if (issue) return;
      setLinkToNodeId(nodeId);
      setLinkToInputIndex(inputIndex);
    },
    [isLinkingOnCanvas, linkFromNodeId, linkFromOutputIndex, links, nodes, setLinkToNodeId, setLinkToInputIndex]
  );

  const leaveCanvasLinkTarget = React.useCallback(
    (nodeId: string, inputIndex: number) => {
      if (!isLinkingOnCanvas) return;
      if (linkToNodeId === nodeId && linkToInputIndex === inputIndex) {
        setLinkToNodeId("");
        setLinkToInputIndex(0);
      }
    },
    [isLinkingOnCanvas, linkToInputIndex, linkToNodeId, setLinkToNodeId, setLinkToInputIndex]
  );

  const finishCanvasLink = React.useCallback(
    (toNodeId?: string, toInputIndex?: number) => {
      if (!isLinkingOnCanvas || !linkFromNodeId) {
        resetCanvasLinkDraft();
        return;
      }

      const finalToNodeId = toNodeId ?? linkToNodeId;
      const finalToInputIndex = toInputIndex ?? linkToInputIndex;
      if (!finalToNodeId) {
        resetCanvasLinkDraft();
        return;
      }

      const created = addLinkFromDraft({
        fromNodeId: linkFromNodeId,
        toNodeId: finalToNodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: finalToInputIndex,
      });

      if (created) showNotice("已通过拖拽建立连线");
      resetCanvasLinkDraft();
    },
    [
      addLinkFromDraft,
      isLinkingOnCanvas,
      linkFromNodeId,
      linkFromOutputIndex,
      linkToInputIndex,
      linkToNodeId,
      resetCanvasLinkDraft,
      showNotice,
    ]
  );

  const getCanvasLinkTargetIssue = React.useCallback(
    (nodeId: string, inputIndex: number) => {
      if (!isLinkingOnCanvas || !linkFromNodeId) return null;
      return getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: nodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: inputIndex,
        nodes,
        links,
      });
    },
    [isLinkingOnCanvas, linkFromNodeId, linkFromOutputIndex, nodes, links]
  );

  const finishCanvasLinkRef = React.useRef(finishCanvasLink);
  React.useEffect(() => {
    finishCanvasLinkRef.current = finishCanvasLink;
  }, [finishCanvasLink]);

  React.useEffect(() => {
    if (!isLinkingOnCanvas) return;

    const getInputDropTarget = (target: HTMLElement | null) => {
      const portEl = target?.closest("[data-port-role='input']") as HTMLElement | null;
      if (portEl) {
        return {
          inputIndex: parseInt(portEl.getAttribute("data-port-index") || "0", 10),
          nodeId: portEl.getAttribute("data-node-id") || "",
        };
      }

      const nodeEl = target?.closest("[data-canvas-node-id]") as HTMLElement | null;
      const nodeId = nodeEl?.getAttribute("data-canvas-node-id") || "";
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node || node.inputs.length === 0) return null;

      return { inputIndex: 0, nodeId };
    };
    
    const onMove = (e: PointerEvent) => {
      // Use requestAnimationFrame for smoother cursor tracking
      window.requestAnimationFrame(() => {
        setDraftCursor(toWorld(e.clientX, e.clientY));
      });

      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      const inputTarget = getInputDropTarget(target);
      
      if (inputTarget) {
        const autoTarget = resolveAutoConnectTarget({
          candidateInputIndex: inputTarget.inputIndex,
          candidateNodeId: inputTarget.nodeId,
          fromNodeId: linkFromNodeId,
          fromOutputIndex: linkFromOutputIndex,
          links,
          nodes,
        });
        
        if (autoTarget) {
          setLinkToNodeId(autoTarget.nodeId);
          setLinkToInputIndex(autoTarget.inputIndex);
        } else if (linkToNodeId) {
          setLinkToNodeId("");
          setLinkToInputIndex(0);
        }
      } else if (linkToNodeId) {
        setLinkToNodeId("");
        setLinkToInputIndex(0);
      }
    };
    
    const onUp = (e: PointerEvent) => {
      // Final hit test on release
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      const inputTarget = getInputDropTarget(target);
      
      if (inputTarget) {
        finishCanvasLinkRef.current(inputTarget.nodeId, inputTarget.inputIndex);
      } else if (onBlankLinkDrop && linkFromNodeId) {
        onBlankLinkDrop({
          clientX: e.clientX,
          clientY: e.clientY,
          fromNodeId: linkFromNodeId,
          fromOutputIndex: linkFromOutputIndex,
          worldPoint: toWorld(e.clientX, e.clientY),
        });
        resetCanvasLinkDraft();
      } else {
        finishCanvasLinkRef.current();
      }
    };
    
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isLinkingOnCanvas, toWorld, setDraftCursor, linkFromNodeId, linkFromOutputIndex, linkToNodeId, linkToInputIndex, nodes, links, setLinkToNodeId, setLinkToInputIndex, onBlankLinkDrop, resetCanvasLinkDraft]);

  return {
    beginCanvasLink,
    draftCursor,
    finishCanvasLink,
    getCanvasLinkTargetIssue,
    hoverCanvasLinkTarget,
    isLinkingOnCanvas,
    leaveCanvasLinkTarget,
    resetCanvasLinkDraft,
    setDraftCursor,
  };
}
