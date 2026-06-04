import React from "react";
import { AnimatePresence } from "motion/react";
import NodeCard from "../canvas/NodeCard";
import TextNodeCard from "../canvas/TextNodeCard";
import ImageNodeCard from "../canvas/ImageNodeCard";
import VideoNodeCard from "../canvas/VideoNodeCard";
import AudioNodeCard from "../canvas/AudioNodeCard";
import { getInputAnchor, getOutputAnchor } from "../canvas/geometry";
import { GraphNode, VideoFrameAnalysisOverview, VideoFrameAnalysisSegment } from "../../types";

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
  onNodeContextMenu: (nodeId: string, event: React.MouseEvent) => void;
  onNodeDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onPreview: (content: string, title?: string, nodeId?: string, items?: string[], currentIndex?: number) => void;
  onAnalyzeVideo?: (node: GraphNode, segments: VideoFrameAnalysisSegment[], overview: VideoFrameAnalysisOverview) => Promise<void> | void;
  onReverseSegmentAnalysis?: (node: GraphNode) => Promise<void> | void;
  onSelectNode: (nodeId: string, e?: React.MouseEvent) => void;
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
  onNodeContextMenu,
  onNodeDragStart,
  onPreview,
  onAnalyzeVideo,
  onReverseSegmentAnalysis,
  onSelectNode,
  onUpdateNodeData,
  onUpdateNodeProperty,
  resolvedInputsMap,
  onRunNode,
}: CanvasNodeLayerProps) {
  return (
    <div
      className="absolute inset-0 z-20 origin-top-left"
      data-canvas-background="true"
      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      onPointerDown={onCanvasPointerDown}
    >
      <AnimatePresence>
        {nodes.map((node) => {
          return (
          <div
            key={node.id}
            className="absolute left-0 top-0"
            data-canvas-node-id={node.id}
            style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)` }}
            onContextMenu={(event) => onNodeContextMenu(node.id, event)}
          >
            {node.type === "text_node" ? (
              <TextNodeCard
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={(e) => onSelectNode(node.id, e)}
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
                onPreview={onPreview}
                onReverseSegmentAnalysis={onReverseSegmentAnalysis}
                resolvedInputs={resolvedInputsMap?.get(node.id)}
                onRun={onRunNode}
                // 连线相关
                isLinkingOnCanvas={isLinkingOnCanvas}
                linkFromNodeId={linkFromNodeId}
                linkFromOutputIndex={linkFromOutputIndex}
                linkToNodeId={linkToNodeId}
                linkToInputIndex={linkToInputIndex}
                onBeginCanvasLink={onBeginCanvasLink}
                onFinishCanvasLink={onFinishCanvasLink}
                onHoverCanvasLinkTarget={onHoverCanvasLinkTarget}
                onLeaveCanvasLinkTarget={onLeaveCanvasLinkTarget}
                getCanvasLinkTargetIssue={getCanvasLinkTargetIssue}
              />
            ) : node.type === "image_node" ? (
              <ImageNodeCard
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={(e) => onSelectNode(node.id, e)}
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
                onPreview={onPreview}
                resolvedInputs={resolvedInputsMap?.get(node.id)}
                onRun={onRunNode}
                // 连线相关
                isLinkingOnCanvas={isLinkingOnCanvas}
                linkFromNodeId={linkFromNodeId}
                linkFromOutputIndex={linkFromOutputIndex}
                linkToNodeId={linkToNodeId}
                linkToInputIndex={linkToInputIndex}
                onBeginCanvasLink={onBeginCanvasLink}
                onFinishCanvasLink={onFinishCanvasLink}
                onHoverCanvasLinkTarget={onHoverCanvasLinkTarget}
                onLeaveCanvasLinkTarget={onLeaveCanvasLinkTarget}
                getCanvasLinkTargetIssue={getCanvasLinkTargetIssue}
              />
            ) : node.type === "video_node" ? (
              <VideoNodeCard
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={(e) => onSelectNode(node.id, e)}
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
                onPreview={onPreview}
                onAnalyzeVideo={onAnalyzeVideo}
                resolvedInputs={resolvedInputsMap?.get(node.id)}
                onRun={onRunNode}
                // 连线相关
                isLinkingOnCanvas={isLinkingOnCanvas}
                linkFromNodeId={linkFromNodeId}
                linkFromOutputIndex={linkFromOutputIndex}
                linkToNodeId={linkToNodeId}
                linkToInputIndex={linkToInputIndex}
                onBeginCanvasLink={onBeginCanvasLink}
                onFinishCanvasLink={onFinishCanvasLink}
                onHoverCanvasLinkTarget={onHoverCanvasLinkTarget}
                onLeaveCanvasLinkTarget={onLeaveCanvasLinkTarget}
                getCanvasLinkTargetIssue={getCanvasLinkTargetIssue}
              />
            ) : node.type === "audio_node" ? (
              <AudioNodeCard
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={(e) => onSelectNode(node.id, e)}
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
                resolvedInputs={resolvedInputsMap?.get(node.id)}
                onRun={onRunNode}
                // 连线相关
                isLinkingOnCanvas={isLinkingOnCanvas}
                linkFromNodeId={linkFromNodeId}
                linkFromOutputIndex={linkFromOutputIndex}
                linkToNodeId={linkToNodeId}
                linkToInputIndex={linkToInputIndex}
                onBeginCanvasLink={onBeginCanvasLink}
                onFinishCanvasLink={onFinishCanvasLink}
                onHoverCanvasLinkTarget={onHoverCanvasLinkTarget}
                onLeaveCanvasLinkTarget={onLeaveCanvasLinkTarget}
                getCanvasLinkTargetIssue={getCanvasLinkTargetIssue}
              />
            ) : (
              <NodeCard
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={(e) => onSelectNode(node.id, e)}
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
            )}
          </div>
          );
        })}
      </AnimatePresence>

      {nodes.map((node) => {
        // LibTV 风格节点不再重复渲染外部端口按钮
        if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type)) return null;
        
        return node.outputs.map((output, idx) => {
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
              className={`canvas-port-handle canvas-port-output absolute z-30 block h-9 w-9 rounded-full transition-all duration-200 cursor-crosshair group/out ${
                isSource
                  ? "canvas-port-active scale-125"
                  : "hover:scale-125 port-attention"
              }`}
              style={{ left: anchor.x - 18, top: anchor.y - 18 }}
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
        });
      })}

      {nodes.map((node) => {
        // LibTV 风格节点不再重复渲染外部端口按钮
        if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type)) return null;
        
        return node.inputs.map((input, idx) => {
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
              className={`canvas-port-handle canvas-port-input absolute z-30 block h-9 w-9 rounded-full transition-all duration-200 group/in ${
                !isLinkingOnCanvas
                  ? "hover:scale-125 cursor-crosshair port-attention"
                  : targetIssue
                    ? "canvas-port-invalid cursor-not-allowed"
                    : isHotTarget
                      ? "canvas-port-hot scale-125 cursor-copy"
                      : "cursor-copy hover:scale-110"
              }`}
              style={{ left: anchor.x - 18, top: anchor.y - 18 }}
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
      });
    })}
  </div>
);
}
