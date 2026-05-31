import React from "react";
import { AnimatePresence } from "motion/react";
import NodeCard from "../canvas/NodeCard";
import { getInputAnchor, getOutputAnchor } from "../canvas/geometry";
import { GraphNode } from "../../types";

interface CanvasNodeLayerProps {
  apiConfig: {
    apiKey: string;
    baseUrl: string;
  };
  isLinkingOnCanvas: boolean;
  linkFromNodeId: string;
  linkFromOutputIndex: number;
  linkToInputIndex: number;
  linkToNodeId: string;
  nodes: GraphNode[];
  pan: { x: number; y: number };
  selectedNodeId: string | null;
  zoom: number;
  getCanvasLinkTargetIssue: (nodeId: string, inputIndex: number) => string | null;
  onBeginCanvasLink: (nodeId: string, outputIndex: number, clientX: number, clientY: number) => void;
  onCanvasPointerDown: (event: React.PointerEvent) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onFinishCanvasLink: (nodeId?: string, inputIndex?: number) => void;
  onHoverCanvasLinkTarget: (nodeId: string, inputIndex: number) => void;
  onLeaveCanvasLinkTarget: (nodeId: string, inputIndex: number) => void;
  onNodeDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onPreview: (content: string, title?: string, nodeId?: string, items?: string[], currentIndex?: number) => void;
  onSelectNode: (nodeId: string) => void;
  onUpdateNodeData: (nodeId: string, data: any) => void;
  onUpdateNodeProperty: (nodeId: string, key: string, value: unknown) => void;
}

export default function CanvasNodeLayer({
  apiConfig,
  isLinkingOnCanvas,
  linkFromNodeId,
  linkFromOutputIndex,
  linkToInputIndex,
  linkToNodeId,
  nodes,
  pan,
  selectedNodeId,
  zoom,
  getCanvasLinkTargetIssue,
  onBeginCanvasLink,
  onCanvasPointerDown,
  onDeleteNode,
  onDuplicateNode,
  onFinishCanvasLink,
  onHoverCanvasLinkTarget,
  onLeaveCanvasLinkTarget,
  onNodeDragStart,
  onPreview,
  onSelectNode,
  onUpdateNodeData,
  onUpdateNodeProperty,
}: CanvasNodeLayerProps) {
  return (
    <div
      className="absolute inset-0 z-20 origin-top-left"
      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      onPointerDown={onCanvasPointerDown}
    >
      <AnimatePresence>
        {nodes.map((node) => (
          <div key={node.id} className="absolute left-0 top-0" style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)` }}>
            <NodeCard
              node={node}
              selected={selectedNodeId === node.id}
              onSelect={() => onSelectNode(node.id)}
              onDelete={() => onDeleteNode(node.id)}
              onDuplicate={() => onDuplicateNode(node.id)}
              onDragStart={(e, currentNode) => {
                if (isLinkingOnCanvas) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                onNodeDragStart(e, currentNode);
              }}
              onUpdateProperty={onUpdateNodeProperty}
              onUpdateData={onUpdateNodeData}
              apiConfig={apiConfig}
              onPreview={onPreview}
            />
          </div>
        ))}
      </AnimatePresence>

      {nodes.map((node) =>
        node.outputs.map((output, idx) => {
          const anchor = getOutputAnchor(node, idx);
          return (
            <button
              key={`hit_out_${node.id}_${output.name}_${idx}`}
              type="button"
              className={`absolute z-30 block h-7 w-7 rounded-full transition-all ${
                isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === idx ? "bg-cyan-300/20 ring-2 ring-cyan-300/70" : "bg-transparent"
              }`}
              style={{ left: anchor.x - 14, top: anchor.y - 14 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onBeginCanvasLink(node.id, idx, e.clientX, e.clientY);
              }}
            />
          );
        })
      )}

      {nodes.map((node) =>
        node.inputs.map((input, idx) => {
          const anchor = getInputAnchor(node, idx);
          const targetIssue = getCanvasLinkTargetIssue(node.id, idx);
          const isHotTarget = linkToNodeId === node.id && linkToInputIndex === idx;
          return (
            <button
              key={`hit_in_${node.id}_${input.name}_${idx}`}
              type="button"
              title={targetIssue ?? `连接到 ${input.name} (${input.type})`}
              className={`absolute z-30 block h-7 w-7 rounded-full transition-all ${
                !isLinkingOnCanvas
                  ? "bg-transparent"
                  : targetIssue
                    ? "bg-amber-300/10 ring-1 ring-amber-300/40 cursor-not-allowed"
                    : isHotTarget
                      ? "bg-emerald-300/20 ring-2 ring-emerald-300/70 cursor-copy"
                      : "bg-emerald-300/10 ring-1 ring-emerald-300/35 cursor-copy"
              }`}
              style={{ left: anchor.x - 14, top: anchor.y - 14 }}
              onPointerEnter={(e) => {
                e.stopPropagation();
                onHoverCanvasLinkTarget(node.id, idx);
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                onLeaveCanvasLinkTarget(node.id, idx);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onFinishCanvasLink(node.id, idx);
              }}
            />
          );
        })
      )}
    </div>
  );
}
