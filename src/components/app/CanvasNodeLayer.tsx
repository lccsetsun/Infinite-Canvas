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
  resolvedInputsMap?: Map<string, Record<string, unknown>>;
  onRunNode?: (nodeId: string) => void;
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
  resolvedInputsMap,
  onRunNode,
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
              resolvedInputs={resolvedInputsMap?.get(node.id)}
              onRun={onRunNode}
            />
          </div>
        ))}
      </AnimatePresence>

      {nodes.map((node) =>
        node.outputs.map((output, idx) => {
          const anchor = getOutputAnchor(node, idx);
          const isSource = isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === idx;
          return (
            <button
              key={`hit_out_${node.id}_${output.name}_${idx}`}
              type="button"
              title={`输出端口: ${output.name} (${output.type}) — 按住拖拽连接到其他节点的输入`}
              aria-label={`输出端口 ${output.name}`}
              data-port-role="output"
              data-node-id={node.id}
              data-port-index={idx}
              className={`absolute z-30 block h-7 w-7 rounded-full transition-all duration-200 cursor-crosshair group/out ${
                isSource
                  ? "bg-cyan-300/30 ring-2 ring-cyan-300/80 scale-125"
                  : "bg-violet-400/0 hover:bg-violet-400/35 hover:ring-2 hover:ring-violet-300/80 hover:scale-125 port-attention"
              }`}
              style={{ left: anchor.x - 14, top: anchor.y - 14 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onBeginCanvasLink(node.id, idx, e.clientX, e.clientY);
              }}
            >
              <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md bg-[#0a0d14]/95 border border-violet-400/40 text-[10px] font-bold text-violet-200 whitespace-nowrap opacity-0 group-hover/out:opacity-100 pointer-events-none transition-opacity shadow-lg">
                {output.name} · {output.type}
              </span>
            </button>
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
              title={targetIssue ?? `输入端口: ${input.name} (${input.type}) — 拖拽其他节点的输出到这里完成连接`}
              aria-label={`输入端口 ${input.name}`}
              data-port-role="input"
              data-node-id={node.id}
              data-port-index={idx}
              className={`absolute z-30 block h-7 w-7 rounded-full transition-all duration-200 group/in ${
                !isLinkingOnCanvas
                  ? "bg-emerald-400/0 hover:bg-emerald-400/35 hover:ring-2 hover:ring-emerald-300/80 hover:scale-125 cursor-crosshair port-attention"
                  : targetIssue
                    ? "bg-amber-300/10 ring-1 ring-amber-300/40 cursor-not-allowed"
                    : isHotTarget
                      ? "bg-emerald-300/30 ring-2 ring-emerald-300/80 scale-125 cursor-copy"
                      : "bg-emerald-300/15 ring-1 ring-emerald-300/40 cursor-copy hover:bg-emerald-300/30"
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
            >
              <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-[#0a0d14]/95 border border-emerald-400/40 text-[10px] font-bold text-emerald-200 whitespace-nowrap opacity-0 group-hover/in:opacity-100 pointer-events-none transition-opacity shadow-lg">
                {input.name} · {input.type}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
