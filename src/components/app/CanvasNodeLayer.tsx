import React from "react";
import { AnimatePresence } from "motion/react";
import NodeCard from "../canvas/NodeCard";
import TextNodeCard from "../canvas/TextNodeCard";
import ImageNodeCard from "../canvas/ImageNodeCard";
import VideoNodeCard from "../canvas/VideoNodeCard";
import AudioNodeCard from "../canvas/AudioNodeCard";
import { getInputAnchor, getOutputAnchor } from "../canvas/geometry";
import { GraphLink, GraphNode } from "../../types";
import type { VideoFrameCaptureItem } from "../../features/video/frameCapture";
import type { TextNodeReferenceItem } from "../../utils/textNodeReferences";
import { getCanvasNodeZIndex } from "../../utils/canvasNodeLayering";
import type { AiModelsByType } from "../../features/api/aiModelCatalog";
import type { CanvasGraphIndex } from "../../utils/canvasGraphIndex";
import type { ImageResolutionPresetGroup } from "../../features/nodes/imageResolutionPresets";
import { getVisibleCanvasNodeIds } from "../../utils/canvasViewportCulling";
import type { VideoFrameImageCaptureMode } from "../../utils/videoFrameImageExtraction";

interface CanvasNodeLayerProps {
  apiConfig: {
    apiKey: string;
    baseUrl: string;
    remoteModelsByType?: AiModelsByType;
  };
  canvasSize: { width: number; height: number };
  isLinkingOnCanvas: boolean;
  linkFromNodeId: string;
  linkFromOutputIndex: number;
  linkToInputIndex: number;
  linkToNodeId: string;
  links: GraphLink[];
  graphIndex?: CanvasGraphIndex;
  imageResolutionGroups?: ImageResolutionPresetGroup[];
  nodes: GraphNode[];
  pan: { x: number; y: number };
  draggingNodeId?: string | null;
  selectedNodeId: string | null;
  selectedNodeIds?: Set<string>;
  selectedGroupNodeIds?: Set<string>;
  videoResolutionGroups?: ImageResolutionPresetGroup[];
  zoom: number;
  getCanvasLinkTargetIssue: (nodeId: string, inputIndex: number) => string | null;
  onBeginCanvasLink: (
    nodeId: string,
    outputIndex: number,
    clientX: number,
    clientY: number
  ) => void;
  onCanvasPointerDown: (event: React.PointerEvent) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onFinishCanvasLink: (nodeId?: string, inputIndex?: number) => void;
  onHoverCanvasLinkTarget: (nodeId: string, inputIndex: number) => void;
  onLeaveCanvasLinkTarget: (nodeId: string, inputIndex: number) => void;
  onNodeContextMenu: (nodeId: string, event: React.MouseEvent) => void;
  onNodeDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onPreview: (
    content: string,
    title?: string,
    nodeId?: string,
    items?: string[],
    currentIndex?: number
  ) => void;
  onAnalyzeVideo?: (node: GraphNode, captures: VideoFrameCaptureItem[]) => Promise<void> | void;
  onReverseVideoPrompt?: (node: GraphNode, videoUrl: string) => Promise<void> | void;
  onSelectNode: (nodeId: string, e?: React.MouseEvent) => void;
  onUpdateNodeData: (nodeId: string, data: any) => void;
  onUpdateNodeProperty: (nodeId: string, key: string, value: unknown) => void;
  onSetPrimaryImageResult?: (nodeId: string, imageUrl: string, imageIndex: number) => void;
  onExtractFrameImage?: (
    nodeId: string,
    frameIndex: number,
    clientPoint?: { clientX: number; clientY: number }
  ) => void;
  onCreateVideoFrameImage?: (
    sourceNodeId: string,
    captureMode: VideoFrameImageCaptureMode,
    preview: { url: string; width: number; height: number }
  ) => string | null;
  onCompleteVideoFrameImage?: (nodeId: string, uploaded: { url: string; ossId?: string }) => void;
  onFailVideoFrameImage?: (nodeId: string, error: string) => void;
  onReplaceFrameImage?: (nodeId: string, frameIndex: number, replacementUrl: string) => void;
  onSyncImagePromptStarterLayout?: (nodeId: string, imageNodeWidth: number) => void;
  onSplitImageGrid?: (
    nodeId: string,
    imageUrl: string,
    gridRows: number,
    gridCols: number,
    cellIndices: number[],
    clientPoint?: { clientX: number; clientY: number }
  ) => void;
  onReplaceImageGridCell?: (
    nodeId: string,
    imageUrl: string,
    replacementUrl: string,
    gridRows: number,
    gridCols: number,
    cellIndex: number
  ) => void;
  resolvedInputsMap?: Map<string, Record<string, unknown>>;
  textNodeReferencesMap?: Map<string, TextNodeReferenceItem[]>;
  onRunNode?: (nodeId: string) => void;
  onNotice?: (message: string) => void;
}

export default function CanvasNodeLayer({
  apiConfig,
  canvasSize,
  isLinkingOnCanvas,
  linkFromNodeId,
  linkFromOutputIndex,
  linkToInputIndex,
  linkToNodeId,
  links,
  graphIndex,
  imageResolutionGroups,
  nodes,
  pan,
  draggingNodeId,
  selectedNodeId,
  selectedNodeIds,
  selectedGroupNodeIds,
  videoResolutionGroups,
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
  onReverseVideoPrompt,
  onSelectNode,
  onUpdateNodeData,
  onUpdateNodeProperty,
  onSetPrimaryImageResult,
  onExtractFrameImage,
  onCreateVideoFrameImage,
  onCompleteVideoFrameImage,
  onFailVideoFrameImage,
  onReplaceFrameImage,
  onSyncImagePromptStarterLayout,
  onSplitImageGrid,
  onReplaceImageGridCell,
  resolvedInputsMap,
  textNodeReferencesMap,
  onRunNode,
  onNotice,
}: CanvasNodeLayerProps) {
  const alwaysVisibleNodeIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (selectedNodeId) ids.add(selectedNodeId);
    if (draggingNodeId) ids.add(draggingNodeId);
    if (linkFromNodeId) ids.add(linkFromNodeId);
    if (linkToNodeId) ids.add(linkToNodeId);
    selectedNodeIds?.forEach((nodeId) => ids.add(nodeId));
    selectedGroupNodeIds?.forEach((nodeId) => ids.add(nodeId));
    return ids;
  }, [
    draggingNodeId,
    linkFromNodeId,
    linkToNodeId,
    selectedGroupNodeIds,
    selectedNodeId,
    selectedNodeIds,
  ]);

  const visibleNodeIds = React.useMemo(
    () =>
      getVisibleCanvasNodeIds({
        alwaysVisibleNodeIds,
        canvasSize,
        nodes,
        pan,
        zoom,
      }),
    [alwaysVisibleNodeIds, canvasSize, nodes, pan, zoom]
  );

  const visibleNodes = React.useMemo(
    () => nodes.filter((node) => visibleNodeIds.has(node.id)),
    [nodes, visibleNodeIds]
  );

  return (
    <div
      className="absolute inset-0 z-20 origin-top-left"
      data-canvas-background="true"
      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      onPointerDown={onCanvasPointerDown}
    >
      <AnimatePresence>
        {visibleNodes.map((node) => {
          return (
            <div
              key={node.id}
              className="absolute left-0 top-0"
              data-canvas-node-id={node.id}
              style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                zIndex: getCanvasNodeZIndex({
                  draggingNodeId,
                  nodeId: node.id,
                  selectedNodeId,
                }),
              }}
              onContextMenu={(event) => onNodeContextMenu(node.id, event)}
            >
              {node.type === "text_node" ? (
                <TextNodeCard
                  node={node}
                  selected={selectedNodeId === node.id}
                  apiConfig={apiConfig}
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
                  onSetPrimaryImageResult={onSetPrimaryImageResult}
                  onPreview={onPreview}
                  resolvedInputs={resolvedInputsMap?.get(node.id)}
                  references={textNodeReferencesMap?.get(node.id) ?? []}
                  hasConnectedLinks={
                    graphIndex
                      ? Boolean(
                          graphIndex.linksBySourceNodeId.get(node.id)?.length ||
                          graphIndex.linksByTargetNodeId.get(node.id)?.length
                        )
                      : links.some(
                          (link) => link.fromNodeId === node.id || link.toNodeId === node.id
                        )
                  }
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
                  apiConfig={apiConfig}
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
                  onSetPrimaryImageResult={onSetPrimaryImageResult}
                  onExtractFrameImage={onExtractFrameImage}
                  onReplaceFrameImage={onReplaceFrameImage}
                  onSyncImagePromptStarterLayout={onSyncImagePromptStarterLayout}
                  onSplitImageGrid={onSplitImageGrid}
                  onReplaceImageGridCell={onReplaceImageGridCell}
                  onPreview={onPreview}
                  resolvedInputs={resolvedInputsMap?.get(node.id)}
                  onRun={onRunNode}
                  onNotice={onNotice}
                  resolutionPresetGroups={imageResolutionGroups}
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
                  apiConfig={apiConfig}
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
                  onReverseVideoPrompt={onReverseVideoPrompt}
                  onCreateVideoFrameImage={onCreateVideoFrameImage}
                  onCompleteVideoFrameImage={onCompleteVideoFrameImage}
                  onFailVideoFrameImage={onFailVideoFrameImage}
                  resolvedInputs={resolvedInputsMap?.get(node.id)}
                  onRun={onRunNode}
                  resolutionPresetGroups={videoResolutionGroups}
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
                  onUpdateData={onUpdateNodeData}
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

      {visibleNodes.map((node) => {
        // LibTV 风格节点不再重复渲染外部端口按钮
        if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type))
          return null;

        return node.outputs.map((output, idx) => {
          const anchor = getOutputAnchor(node, idx);
          const isSource =
            isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === idx;
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
                isSource ? "canvas-port-active scale-125" : "hover:scale-125 port-attention"
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

      {visibleNodes.map((node) => {
        // LibTV 风格节点不再重复渲染外部端口按钮
        if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type))
          return null;

        return node.inputs.map((input, idx) => {
          const anchor = getInputAnchor(node, idx);
          const targetIssue = getCanvasLinkTargetIssue(node.id, idx);
          const isHotTarget = linkToNodeId === node.id && linkToInputIndex === idx;
          return (
            <button
              key={`hit_in_${node.id}_${input.name}_${idx}`}
              type="button"
              title={
                targetIssue ??
                `输入端口: ${input.name} (${input.type}) — 拖拽其他节点的输出到这里完成连接`
              }
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
