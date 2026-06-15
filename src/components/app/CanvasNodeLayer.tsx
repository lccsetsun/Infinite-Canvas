import React from "react";
import { AnimatePresence } from "motion/react";
import { FileText, Image as ImageIcon, Music2, Video } from "lucide-react";
import NodeCard from "../canvas/NodeCard";
import TextNodeCard from "../canvas/TextNodeCard";
import ImageNodeCard from "../canvas/ImageNodeCard";
import VideoNodeCard from "../canvas/VideoNodeCard";
import VideoBatchReplacementNodeCard from "../canvas/VideoBatchReplacementNodeCard";
import AudioNodeCard from "../canvas/AudioNodeCard";
import { getInputAnchor, getNodeWidth, getOutputAnchor } from "../canvas/geometry";
import { GraphLink, GraphNode } from "../../types";
import type { VideoFrameCaptureItem } from "../../features/video/frameCapture";
import type { TextNodeReferenceItem } from "../../utils/textNodeReferences";
import { getCanvasNodeZIndex } from "../../utils/canvasNodeLayering";
import type { AiModelsByType } from "../../features/api/aiModelCatalog";
import type { CanvasGraphIndex } from "../../utils/canvasGraphIndex";
import { hasCanvasPointerDragExceededClickThreshold } from "../../utils/canvasPointerPolicy";
import type { ImageResolutionPresetGroup } from "../../features/nodes/imageResolutionPresets";
import { getVisibleCanvasNodeIds } from "../../utils/canvasViewportCulling";
import type { VideoFrameImageCaptureMode } from "../../utils/videoFrameImageExtraction";
import {
  type VideoBatchReplacementMode,
  type VideoBatchReplacementModeOption,
  type VideoBatchReplacementSlotKey,
} from "../../utils/videoBatchReplacementLayout";

function getDetachedMediaNodeTitle(node: GraphNode) {
  if (node.type === "text_node") {
    return node.title === "鏂囨湰" || node.title === "文本" || node.title === "文本节点"
      ? "文本 1"
      : node.title.replace(/节点(?=\s*\d*$)/, "").trim();
  }
  if (node.type === "image_node" && (node.title === "图片节点" || node.title === "图片")) {
    return "图片 1";
  }
  if (node.type === "video_node" && (node.title === "视频节点" || node.title === "视频")) {
    return "视频 1";
  }
  if (node.type === "audio_node" && (node.title === "音频节点" || node.title === "音频")) {
    return "音频 1";
  }
  return node.title.replace(/节点(?=\s*\d*$)/, "").trim();
}

function getDetachedMediaNodeSizeLabel(node: GraphNode) {
  if (node.type === "video_node") {
    const width = node.data?.videoNaturalWidth ?? node.data?.videoDisplayWidth;
    const height = node.data?.videoNaturalHeight ?? node.data?.videoDisplayHeight;
    if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
      return `${Math.round(width)} × ${Math.round(height)}`;
    }
    return null;
  }

  if (node.type === "image_node") {
    if (node.data?.isFrameStrip === true && Array.isArray(node.data.frameImageOssIds)) {
      return `${node.data.frameImageOssIds.length} 帧`;
    }
    const width = node.data?.imageNaturalWidth ?? node.data?.imageDisplayWidth;
    const height = node.data?.imageNaturalHeight ?? node.data?.imageDisplayHeight;
    if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
      return `${Math.round(width)} × ${Math.round(height)}`;
    }
  }

  return null;
}

function DetachedMediaNodeTitle({
  isLinkingOnCanvas,
  node,
  onDragStart,
  onSelect,
  pan,
  zoom,
}: {
  isLinkingOnCanvas: boolean;
  node: GraphNode;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  onSelect: (nodeId: string, event?: React.MouseEvent) => void;
  pan: { x: number; y: number };
  zoom: number;
}) {
  if (!["text_node", "image_node", "video_node", "audio_node"].includes(node.type)) return null;

  const title = getDetachedMediaNodeTitle(node);
  const sizeLabel = getDetachedMediaNodeSizeLabel(node);
  const match = title.match(/^(.*?)(\s+\d+)$/);
  const Icon =
    node.type === "text_node"
      ? FileText
      : node.type === "image_node"
        ? ImageIcon
        : node.type === "audio_node"
          ? Music2
          : Video;
  const iconClassName =
    node.type === "audio_node"
      ? "h-3.5 w-3.5 shrink-0 text-cyan-100/58"
      : "h-3.5 w-3.5 shrink-0 text-violet-100/58";
  const titleScale = Math.max(0.78, Math.min(1, zoom / 0.55));
  const rowWidth = Math.max(180, getNodeWidth(node) * zoom);

  return (
    <div
      className="absolute left-0 top-0 cursor-grab text-slate-300/82 drop-shadow-[0_1px_10px_rgba(15,23,42,0.9)] active:cursor-grabbing pointer-events-auto"
      data-canvas-node-title-id={node.id}
      style={{
        transform: `translate3d(${pan.x + node.x * zoom}px, ${pan.y + node.y * zoom - 24}px, 0)`,
      }}
      onPointerDown={(event) => {
        if (isLinkingOnCanvas) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
        onDragStart(event, node);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id, event);
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{ scale: titleScale, transformOrigin: "left center" }}
      >
        <div className="flex min-w-0 items-center gap-1.5" style={{ width: rowWidth }}>
          <Icon className={iconClassName} />
          <span className="min-w-0 truncate text-[13px] font-medium tracking-tight">
            {match ? (
              <>
                <span>{match[1]}</span>
                <span className="text-emerald-200/72">{match[2]}</span>
              </>
            ) : (
              title
            )}
          </span>
          {sizeLabel && (
            <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-slate-400/72">
              {sizeLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

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
  videoBatchReplacementModeOptions?: VideoBatchReplacementModeOption[];
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
  onCreateVideoBatchReplacement?: (node: GraphNode) => void;
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
  onReplaceFrameImage?: (
    nodeId: string,
    frameIndex: number,
    replacementUrl: string,
    replacementOssId?: string
  ) => void;
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
  onDropImageToVideoBatchReplacement?: (
    nodeId: string,
    slotKey: VideoBatchReplacementSlotKey,
    imageUrl: string,
    ossId?: string
  ) => void;
  resolvedInputsMap?: Map<string, Record<string, unknown>>;
  inputReferencesMap?: Map<string, TextNodeReferenceItem[]>;
  onRemoveInputReference?: (linkId: string, value: string) => void;
  onRunNode?: (nodeId: string) => void;
  onNotice?: (message: string) => void;
  onSubmitVideoBatchReplacement?: (
    nodeId: string,
    slots: NonNullable<GraphNode["data"]>["batchReplacementSlots"],
    mode: VideoBatchReplacementMode
  ) => void | Promise<void>;
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
  videoBatchReplacementModeOptions,
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
  onCreateVideoBatchReplacement,
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
  onDropImageToVideoBatchReplacement,
  resolvedInputsMap,
  inputReferencesMap,
  onRemoveInputReference,
  onRunNode,
  onNotice,
  onSubmitVideoBatchReplacement,
}: CanvasNodeLayerProps) {
  const nodeDragClickGuardRef = React.useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    startedAt: number;
  } | null>(null);

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

  const handleNodeDragStart = React.useCallback(
    (event: React.PointerEvent, node: GraphNode) => {
      nodeDragClickGuardRef.current = {
        nodeId: node.id,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: Date.now(),
      };
      onNodeDragStart(event, node);
    },
    [onNodeDragStart]
  );

  const handleNodeSelect = React.useCallback(
    (nodeId: string, event?: React.MouseEvent) => {
      const guard = nodeDragClickGuardRef.current;
      if (event && guard?.nodeId === nodeId && Date.now() - guard.startedAt < 1_000) {
        nodeDragClickGuardRef.current = null;
        if (
          hasCanvasPointerDragExceededClickThreshold({
            startX: guard.startX,
            startY: guard.startY,
            endX: event.clientX,
            endY: event.clientY,
          })
        ) {
          event.stopPropagation();
          return;
        }
      }

      nodeDragClickGuardRef.current = null;
      onSelectNode(nodeId, event);
    },
    [onSelectNode]
  );

  return (
    <>
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
                    detachedCanvasTitle
                    canvasZoom={zoom}
                    apiConfig={apiConfig}
                    onSelect={(e) => handleNodeSelect(node.id, e)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDuplicate={() => onDuplicateNode(node.id)}
                    onDragStart={(e, currentNode) => {
                      if (isLinkingOnCanvas) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNodeDragStart(e, currentNode);
                    }}
                    onUpdateProperty={onUpdateNodeProperty}
                    onUpdateData={onUpdateNodeData}
                    onSetPrimaryImageResult={onSetPrimaryImageResult}
                    onPreview={onPreview}
                    resolvedInputs={resolvedInputsMap?.get(node.id)}
                    references={inputReferencesMap?.get(node.id) ?? []}
                    onRemoveInputReference={onRemoveInputReference}
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
                    detachedCanvasTitle
                    canvasZoom={zoom}
                    apiConfig={apiConfig}
                    onSelect={(e) => handleNodeSelect(node.id, e)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDuplicate={() => onDuplicateNode(node.id)}
                    onDragStart={(e, currentNode) => {
                      if (isLinkingOnCanvas) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNodeDragStart(e, currentNode);
                    }}
                    onUpdateProperty={onUpdateNodeProperty}
                    onUpdateData={onUpdateNodeData}
                    onSetPrimaryImageResult={onSetPrimaryImageResult}
                    onExtractFrameImage={onExtractFrameImage}
                    onReplaceFrameImage={onReplaceFrameImage}
                    onSyncImagePromptStarterLayout={onSyncImagePromptStarterLayout}
                    onSplitImageGrid={onSplitImageGrid}
                    onReplaceImageGridCell={onReplaceImageGridCell}
                    onDropImageToVideoBatchReplacement={onDropImageToVideoBatchReplacement}
                    onCreateBatchReplacement={onCreateVideoBatchReplacement}
                    onPreview={onPreview}
                    references={inputReferencesMap?.get(node.id) ?? []}
                    resolvedInputs={resolvedInputsMap?.get(node.id)}
                    onRemoveInputReference={onRemoveInputReference}
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
                    detachedCanvasTitle
                    canvasZoom={zoom}
                    apiConfig={apiConfig}
                    onSelect={(e) => handleNodeSelect(node.id, e)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDuplicate={() => onDuplicateNode(node.id)}
                    onDragStart={(e, currentNode) => {
                      if (isLinkingOnCanvas) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNodeDragStart(e, currentNode);
                    }}
                    onUpdateProperty={onUpdateNodeProperty}
                    onUpdateData={onUpdateNodeData}
                    onPreview={onPreview}
                    onAnalyzeVideo={onAnalyzeVideo}
                    onReverseVideoPrompt={onReverseVideoPrompt}
                    onCreateVideoFrameImage={onCreateVideoFrameImage}
                    onCompleteVideoFrameImage={onCompleteVideoFrameImage}
                    onFailVideoFrameImage={onFailVideoFrameImage}
                    references={inputReferencesMap?.get(node.id) ?? []}
                    resolvedInputs={resolvedInputsMap?.get(node.id)}
                    onRemoveInputReference={onRemoveInputReference}
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
                ) : node.type === "video_batch_replacement_node" ? (
                  <VideoBatchReplacementNodeCard
                    node={node}
                    selected={selectedNodeId === node.id}
                    apiConfig={apiConfig}
                    onSelect={(e) => handleNodeSelect(node.id, e)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDragStart={(e, currentNode) => {
                      if (isLinkingOnCanvas) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNodeDragStart(e, currentNode);
                    }}
                    onUpdateData={onUpdateNodeData}
                    onSubmit={onSubmitVideoBatchReplacement}
                    replacementModeOptions={videoBatchReplacementModeOptions}
                    resolutionPresetGroups={imageResolutionGroups}
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
                    detachedCanvasTitle
                    canvasZoom={zoom}
                    onSelect={(e) => handleNodeSelect(node.id, e)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDuplicate={() => onDuplicateNode(node.id)}
                    onDragStart={(e, currentNode) => {
                      if (isLinkingOnCanvas) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNodeDragStart(e, currentNode);
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
                    onSelect={(e) => handleNodeSelect(node.id, e)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDuplicate={() => onDuplicateNode(node.id)}
                    onDragStart={(e, currentNode) => {
                      if (isLinkingOnCanvas) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNodeDragStart(e, currentNode);
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
          if (
            [
              "text_node",
              "image_node",
              "video_node",
              "video_batch_replacement_node",
              "audio_node",
            ].includes(node.type)
          )
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
          if (
            [
              "text_node",
              "image_node",
              "video_node",
              "video_batch_replacement_node",
              "audio_node",
            ].includes(node.type)
          )
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
      <div className="pointer-events-none absolute inset-0 z-[21]">
        {visibleNodes.map((node) => (
          <React.Fragment key={`title_${node.id}`}>
            <DetachedMediaNodeTitle
              isLinkingOnCanvas={isLinkingOnCanvas}
              node={node}
              onDragStart={handleNodeDragStart}
              onSelect={handleNodeSelect}
              pan={pan}
              zoom={zoom}
            />
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
