import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import { getExecutor } from "../features/nodes/nodeExecutors";
import type { AiModelsByType } from "../features/api/aiModelCatalog";
import { WORKFLOW_TEMPLATES } from "../features/templates/workflowTemplates";
import { ExecutionLog, GraphLink, GraphNode, GroupBox, NodeClass } from "../types";
import type { VideoFrameCaptureItem } from "../features/video/frameCapture";
import {
  IMAGE_PROMPT_STARTER_GAP_X,
  getImagePromptStarterTextNodeX,
} from "../utils/imagePromptStarterLayout";
import {
  findFirstCompatibleInputIndex,
  getLinkDraftIssue,
  isDataTypeCompatible,
} from "../utils/linking";
import { applyNodePositionUpdates, type NodePositionUpdate } from "../utils/nodePositionUpdates";
import { buildCanvasGraphIndex, getGraphLinkKey } from "../utils/canvasGraphIndex";
import {
  getGroupBoundsForNodes,
  getNextGroupTitle,
  syncNodeGroupMembership,
} from "../utils/canvasGroups";
import {
  duplicateNodeAsSource,
  isSourceNode,
  markNodeAsSource,
  normalizeSourceNode,
} from "../utils/sourceNodes";
import {
  NodeOutputMap,
  buildResolvedInputsMap,
  pickBatchReplacementImageUrls,
  resolveNodeInputs,
  topologicalLevels,
} from "../runtime/dataflow";
import { createVideoFrameCaptureSnapshot } from "../utils/videoFrameCaptureLayout";
import { createVideoBatchReplacementSnapshot } from "../utils/videoBatchReplacementLayout";
import { createVideoPromptTextSnapshot } from "../utils/videoPromptTextLayout";
import { collectImageReferenceUrls, collectNodeInputReferences } from "../utils/textNodeReferences";
import { isLinkInputValueExcluded } from "../utils/inputReferenceExclusions";
import {
  createFrameImageChildSnapshot,
  replaceFrameImageFromChildSnapshot,
  replaceFrameImageUrlSnapshot,
} from "../utils/frameImageExtraction";
import {
  completeVideoFrameImageChildSnapshot,
  createVideoFrameImageChildSnapshot,
  failVideoFrameImageChildSnapshot,
  relayoutVideoFrameImageChildSnapshots,
  type VideoFrameImageCaptureMode,
} from "../utils/videoFrameImageExtraction";
import type {
  RemoteCanvasProject,
  RemoteCanvasWorkflowData,
} from "../features/workspace/remoteCanvas";
import type { RemoteVideoTaskResult } from "../features/video/remoteVideoGeneration";
import { queryRemoteVideoGenerationTask } from "../features/video/remoteVideoGeneration";
import type { BatchEditImagesTaskResult } from "../features/api/videoBatchReplacement";
import { queryBatchEditImagesTask } from "../features/api/videoBatchReplacement";
import {
  REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS,
  shouldDeferRemoteSnapshotForInFlight,
  shouldPersistRemoteSnapshot,
  type RemoteDirtyKind,
} from "../utils/remotePersistPolicy";

const HISTORY_LIMIT = 50;
const PERSIST_DEBOUNCE_MS = 800;
const DEFAULT_TEXT_REMOTE_MODEL = "qwen3.7-plus";
const DEFAULT_WORKFLOW_NAME = "默认项目";
const WORKSPACE_VERSION = 2 as const;
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 86_400_000;
const TRASH_PURGE_INTERVAL_MS = 60 * 60 * 1000;
const REMOTE_VIDEO_POLL_INTERVAL_MS = 10_000;
const VIDEO_BATCH_REPLACEMENT_RESULT_GAP_X = 160;
const VIDEO_BATCH_REPLACEMENT_RESULT_GAP_Y = 96;
const VIDEO_BATCH_REPLACEMENT_NODE_WIDTH = 520;
const DEFAULT_BATCH_RESULT_TILE_WIDTH = 220;
const DEFAULT_BATCH_RESULT_TILE_HEIGHT = 391;
const DEFAULT_BATCH_RESULT_COLUMNS = 5;
const BATCH_REPLACEMENT_FRAME_PLACEHOLDER = "__batch_replacement_frame_placeholder__";
const TEXT_NODE_REQUIRED_MEDIA_INPUTS = [
  { name: "source_image", type: "IMAGE" as const },
  { name: "source_video", type: "VIDEO" as const },
  { name: "source_audio", type: "AUDIO" as const },
];
const IMAGE_NODE_REQUIRED_INPUTS = [
  { name: "source_image", type: "IMAGE" as const },
  { name: "prompt", type: "STRING" as const },
  { name: "negative_prompt", type: "STRING" as const },
  { name: "aspect_ratio", type: "STRING" as const },
  { name: "source_audio", type: "AUDIO" as const },
  { name: "source_video", type: "VIDEO" as const },
];
const AUDIO_NODE_REQUIRED_INPUTS = [
  { name: "提示词", type: "STRING" as const },
  { name: "时长", type: "NUMBER" as const },
  { name: "source_image", type: "IMAGE" as const },
  { name: "source_video", type: "VIDEO" as const },
  { name: "source_audio", type: "AUDIO" as const },
];
const VIDEO_NODE_REQUIRED_INPUTS = [
  { name: "prompt", type: "STRING" as const },
  { name: "image", type: "IMAGE" as const },
  { name: "source_video", type: "VIDEO" as const },
  { name: "source_audio", type: "AUDIO" as const },
  { name: "duration", type: "NUMBER" as const },
  { name: "aspect_ratio", type: "STRING" as const },
];
const IMAGE_ASPECT_RATIOS = new Set(["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"]);
const IMAGE_NODE_MODEL_FALLBACKS = new Set(["", "lib-navo-pro", "flux-1", "sdxl", "midjourney"]);
const EMPTY_TEXT_MODEL_FALLBACKS = new Set([""]);
export const IMAGE_PROMPT_PLACEHOLDER_URL = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="864" viewBox="0 0 1152 864">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#111827"/>
      <stop offset="1" stop-color="#070b12"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="58%">
      <stop stop-color="#8b5cf6" stop-opacity=".32"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1152" height="864" rx="44" fill="url(#bg)"/>
  <rect width="1152" height="864" rx="44" fill="url(#glow)"/>
  <g fill="none" stroke="#c4b5fd" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" opacity=".76">
    <rect x="420" y="284" width="312" height="236" rx="28"/>
    <circle cx="512" cy="376" r="34"/>
    <path d="M444 488l92-92 66 66 42-42 64 68"/>
  </g>
</svg>
`)}`;
const IMAGE_PROMPT_DEFAULT_TEXT =
  "Generate a structured Chinese prompt from the image, including subject, environment, lighting, camera language, and style keywords.";
const IMAGE_PROMPT_STARTER_IMAGE_OFFSET_X = 680;
const IMAGE_PROMPT_STARTER_IMAGE_OFFSET_Y = 56;
export type TextNodeStarterFlowAction = "video" | "music";

const TEXT_NODE_STARTER_FLOW_CONFIG: Record<
  TextNodeStarterFlowAction,
  {
    nodeType: "video_node" | "audio_node";
    offsetX: number;
    offsetY: number;
    systemPrompt: string;
  }
> = {
  video: {
    nodeType: "video_node",
    offsetX: 560,
    offsetY: 0,
    systemPrompt:
      "你是视频生成提示词专家。请把用户的想法改写成适合视频生成的中文提示词，包含主体、场景、镜头运动、光线、节奏、画面风格和情绪氛围。",
  },
  music: {
    nodeType: "audio_node",
    offsetX: 560,
    offsetY: 0,
    systemPrompt:
      "你是音乐与音效提示词专家。请把用户的想法改写成适合音频生成的中文提示词，包含情绪、节奏、乐器、声场、氛围、时长和使用场景。",
  },
};

function getImagePromptStarterFocusBounds(
  textNode: GraphNode,
  imageNodeX: number,
  imageNodeY: number
) {
  return {
    minX: imageNodeX - 18,
    minY: Math.min(textNode.y - 18, imageNodeY - 24),
    maxX: textNode.x + 428,
    maxY: Math.max(textNode.y + 620, imageNodeY + 556),
  };
}

interface HistorySnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}

const NUMBERED_NODE_TITLE_PREFIX: Partial<Record<NodeClass, string>> = {
  text_node: "文本节点",
  image_node: "图片节点",
  video_node: "视频节点",
  audio_node: "音频节点",
};

function getNextNumberedNodeTitle(nodes: GraphNode[], type: NodeClass): string | null {
  const prefix = NUMBERED_NODE_TITLE_PREFIX[type];
  if (!prefix) return null;
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`);
  const max = nodes.reduce((currentMax, node) => {
    if (node.type !== type) return currentMax;
    const match = node.title.match(pattern);
    if (!match) return currentMax;
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return `${prefix} ${max + 1}`;
}

export function createTextNodeStarterFlowSnapshot({
  nodes,
  links,
  textNodeId,
  action,
  makeId: createId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  textNodeId: string;
  action: TextNodeStarterFlowAction;
  makeId: (prefix: string) => string;
}) {
  const textNode = nodes.find((node) => node.id === textNodeId && node.type === "text_node");
  const config = TEXT_NODE_STARTER_FLOW_CONFIG[action];
  if (!textNode || !config) return null;

  const createdNodeId = createId("node");
  const createdNode = createNodeFromType(
    config.nodeType,
    createdNodeId,
    textNode.x + config.offsetX,
    textNode.y + config.offsetY
  );
  createdNode.title = getNextNumberedNodeTitle(nodes, config.nodeType) || createdNode.title;

  const nextNodes = [
    ...nodes.map((node) =>
      node.id === textNodeId
        ? {
            ...node,
            properties: {
              ...node.properties,
              system_prompt:
                typeof node.properties.system_prompt === "string" &&
                node.properties.system_prompt.trim()
                  ? node.properties.system_prompt
                  : config.systemPrompt,
              textMode: "plain",
            },
            data: {
              ...(node.data || {}),
              forceInlineEditing: true,
            },
          }
        : node
    ),
    createdNode,
  ];

  const nextLinks = [
    ...links,
    {
      id: createId("link"),
      fromNodeId: textNodeId,
      fromOutputIndex: 0,
      toNodeId: createdNodeId,
      toInputIndex: 0,
    },
  ];

  return { nodes: nextNodes, links: nextLinks, createdNodeId, textNodeId };
}

export type UploadedAssetKind = "image" | "video" | "audio";

export function markUploadedAssetNodeAsSource(
  node: GraphNode,
  assetKind: UploadedAssetKind,
  assetUrl: string,
  ossId?: string
): GraphNode {
  const propertyKey =
    assetKind === "image" ? "imageUrl" : assetKind === "video" ? "videoUrl" : "audioUrl";
  return markNodeAsSource(node, { [propertyKey]: assetUrl, ossId });
}

export function updateNodePropertySnapshot(
  nodes: GraphNode[],
  nodeId: string,
  key: string,
  value: unknown
): GraphNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const nextNode = {
      ...node,
      properties: { ...node.properties, [key]: value },
    };
    if (node.type === "text_node" && key === "textMode" && value === "plain") {
      return {
        ...nextNode,
        inputs: [],
      };
    }
    return nextNode;
  });
}

export function updateNodeDataSnapshot(
  nodes: GraphNode[],
  nodeId: string,
  data: Partial<GraphNode["data"]>
): GraphNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const shouldClearLoadingProperty =
      data.loading === false ||
      data.status === "success" ||
      data.status === "error" ||
      data.status === "idle";
    const nextProperties =
      shouldClearLoadingProperty && node.properties.status === "loading"
        ? Object.fromEntries(Object.entries(node.properties).filter(([key]) => key !== "status"))
        : node.properties;
    const nextNode = {
      ...node,
      properties: nextProperties,
      data: { ...(node.data || {}), ...data },
    };
    return data.isSourceNode === true ? markNodeAsSource(nextNode) : nextNode;
  });
}

function writeImageNodeBatchReplacementPreview(node: GraphNode, imageUrls: string[]): GraphNode {
  const primaryImageUrl = imageUrls[0] ?? "";
  const nextData = {
    ...(node.data || {}),
    imageUrl: primaryImageUrl,
    imageUrls,
    activeImageIndex: Math.min(
      typeof node.data?.activeImageIndex === "number" ? node.data.activeImageIndex : 0,
      Math.max(0, imageUrls.length - 1)
    ),
  };
  return {
    ...node,
    properties: {
      ...node.properties,
      imageUrl: primaryImageUrl,
      imageUrls,
    },
    data: nextData,
  };
}

export function syncVideoBatchReplacementTargetsSnapshot({
  batchNodeId,
  links,
  nodeOutputs,
  nodes,
}: {
  batchNodeId: string;
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
}): { links: GraphLink[]; nodeOutputs: NodeOutputMap; nodes: GraphNode[] } {
  const batchNode = nodes.find(
    (node) => node.id === batchNodeId && node.type === "video_batch_replacement_node"
  );
  if (!batchNode) return { links, nodeOutputs, nodes };

  const imageUrls = pickBatchReplacementImageUrls(batchNode.data?.batchReplacementSlots) ?? [];
  const downstreamImageNodeIds = new Set(
    links
      .filter((link) => link.fromNodeId === batchNodeId)
      .map((link) => nodes.find((node) => node.id === link.toNodeId))
      .filter(
        (node): node is GraphNode =>
          node?.type === "image_node" && typeof node.data?.batchReplacementRunId !== "string"
      )
      .map((node) => node.id)
  );

  if (downstreamImageNodeIds.size === 0) {
    return { links, nodeOutputs, nodes };
  }

  const nextLinks =
    imageUrls.length > 0
      ? links
      : links.filter(
          (link) => !(link.fromNodeId === batchNodeId && downstreamImageNodeIds.has(link.toNodeId))
        );
  const nextNodes =
    imageUrls.length > 0
      ? nodes.map((node) =>
          downstreamImageNodeIds.has(node.id)
            ? writeImageNodeBatchReplacementPreview(node, imageUrls)
            : node
        )
      : nodes.map((node) =>
          downstreamImageNodeIds.has(node.id)
            ? writeImageNodeBatchReplacementPreview(node, [])
            : node
        );

  const nextNodeOutputs = new Map(nodeOutputs);
  downstreamImageNodeIds.forEach((nodeId) => {
    if (imageUrls.length > 0) {
      nextNodeOutputs.set(
        nodeId,
        new Map([[0, imageUrls.length === 1 ? imageUrls[0] : imageUrls]])
      );
    } else {
      nextNodeOutputs.delete(nodeId);
    }
  });

  return { links: nextLinks, nodeOutputs: nextNodeOutputs, nodes: nextNodes };
}

function getWorkflowNodeWidth(node: GraphNode) {
  const width =
    node.data?.imageNodeWidth ??
    node.data?.videoNodeWidth ??
    node.data?.imageDisplayWidth ??
    node.data?.videoDisplayWidth ??
    (node.type === "video_batch_replacement_node"
      ? VIDEO_BATCH_REPLACEMENT_NODE_WIDTH
      : DEFAULT_BATCH_RESULT_TILE_WIDTH);
  return typeof width === "number" && Number.isFinite(width) && width > 0
    ? width
    : DEFAULT_BATCH_RESULT_TILE_WIDTH;
}

function getWorkflowNodeHeight(node: GraphNode) {
  const height =
    node.data?.imageNodeHeight ??
    node.data?.videoNodeHeight ??
    node.data?.imageDisplayHeight ??
    node.data?.videoDisplayHeight ??
    DEFAULT_BATCH_RESULT_TILE_HEIGHT;
  return typeof height === "number" && Number.isFinite(height) && height > 0
    ? height
    : DEFAULT_BATCH_RESULT_TILE_HEIGHT;
}

function getBatchReplacementResultItemImage(item: BatchEditImagesTaskResult["items"][number]) {
  const frameImage = Array.isArray(item.frame_images) ? item.frame_images[0] : undefined;
  const url = firstNonEmptyString(item.url, frameImage?.url, item.video);
  const ossId = firstNonEmptyString(item.ossId, frameImage?.ossId);
  return { ossId, url };
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return String(value);
  }
  return "";
}

function getBatchReplacementItemIndex(
  item: BatchEditImagesTaskResult["items"][number],
  fallbackIndex: number
) {
  return typeof item.index === "number" && Number.isFinite(item.index) && item.index >= 0
    ? Math.trunc(item.index)
    : fallbackIndex;
}

function positiveRoundedNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function getBatchReplacementResultLayout(
  nodes: GraphNode[],
  batchNode: GraphNode,
  frameAnalysisNode: GraphNode,
  frameCount: number
) {
  const visibleFrameCount = Math.max(
    frameCount,
    Array.isArray(frameAnalysisNode.data?.imageUrls) ? frameAnalysisNode.data.imageUrls.length : 0,
    Array.isArray(frameAnalysisNode.data?.frameImageOssIds)
      ? frameAnalysisNode.data.frameImageOssIds.length
      : 0
  );
  const sourceColumns = positiveRoundedNumber(
    frameAnalysisNode.data?.frameGridColumns,
    DEFAULT_BATCH_RESULT_COLUMNS
  );
  const shouldNormalizeStaleSingleColumn =
    frameCount > 1 && visibleFrameCount > 1 && sourceColumns <= 1;
  const columns = shouldNormalizeStaleSingleColumn
    ? Math.max(1, Math.min(frameCount, DEFAULT_BATCH_RESULT_COLUMNS))
    : Math.max(1, Math.min(frameCount, sourceColumns));
  const rows = positiveRoundedNumber(
    frameAnalysisNode.data?.frameGridRows,
    Math.max(1, Math.ceil(frameCount / columns))
  );
  const normalizedRows = shouldNormalizeStaleSingleColumn
    ? Math.max(1, Math.ceil(frameCount / columns))
    : rows;
  const sourceDisplayWidth = positiveRoundedNumber(frameAnalysisNode.data?.imageDisplayWidth, 0);
  const sourceDisplayHeight = positiveRoundedNumber(frameAnalysisNode.data?.imageDisplayHeight, 0);
  const tileWidth = positiveRoundedNumber(
    frameAnalysisNode.data?.frameTileWidth,
    sourceDisplayWidth > 0 ? Math.max(1, Math.round(sourceDisplayWidth / columns)) : DEFAULT_BATCH_RESULT_TILE_WIDTH
  );
  const tileHeight = positiveRoundedNumber(
    frameAnalysisNode.data?.frameTileHeight,
    sourceDisplayHeight > 0
      ? Math.max(1, Math.round(sourceDisplayHeight / normalizedRows))
      : DEFAULT_BATCH_RESULT_TILE_HEIGHT
  );
  const displayWidth = shouldNormalizeStaleSingleColumn
    ? columns * tileWidth
    : sourceDisplayWidth > 0
      ? sourceDisplayWidth
      : columns * tileWidth;
  const displayHeight = shouldNormalizeStaleSingleColumn
    ? normalizedRows * tileHeight
    : sourceDisplayHeight > 0
      ? sourceDisplayHeight
      : normalizedRows * tileHeight;
  const nodeWidth = shouldNormalizeStaleSingleColumn
    ? displayWidth
    : positiveRoundedNumber(frameAnalysisNode.data?.imageNodeWidth, displayWidth);
  const nodeHeight = shouldNormalizeStaleSingleColumn
    ? displayHeight + 30
    : positiveRoundedNumber(frameAnalysisNode.data?.imageNodeHeight, displayHeight + 30);
  const portCenterY = shouldNormalizeStaleSingleColumn
    ? nodeHeight / 2
    : positiveRoundedNumber(frameAnalysisNode.data?.imagePortCenterY, nodeHeight / 2);
  const existingResultNodes = nodes.filter(
    (node) =>
      node.type === "image_node" && node.data?.batchReplacementSourceNodeId === batchNode.id
  );
  const baseY =
    existingResultNodes.length > 0
      ? Math.max(...existingResultNodes.map((node) => node.y + getWorkflowNodeHeight(node))) +
        VIDEO_BATCH_REPLACEMENT_RESULT_GAP_Y
      : frameAnalysisNode.y;

  return {
    columns,
    displayHeight,
    displayWidth,
    nodeHeight,
    nodeWidth,
    portCenterY,
    rows: normalizedRows,
    startX:
      batchNode.x + getWorkflowNodeWidth(batchNode) + VIDEO_BATCH_REPLACEMENT_RESULT_GAP_X,
    startY: baseY,
    tileHeight,
    tileWidth,
  };
}

export function createBatchEditImagesResultRunSnapshot({
  batchNodeId,
  frameAnalysisNodeId,
  frameCount,
  links,
  makeId,
  nodeOutputs,
  nodes,
  result,
  runId,
}: {
  batchNodeId: string;
  frameAnalysisNodeId: string;
  frameCount: number;
  links: GraphLink[];
  makeId: (prefix: string) => string;
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
  result?: BatchEditImagesTaskResult;
  runId: string;
}): { createdNodeIds: string[]; links: GraphLink[]; nodeOutputs: NodeOutputMap; nodes: GraphNode[] } {
  const batchNode = nodes.find(
    (node) => node.id === batchNodeId && node.type === "video_batch_replacement_node"
  );
  const frameAnalysisNode = nodes.find(
    (node) => node.id === frameAnalysisNodeId && node.type === "image_node"
  );
  const count = Math.max(0, Math.trunc(frameCount));
  if (!batchNode || !frameAnalysisNode || !runId.trim() || count <= 0) {
    return { createdNodeIds: [], links, nodeOutputs, nodes };
  }

  const existingRunNodes = nodes.filter(
    (node) => node.type === "image_node" && node.data?.batchReplacementRunId === runId
  );
  if (existingRunNodes.length > 0) {
    const synced = result
      ? applyBatchEditImagesResultNodesSnapshot({
          batchNodeId,
          nodeOutputs,
          nodes,
          result,
          runId,
        })
      : { nodeOutputs, nodes };
    return {
      createdNodeIds: existingRunNodes.map((node) => node.id),
      links,
      nodeOutputs: synced.nodeOutputs,
      nodes: synced.nodes,
    };
  }

  const layout = getBatchReplacementResultLayout(nodes, batchNode, frameAnalysisNode, count);
  const nextOutputs = new Map(nodeOutputs);
  const nodeId = makeId("node");
  const imageNode = createNodeFromType("image_node", nodeId, layout.startX, layout.startY);
  const runNumber =
    nodes.filter(
      (node) =>
        node.type === "image_node" && node.data?.batchReplacementSourceNodeId === batchNodeId
    ).length + 1;
  imageNode.title = `批量替换结果 ${runNumber}`;
  imageNode.properties = {
    ...imageNode.properties,
    imageUrl: "",
    text: "",
  };
  imageNode.data = {
    ...(imageNode.data || {}),
    activeImageIndex: 0,
    batchReplacementStartedAt: Date.now(),
    batchReplacementFinishedAt: undefined,
    batchReplacementAspectRatio:
      typeof batchNode.data?.batchReplacementAspectRatio === "string"
        ? batchNode.data.batchReplacementAspectRatio
        : undefined,
    batchReplacementResultCount: count,
    batchReplacementRunId: runId,
    batchReplacementSourceNodeId: batchNodeId,
    frameAnalysisSourceNodeId: frameAnalysisNodeId,
    frameCaptureSourceNodeId:
      typeof frameAnalysisNode.data?.frameCaptureSourceNodeId === "string"
        ? frameAnalysisNode.data.frameCaptureSourceNodeId
        : "",
    frameGridColumns: layout.columns,
    frameGridRows: layout.rows,
    frameTileHeight: layout.tileHeight,
    frameTileWidth: layout.tileWidth,
    imageDisplayHeight: layout.displayHeight,
    imageDisplayWidth: layout.displayWidth,
    imageNodeHeight: layout.nodeHeight,
    imageNodeWidth: layout.nodeWidth,
    imagePortCenterY: layout.portCenterY,
    imageUrl: "",
    imageUrls: Array.from({ length: count }, () => BATCH_REPLACEMENT_FRAME_PLACEHOLDER),
    isFrameStrip: true,
    loading: true,
    loadingOperation: "batch-replacement",
    status: "loading",
  };
  const nextNodes = [...nodes, imageNode];
  const nextLinks = [
    ...links,
    {
      id: makeId("link"),
      fromNodeId: batchNodeId,
      fromOutputIndex: 0,
      toNodeId: nodeId,
      toInputIndex: 0,
    },
  ];
  const synced = result
    ? applyBatchEditImagesResultNodesSnapshot({
        batchNodeId,
        nodeOutputs: nextOutputs,
        nodes: nextNodes,
        result,
        runId,
      })
    : { nodeOutputs: nextOutputs, nodes: nextNodes };

  return {
    createdNodeIds: [nodeId],
    links: nextLinks,
    nodeOutputs: synced.nodeOutputs,
    nodes: synced.nodes,
  };
}

export function applyBatchEditImagesResultNodesSnapshot({
  batchNodeId,
  nodeOutputs,
  nodes,
  result,
  runId,
}: {
  batchNodeId: string;
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
  result: BatchEditImagesTaskResult;
  runId: string;
}): { nodeOutputs: NodeOutputMap; nodes: GraphNode[] } {
  const runNode = nodes.find(
    (node) =>
      node.type === "image_node" &&
      node.data?.batchReplacementSourceNodeId === batchNodeId &&
      node.data?.batchReplacementRunId === runId
  );
  if (!runNode) return { nodeOutputs, nodes };

  const itemByIndex = new Map<number, BatchEditImagesTaskResult["items"][number]>();
  result.items.forEach((item, fallbackIndex) => {
    itemByIndex.set(getBatchReplacementItemIndex(item, fallbackIndex), item);
  });
  const frameCount = Math.max(
    0,
    Math.trunc(
      typeof runNode.data?.batchReplacementResultCount === "number"
        ? runNode.data.batchReplacementResultCount
        : Math.max(result.items.length, 1)
    )
  );
  const urls = Array.from({ length: frameCount }, (_, index) => {
    const item = itemByIndex.get(index);
    const image = item ? getBatchReplacementResultItemImage(item) : { ossId: "", url: "" };
    return image.url || BATCH_REPLACEMENT_FRAME_PLACEHOLDER;
  });
  const ossIds = Array.from({ length: frameCount }, (_, index) => {
    const item = itemByIndex.get(index);
    const image = item ? getBatchReplacementResultItemImage(item) : { ossId: "", url: "" };
    return image.ossId;
  });
  const realUrls = urls.filter((url) => url !== BATCH_REPLACEMENT_FRAME_PLACEHOLDER);
  const primaryUrl = realUrls[0] ?? "";
  const isComplete = result.status === "success";
  const nextOutputs = new Map(nodeOutputs);
  if (realUrls.length > 0) {
    nextOutputs.set(runNode.id, new Map([[0, realUrls.length === 1 ? realUrls[0] : realUrls]]));
  } else {
    nextOutputs.delete(runNode.id);
  }

  const nextNodes = nodes.map((node) => {
    if (
      node.type !== "image_node" ||
      node.data?.batchReplacementSourceNodeId !== batchNodeId ||
      node.data?.batchReplacementRunId !== runId
    ) {
      return node;
    }

    return {
      ...node,
      properties: {
        ...node.properties,
        imageUrl: primaryUrl,
        imageUrls: realUrls,
        status: isComplete ? "success" : "loading",
      },
      data: {
        ...(node.data || {}),
        activeImageIndex: 0,
        frameImageOssIds: ossIds,
        imageUrl: primaryUrl,
        imageUrls: urls,
        batchReplacementFinishedAt: isComplete ? Date.now() : undefined,
        loading: !isComplete,
        loadingOperation: isComplete ? undefined : ("batch-replacement" as const),
        status: isComplete ? "success" : "loading",
      },
    };
  });

  return { nodeOutputs: nextOutputs, nodes: nextNodes };
}

export interface WorkflowSummary {
  id: string;
  name: string;
  category?: string;
  tags: string[];
  sortIndex: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export type SerializedNodeOutput = [string, [number, unknown][]];

export interface WorkflowData {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: SerializedNodeOutput[];
  groups?: import("../types").GroupBox[];
}

export interface Workflow {
  summary: WorkflowSummary;
  data: WorkflowData;
}

export interface Workspace {
  version: typeof WORKSPACE_VERSION;
  currentId: string;
  workflows: Record<string, Workflow>;
  trash: Workflow[];
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export interface AddNodeToWorkflowSnapshotOptions {
  nodes: GraphNode[];
  links: GraphLink[];
  type: NodeClass;
  x?: number;
  y?: number;
  initialProps?: Record<string, unknown>;
  connectFromDraft?: { fromNodeId: string; fromOutputIndex: number; toInputIndex?: number };
  makeId?: (prefix: string) => string;
}

export interface AddNodeToWorkflowSnapshotResult {
  id: string;
  node: GraphNode;
  nodes: GraphNode[];
  links: GraphLink[];
  warning?: string;
}

export function addNodeToWorkflowSnapshot({
  nodes,
  links,
  type,
  x,
  y,
  initialProps,
  connectFromDraft,
  makeId: makeSnapshotId = makeId,
}: AddNodeToWorkflowSnapshotOptions): AddNodeToWorkflowSnapshotResult {
  const id = makeSnapshotId("node");
  const nextX = x ?? 80 + (nodes.length % 4) * 280;
  const nextY = y ?? 120 + Math.floor(nodes.length / 4) * 180;
  const node = createNodeFromType(type, id, nextX, nextY);
  node.title = getNextNumberedNodeTitle(nodes, type) || node.title;

  if (initialProps) {
    const {
      __nodeTitle,
      __nodeData,
      __uploadedAssetUrl,
      __uploadedAssetKind,
      __uploadedAssetName,
      __uploadedOssId,
      ...restProps
    } = initialProps;
    node.properties = { ...node.properties, ...restProps };
    if (typeof __nodeTitle === "string" && __nodeTitle.trim()) {
      node.title = __nodeTitle.trim();
    }
    if (__uploadedAssetKind === "image" && typeof __uploadedAssetUrl === "string") {
      Object.assign(
        node,
        markUploadedAssetNodeAsSource(
          node,
          "image",
          __uploadedAssetUrl,
          typeof __uploadedOssId === "string" ? __uploadedOssId : undefined
        )
      );
      if (typeof __uploadedAssetName === "string" && __uploadedAssetName.trim()) {
        node.title = getNextNumberedNodeTitle(nodes, "image_node") || node.title;
      }
    }
    if (__uploadedAssetKind === "video" && typeof __uploadedAssetUrl === "string") {
      Object.assign(
        node,
        markUploadedAssetNodeAsSource(
          node,
          "video",
          __uploadedAssetUrl,
          typeof __uploadedOssId === "string" ? __uploadedOssId : undefined
        )
      );
      if (typeof __uploadedAssetName === "string" && __uploadedAssetName.trim()) {
        node.title = getNextNumberedNodeTitle(nodes, "video_node") || node.title;
      }
    }
    if (__uploadedAssetKind === "audio" && typeof __uploadedAssetUrl === "string") {
      Object.assign(
        node,
        markUploadedAssetNodeAsSource(
          node,
          "audio",
          __uploadedAssetUrl,
          typeof __uploadedOssId === "string" ? __uploadedOssId : undefined
        )
      );
      if (typeof __uploadedAssetName === "string" && __uploadedAssetName.trim()) {
        node.title = getNextNumberedNodeTitle(nodes, "audio_node") || node.title;
      }
    }
    if (__nodeData && typeof __nodeData === "object" && !Array.isArray(__nodeData)) {
      node.data = { ...(node.data || {}), ...(__nodeData as GraphNode["data"]) };
    }
    if (
      __uploadedAssetKind === "image" ||
      __uploadedAssetKind === "video" ||
      __uploadedAssetKind === "audio"
    ) {
      Object.assign(node, markNodeAsSource(node));
    }
  }

  const nextNodes = [...nodes, node];
  let nextLinks = links;
  let warning: string | undefined;

  if (connectFromDraft) {
    const fromNodeCandidate = nextNodes.find((n) => n.id === connectFromDraft.fromNodeId);
    const toNodeCandidate = node;
    const requestedInputIndex = connectFromDraft.toInputIndex ?? 0;
    const fromOutput = fromNodeCandidate?.outputs[connectFromDraft.fromOutputIndex];
    const requestedInput = toNodeCandidate.inputs[requestedInputIndex];
    const normalizedInputIndex =
      fromNodeCandidate &&
      fromOutput &&
      (!requestedInput || !isDataTypeCompatible(fromOutput.type, requestedInput.type))
        ? findFirstCompatibleInputIndex(
            fromNodeCandidate,
            toNodeCandidate,
            connectFromDraft.fromOutputIndex
          )
        : requestedInputIndex;
    const normalizedDraft = {
      fromNodeId: connectFromDraft.fromNodeId,
      fromOutputIndex: connectFromDraft.fromOutputIndex,
      toNodeId: id,
      toInputIndex: normalizedInputIndex,
    };
    const issue = getLinkDraftIssue({ ...normalizedDraft, nodes: nextNodes, links });
    if (issue) {
      warning = issue;
    } else {
      nextLinks = [
        ...links,
        {
          id: makeSnapshotId("link"),
          fromNodeId: normalizedDraft.fromNodeId,
          fromOutputIndex: normalizedDraft.fromOutputIndex,
          toNodeId: normalizedDraft.toNodeId,
          toInputIndex: normalizedDraft.toInputIndex,
        },
      ];
    }
  }

  return { id, node, nodes: nextNodes, links: nextLinks, warning };
}

function makeLog(type: ExecutionLog["type"], message: string): ExecutionLog {
  return {
    id: makeId("log"),
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
  };
}

function makeEmptyWorkflow(name = DEFAULT_WORKFLOW_NAME): Workflow {
  const id = makeId("wf");
  const now = Date.now();
  return {
    summary: { id, name, tags: [], sortIndex: now, createdAt: now, updatedAt: now },
    data: { nodes: [], links: [], nodeOutputs: [] },
  };
}

function makeWorkspace(initialName?: string): Workspace {
  const wf = makeEmptyWorkflow(initialName);
  return {
    version: WORKSPACE_VERSION,
    currentId: wf.summary.id,
    workflows: { [wf.summary.id]: wf },
    trash: [],
  };
}

function buildWorkspaceFromRemoteProject(project: RemoteCanvasProject): Workspace {
  const workflow: Workflow = {
    summary: {
      id: project.id,
      name: project.name,
      category: project.category,
      tags: project.tags,
      sortIndex: project.updatedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    data: {
      nodes: project.workflow.nodes,
      links: project.workflow.links,
      nodeOutputs: project.workflow.nodeOutputs,
      groups: project.workflow.groups,
    },
  };

  return {
    version: WORKSPACE_VERSION,
    currentId: project.id,
    workflows: {
      [project.id]: workflow,
    },
    trash: [],
  };
}

function buildRemoteProjectSnapshot(
  summary: WorkflowSummary,
  data: RemoteCanvasWorkflowData
): RemoteCanvasProject {
  return {
    id: summary.id,
    name: summary.name,
    coverUrl: "",
    category: summary.category,
    tags: summary.tags ?? [],
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    nodeCount: data.nodes.length,
    workflow: data,
  };
}

function serializeWorkflowDataForComparison(data: RemoteCanvasWorkflowData) {
  return JSON.stringify({
    nodes: data.nodes,
    links: data.links,
    nodeOutputs: data.nodeOutputs,
    groups: data.groups ?? [],
  });
}

export function serializeRemotePersistSnapshot(snapshot: {
  workflowId: string;
  name: string;
  category?: string;
  tags: string[];
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  groups: GroupBox[];
}) {
  return JSON.stringify({
    workflowId: snapshot.workflowId,
    name: snapshot.name,
    category: snapshot.category || "",
    tags: snapshot.tags,
    workflow: {
      nodes: sanitizeNodesRuntimeState(snapshot.nodes),
      links: snapshot.links,
      nodeOutputs: mapToOutputs(snapshot.nodeOutputs),
      groups: snapshot.groups,
    },
  });
}

export function isRemoteWorkflowEcho(
  remoteProject: RemoteCanvasProject,
  current: {
    workflowId: string;
    nodes: GraphNode[];
    links: GraphLink[];
    nodeOutputs: NodeOutputMap;
    groups: import("../types").GroupBox[];
  }
) {
  if (remoteProject.id !== current.workflowId) return false;
  return (
    serializeWorkflowDataForComparison(remoteProject.workflow) ===
    serializeWorkflowDataForComparison({
      nodes: sanitizeNodesRuntimeState(current.nodes),
      links: current.links,
      nodeOutputs: mapToOutputs(current.nodeOutputs),
      groups: current.groups,
    })
  );
}

export function shouldApplyRemoteWorkflowSnapshot({
  incomingRemotePersistSignature,
  pendingLocalPersistSignature,
}: {
  incomingRemotePersistSignature: string;
  pendingLocalPersistSignature: string;
}): boolean {
  return (
    !pendingLocalPersistSignature || incomingRemotePersistSignature === pendingLocalPersistSignature
  );
}

function outputsToMap(arr: SerializedNodeOutput[]): NodeOutputMap {
  const m = new Map<string, Map<number, unknown>>();
  for (const [k, pairs] of arr) {
    const inner = new Map<number, unknown>();
    for (const [idx, val] of pairs) {
      inner.set(idx, val);
    }
    m.set(k, inner);
  }
  return m;
}

function mapToOutputs(map: NodeOutputMap): SerializedNodeOutput[] {
  return Array.from(map.entries()).map(([k, v]) => [k, Array.from(v.entries())]);
}

export function hasNodeRuntimeState(node: GraphNode): boolean {
  const data = node.data || {};
  return (
    data.loading === true ||
    data.status === "loading" ||
    data.status === "uploading" ||
    data.uploadingAsset === true ||
    node.properties.status === "loading"
  );
}

export function isPendingRemoteVideoNode(node: GraphNode): boolean {
  const data = node.data || {};
  return (
    node.type === "video_node" &&
    typeof data.remoteVideoTaskId === "string" &&
    data.remoteVideoTaskId.trim().length > 0 &&
    !(typeof data.videoUrl === "string" && data.videoUrl.trim()) &&
    !(typeof node.properties.videoUrl === "string" && node.properties.videoUrl.trim())
  );
}

export function isPendingBatchEditImagesNode(node: GraphNode): boolean {
  const data = node.data || {};
  return (
    node.type === "video_batch_replacement_node" &&
    typeof data.batchReplacementTaskId === "string" &&
    data.batchReplacementTaskId.trim().length > 0 &&
    data.loading === true &&
    data.loadingOperation === "batch-replacement" &&
    data.status !== "success" &&
    data.status !== "error"
  );
}

export function sanitizeNodeRuntimeState(node: GraphNode): GraphNode {
  const data = node.data || {};
  if (!hasNodeRuntimeState(node)) return node;
  if (isPendingRemoteVideoNode(node)) return node;
  if (isPendingBatchEditImagesNode(node)) return node;

  const {
    loading: _loading,
    loadingOperation: _loadingOperation,
    progress: _progress,
    uploadingAsset: _uploadingAsset,
    ...restData
  } = data;
  const { status: propertyStatus, ...restProperties } = node.properties;

  return {
    ...node,
    properties: propertyStatus === "loading" ? restProperties : node.properties,
    data: {
      ...restData,
      loading: false,
      status:
        data.status === "loading" || data.status === "uploading" || propertyStatus === "loading"
          ? "idle"
          : typeof data.status === "string"
            ? data.status
            : undefined,
    },
  };
}

function sanitizeNodesRuntimeState(nodes: GraphNode[]): GraphNode[] {
  return nodes.map(sanitizeNodeRuntimeState);
}

export function applyPendingRemoteVideoTaskSnapshot({
  nodes,
  nodeId,
  patch,
}: {
  nodes: GraphNode[];
  nodeId: string;
  patch: Partial<GraphNode["data"]>;
}) {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "video_node") return node;
    return {
      ...node,
      properties: {
        ...node.properties,
        status: "loading",
      },
      data: {
        ...(node.data || {}),
        loading: true,
        loadingOperation: "generate",
        status: "loading",
        ...patch,
      },
    };
  });
}

export function applyRemoteVideoTaskResultSnapshot({
  nodes,
  nodeOutputs,
  nodeId,
  taskId,
  result,
}: {
  nodes: GraphNode[];
  nodeOutputs: NodeOutputMap;
  nodeId: string;
  taskId: string;
  result: RemoteVideoTaskResult;
}) {
  const nextOutputs = new Map(nodeOutputs);
  const nextNodes = nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "video_node") return node;
    if (node.data?.remoteVideoTaskId !== taskId) return node;

    if (result.status === "success") {
      nextOutputs.set(nodeId, new Map([[0, result.videoUrl]]));
      return {
        ...node,
        properties: {
          ...node.properties,
          videoUrl: result.videoUrl,
          status: "success",
        },
        data: {
          ...(node.data || {}),
          videoUrl: result.videoUrl,
          loading: false,
          loadingOperation: undefined,
          status: "success",
          error: undefined,
          remoteVideoTaskStatus: result.rawStatus || "success",
          remoteVideoTaskError: undefined,
        },
      };
    }

    if (result.status === "error") {
      return {
        ...node,
        properties: {
          ...node.properties,
          status: "error",
        },
        data: {
          ...(node.data || {}),
          loading: false,
          loadingOperation: undefined,
          status: "error",
          error: result.error || "视频生成任务失败",
          remoteVideoTaskStatus: result.rawStatus || "error",
          remoteVideoTaskError: result.error || "视频生成任务失败",
        },
      };
    }

    return {
      ...node,
      properties: {
        ...node.properties,
        status: "loading",
      },
      data: {
        ...(node.data || {}),
        loading: true,
        loadingOperation: "generate",
        status: "loading",
        remoteVideoTaskStatus: result.rawStatus || "pending",
      },
    };
  });

  return { nodes: nextNodes, nodeOutputs: nextOutputs };
}

export function applyPendingBatchEditImagesTaskSnapshot({
  nodes,
  nodeId,
  patch,
}: {
  nodes: GraphNode[];
  nodeId: string;
  patch: Partial<GraphNode["data"]>;
}) {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "video_batch_replacement_node") return node;
    return {
      ...node,
      properties: {
        ...node.properties,
        status: "loading",
      },
      data: {
        ...(node.data || {}),
        batchReplacementStartedAt:
          typeof node.data?.batchReplacementStartedAt === "number"
            ? node.data.batchReplacementStartedAt
            : Date.now(),
        batchReplacementFinishedAt: undefined,
        loading: true,
        loadingOperation: "batch-replacement",
        status: "loading",
        ...patch,
      },
    };
  });
}

export function applyBatchEditImagesTaskResultSnapshot({
  nodes,
  nodeId,
  taskId,
  result,
}: {
  nodes: GraphNode[];
  nodeId: string;
  taskId: string;
  result: BatchEditImagesTaskResult;
}) {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "video_batch_replacement_node") return node;
    if (node.data?.batchReplacementTaskId !== taskId) return node;

    if (result.status === "success") {
      return {
        ...node,
        properties: {
          ...node.properties,
          status: "success",
        },
        data: {
          ...(node.data || {}),
          batchReplacementResult: result.items,
          batchReplacementFinishedAt: Date.now(),
          loading: false,
          loadingOperation: undefined,
          status: "success",
          error: undefined,
          batchReplacementTaskStatus: result.rawStatus || "success",
          batchReplacementTaskError: undefined,
        },
      };
    }

    if (result.status === "error") {
      return {
        ...node,
        properties: {
          ...node.properties,
          status: "error",
        },
        data: {
          ...(node.data || {}),
          loading: false,
          loadingOperation: undefined,
          batchReplacementFinishedAt: Date.now(),
          status: "error",
          error: result.error || "Batch replacement task failed",
          batchReplacementTaskStatus: result.rawStatus || "error",
          batchReplacementTaskError: result.error || "Batch replacement task failed",
        },
      };
    }

    return {
      ...node,
      properties: {
        ...node.properties,
        status: "loading",
      },
      data: {
        ...(node.data || {}),
        loading: true,
        loadingOperation: "batch-replacement" as const,
        status: "loading",
        batchReplacementTaskStatus: result.rawStatus || "pending",
      },
    };
  });
}

function normalizeOssIdValue(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "bigint") return String(value);
  return "";
}

function collectOssIdsFromValue(value: unknown, seen = new Set<unknown>()): string[] {
  const single = normalizeOssIdValue(value);
  if (single) return [single];
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectOssIdsFromValue(item, seen));
  const record = value as Record<string, unknown>;
  return [
    ...collectOssIdsFromValue(record.ossId, seen),
    ...collectOssIdsFromValue(record.ossIds, seen),
    ...collectOssIdsFromValue(record.data, seen),
    ...collectOssIdsFromValue(record.result, seen),
    ...collectOssIdsFromValue(record.results, seen),
    ...collectOssIdsFromValue(record.outputs, seen),
  ];
}

function collectOssIdsFromObjectFields(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const ids: string[] = [];
  const visit = (candidate: unknown, seen = new Set<unknown>()) => {
    if (!candidate || typeof candidate !== "object") return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, seen));
      return;
    }
    const record = candidate as Record<string, unknown>;
    collectOssIdsFromValue(record.ossId).forEach((id) => addUniqueString(ids, id));
    collectOssIdsFromValue(record.ossIds).forEach((id) => addUniqueString(ids, id));
    visit(record.data, seen);
    visit(record.result, seen);
    visit(record.results, seen);
    visit(record.outputs, seen);
  };
  visit(value);
  return ids;
}

function addUniqueString(target: string[], value: string) {
  if (value && !target.includes(value)) target.push(value);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function addVisibleFrameStripOssIds({
  imageUrls,
  link,
  ossIds,
  sourceNode,
}: {
  imageUrls: string[];
  link: GraphLink;
  ossIds: string[];
  sourceNode: GraphNode;
}) {
  const frameUrls = normalizeStringList(sourceNode.data?.imageUrls);
  const frameOssIds = normalizeStringList(sourceNode.data?.frameImageOssIds);
  if (frameUrls.length === 0 || frameOssIds.length === 0) return false;

  frameUrls.forEach((imageUrl, index) => {
    if (isLinkInputValueExcluded(link, imageUrl)) return;
    addUniqueString(imageUrls, imageUrl);
    addUniqueString(ossIds, frameOssIds[index] || "");
  });
  return true;
}

export function collectLinkedMediaReferences({
  links,
  nodeId,
  nodeOutputs,
  nodes,
}: {
  links: GraphLink[];
  nodeId: string;
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
}) {
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];
  const audioUrls: string[] = [];
  const ossIds: string[] = [];

  const addOssId = (value: unknown) => {
    collectOssIdsFromValue(value).forEach((id) => addUniqueString(ossIds, id));
  };

  links.forEach((link) => {
    if (link.toNodeId !== nodeId) return;
    const sourceNode = nodes.find((candidate) => candidate.id === link.fromNodeId);
    if (!sourceNode) return;
    const outputValue = nodeOutputs.get(link.fromNodeId)?.get(link.fromOutputIndex);
    if (sourceNode.type === "image_node") {
      const handledFrameStrip = addVisibleFrameStripOssIds({
        imageUrls,
        link,
        ossIds,
        sourceNode,
      });
      if (!handledFrameStrip) {
        collectImageReferenceUrls(sourceNode, outputValue).forEach((imageUrl) => {
          if (isLinkInputValueExcluded(link, imageUrl)) return;
          addUniqueString(imageUrls, imageUrl);
        });
        addOssId(sourceNode.data?.ossId);
        addOssId(sourceNode.data?.ossIds);
        addOssId(sourceNode.properties.ossId);
        addOssId(sourceNode.properties.ossIds);
        collectOssIdsFromObjectFields(outputValue).forEach(addOssId);
      }
      return;
    }

    if (sourceNode.type === "video_batch_replacement_node") {
      const batchImageUrls =
        pickBatchReplacementImageUrls(sourceNode.data?.batchReplacementSlots) ?? [];
      batchImageUrls.forEach((imageUrl) => {
        if (isLinkInputValueExcluded(link, imageUrl)) return;
        addUniqueString(imageUrls, imageUrl);
      });
      return;
    }

    addOssId(sourceNode.data?.ossId);
    addOssId(sourceNode.data?.ossIds);
    addOssId(sourceNode.properties.ossId);
    addOssId(sourceNode.properties.ossIds);
    collectOssIdsFromObjectFields(outputValue).forEach(addOssId);

    if (sourceNode.type === "video_node") {
      const videoUrl =
        (typeof sourceNode.data?.videoUrl === "string" && sourceNode.data.videoUrl.trim()) ||
        (typeof sourceNode.properties.videoUrl === "string" &&
          sourceNode.properties.videoUrl.trim()) ||
        "";
      addUniqueString(videoUrls, videoUrl);
      return;
    }

    if (sourceNode.type === "audio_node") {
      const audioUrl =
        (typeof sourceNode.data?.audioUrl === "string" && sourceNode.data.audioUrl.trim()) ||
        (typeof sourceNode.properties.audioUrl === "string" &&
          sourceNode.properties.audioUrl.trim()) ||
        "";
      addUniqueString(audioUrls, audioUrl);
    }
  });

  return { imageUrls, videoUrls, audioUrls, ossIds };
}

function normalizeNodePorts(node: GraphNode): GraphNode {
  let nextNode = normalizeSourceNode(sanitizeNodeRuntimeState(node));
  if (isSourceNode(nextNode)) return nextNode;

  if (nextNode.type === "text_node") {
    const model = String(nextNode.properties.model || "");
    let inputsChanged = false;
    const normalizedInputs = nextNode.inputs.map((input, index) => {
      if (input.name === "user_prompt" || index === 1) {
        if (input.name !== "user_prompt" || input.type !== "ANY") inputsChanged = true;
        return { ...input, name: "user_prompt", type: "ANY" as const };
      }
      if (input.name === "system_prompt" || index === 0) {
        if (input.name !== "system_prompt" || input.type !== "STRING") inputsChanged = true;
        return { ...input, name: "system_prompt", type: "STRING" as const };
      }
      return input;
    });
    TEXT_NODE_REQUIRED_MEDIA_INPUTS.forEach((requiredInput) => {
      const existingIndex = normalizedInputs.findIndex(
        (input) => input.name === requiredInput.name
      );
      if (existingIndex >= 0) {
        if (normalizedInputs[existingIndex].type !== requiredInput.type) inputsChanged = true;
        normalizedInputs[existingIndex] = requiredInput;
        return;
      }
      normalizedInputs.push(requiredInput);
      inputsChanged = true;
    });
    if (EMPTY_TEXT_MODEL_FALLBACKS.has(model) || inputsChanged) {
      nextNode = {
        ...nextNode,
        inputs: normalizedInputs,
        properties: {
          ...nextNode.properties,
          model: EMPTY_TEXT_MODEL_FALLBACKS.has(model) ? "" : model,
        },
      };
    }
  }

  if (nextNode.type === "image_node") {
    const aspectRatio = String(nextNode.properties.aspect_ratio || "16:9");
    const model = String(nextNode.properties.model || "");
    const nextInputs = [...nextNode.inputs];
    IMAGE_NODE_REQUIRED_INPUTS.forEach((requiredInput, index) => {
      const existingIndex = nextInputs.findIndex((input) => input.name === requiredInput.name);
      if (existingIndex >= 0) {
        nextInputs[existingIndex] = requiredInput;
        return;
      }
      nextInputs.splice(Math.min(index, nextInputs.length), 0, requiredInput);
    });
    nextNode = {
      ...nextNode,
      inputs: nextInputs,
      properties: {
        ...nextNode.properties,
        model: IMAGE_NODE_MODEL_FALLBACKS.has(model) ? "" : model,
        aspect_ratio: IMAGE_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : "16:9",
        quantity: "1",
        n: 1,
        prompt_optimizer: false,
      },
    };
  }

  if (nextNode.type === "audio_node") {
    const nextInputs = [...nextNode.inputs];
    AUDIO_NODE_REQUIRED_INPUTS.forEach((requiredInput, index) => {
      const existingIndex = nextInputs.findIndex((input) => input.name === requiredInput.name);
      if (existingIndex >= 0) {
        nextInputs[existingIndex] = requiredInput;
        return;
      }
      nextInputs.splice(Math.min(index, nextInputs.length), 0, requiredInput);
    });
    nextNode = {
      ...nextNode,
      inputs: nextInputs,
    };
  }

  if (nextNode.type === "video_node") {
    const nextInputs = [...nextNode.inputs];
    VIDEO_NODE_REQUIRED_INPUTS.forEach((requiredInput, index) => {
      const existingIndex = nextInputs.findIndex((input) => input.name === requiredInput.name);
      if (existingIndex >= 0) {
        nextInputs[existingIndex] = requiredInput;
        return;
      }
      nextInputs.splice(Math.min(index, nextInputs.length), 0, requiredInput);
    });
    nextNode = {
      ...nextNode,
      inputs: nextInputs,
    };
  }

  return nextNode;
}

function normalizeNodes(nodes: GraphNode[]): GraphNode[] {
  return nodes.map(normalizeNodePorts);
}

export interface UseWorkflowStateOptions {
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    timeout?: number;
    systemPrompt?: string;
    useSystemProxy?: boolean;
    remoteModelsByType?: AiModelsByType;
  };
  remoteProject?: RemoteCanvasProject | null;
  onRemotePersist?: (project: RemoteCanvasProject) => void | Promise<void>;
  getRemotePersistKey?: (project: RemoteCanvasProject) => string;
}

export function useWorkflowState(options: UseWorkflowStateOptions) {
  const { apiConfig, remoteProject, onRemotePersist, getRemotePersistKey } = options;
  const isRemoteMode = Boolean(onRemotePersist);

  const initial = useMemo<Workspace>(() => {
    if (remoteProject) return buildWorkspaceFromRemoteProject(remoteProject);
    return makeWorkspace();
    // The initial workspace is captured once; later remote refreshes are reconciled by dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [workspace, setWorkspace] = useState<Workspace>(initial);
  const initialWf = initial.workflows[initial.currentId];
  const initialNodes = normalizeNodes(initialWf?.data.nodes ?? []);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([makeLog("info", "Canvas initialized.")]);
  const [linkFromNodeId, setLinkFromNodeId] = useState("");
  const [linkToNodeId, setLinkToNodeId] = useState("");
  const [linkFromOutputIndex, setLinkFromOutputIndex] = useState(0);
  const [linkToInputIndex, setLinkToInputIndex] = useState(0);

  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [links, setLinks] = useState<GraphLink[]>(initialWf?.data.links ?? []);
  const [groups, setGroups] = useState<import("../types").GroupBox[]>(initialWf?.data.groups ?? []);
  const [nodeOutputs, setNodeOutputs] = useState<NodeOutputMap>(() =>
    outputsToMap(initialWf?.data.nodeOutputs ?? [])
  );
  const [isRunning, setIsRunning] = useState(false);
  const [remotePersistRetryTick, setRemotePersistRetryTick] = useState(0);

  const [historyState, setHistoryState] = useState<{ stack: HistorySnapshot[]; pointer: number }>(
    () => ({
      stack: [{ nodes: initialNodes, links: initialWf?.data.links ?? [] }],
      pointer: 0,
    })
  );
  const skipNextRemotePersistRef = useRef(false);
  const lastRemotePersistSignatureRef = useRef("");
  const inFlightRemotePersistKeyRef = useRef("");
  const deferredRemotePersistRef = useRef(false);
  const lastRemotePersistedAtRef = useRef(0);
  const pendingLocalPersistSignatureRef = useRef("");
  const remoteDirtyKindRef = useRef<RemoteDirtyKind>("none");
  const remotePersistRetryTimeoutRef = useRef<number | null>(null);
  const currentWorkflowIdRef = useRef(initial.currentId);
  const currentNodesRef = useRef(initialNodes);
  const currentLinksRef = useRef(initialWf?.data.links ?? []);
  const currentGroupsRef = useRef<import("../types").GroupBox[]>(initialWf?.data.groups ?? []);
  const currentNodeOutputsRef = useRef(outputsToMap(initialWf?.data.nodeOutputs ?? []));
  const remoteVideoPollsRef = useRef(new Map<string, { cancelled: boolean; timeoutId?: number }>());
  const batchEditImagesPollsRef = useRef(
    new Map<string, { cancelled: boolean; timeoutId?: number }>()
  );
  const canUndo = historyState.pointer > 0;
  const canRedo = historyState.pointer < historyState.stack.length - 1;

  const workflowList = useMemo<WorkflowSummary[]>(() => {
    return (Object.values(workspace.workflows) as Workflow[])
      .map((w) => w.summary)
      .filter((s) => !s.deletedAt)
      .sort((a, b) => b.sortIndex - a.sortIndex);
  }, [workspace]);

  const trashList = useMemo<WorkflowSummary[]>(() => {
    return workspace.trash
      .map((w) => w.summary)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }, [workspace.trash]);

  const allCategories = useMemo<string[]>(() => {
    const set = new Set<string>();
    (Object.values(workspace.workflows) as Workflow[]).forEach((w) => {
      if (w.summary.category) set.add(w.summary.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [workspace]);

  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    (Object.values(workspace.workflows) as Workflow[]).forEach((w) => {
      w.summary.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [workspace]);

  const currentWorkflowSummary = useMemo<WorkflowSummary | null>(() => {
    const wf = workspace.workflows[workspace.currentId];
    if (!wf || wf.summary.deletedAt) return null;
    return wf.summary;
  }, [workspace]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const graphIndex = useMemo(() => buildCanvasGraphIndex(nodes, links), [links, nodes]);

  useEffect(() => {
    currentWorkflowIdRef.current = workspace.currentId;
    currentNodesRef.current = nodes;
    currentLinksRef.current = links;
    currentGroupsRef.current = groups;
    currentNodeOutputsRef.current = nodeOutputs;
  }, [groups, links, nodeOutputs, nodes, workspace.currentId]);

  const linkDraftIssue = useMemo(
    () =>
      getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: linkToNodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: linkToInputIndex,
        linkKeySet: graphIndex.linkKeySet,
        nodeById: graphIndex.nodeById,
        nodes,
        links,
      }),
    [graphIndex, linkFromNodeId, linkToNodeId, linkFromOutputIndex, linkToInputIndex, nodes, links]
  );

  const resolvedInputsMap = useMemo(
    () => buildResolvedInputsMap(nodes, links, nodeOutputs),
    [nodes, links, nodeOutputs]
  );

  const appendLog = useCallback((type: ExecutionLog["type"], message: string) => {
    setLogs((prev) => [...prev, makeLog(type, message)].slice(-80));
  }, []);

  const markRemoteDirty = useCallback(
    (dirtyKind: RemoteDirtyKind) => {
      if (!isRemoteMode || dirtyKind === "none") return;
      const current = remoteDirtyKindRef.current;
      if (current === "structure") return;
      if (dirtyKind === "structure" || current === "none") {
        remoteDirtyKindRef.current = dirtyKind;
        return;
      }
      if (dirtyKind === "content" || current === "position") {
        remoteDirtyKindRef.current = dirtyKind;
      }
    },
    [isRemoteMode]
  );

  const syncCurrentWorkflowMeta = useCallback((updater: (wf: Workflow) => Workflow) => {
    setWorkspace((prev) => {
      const wf = prev.workflows[prev.currentId];
      if (!wf) return prev;
      const next = updater(wf);
      if (next === wf) return prev;
      return { ...prev, workflows: { ...prev.workflows, [wf.summary.id]: next } };
    });
  }, []);

  const markLocalRemotePersistPending = useCallback(
    (snapshot: {
      groups?: GroupBox[];
      links?: GraphLink[];
      nodeOutputs?: NodeOutputMap;
      nodes?: GraphNode[];
    }) => {
      if (!isRemoteMode || !currentWorkflowSummary?.id) return;
      pendingLocalPersistSignatureRef.current = serializeRemotePersistSnapshot({
        workflowId: currentWorkflowSummary.id,
        name: currentWorkflowSummary.name,
        category: currentWorkflowSummary.category,
        tags: currentWorkflowSummary.tags ?? [],
        nodes: sanitizeNodesRuntimeState(snapshot.nodes ?? currentNodesRef.current),
        links: snapshot.links ?? currentLinksRef.current,
        nodeOutputs: snapshot.nodeOutputs ?? currentNodeOutputsRef.current,
        groups: snapshot.groups ?? currentGroupsRef.current,
      });
    },
    [currentWorkflowSummary, isRemoteMode]
  );

  const pushHistory = useCallback((snapshot: HistorySnapshot) => {
    setHistoryState((prev) => {
      const next = prev.stack.slice(0, prev.pointer + 1);
      next.push(snapshot);
      if (next.length > HISTORY_LIMIT) next.shift();
      return { stack: next, pointer: next.length - 1 };
    });
  }, []);

  const resetHistory = useCallback((snapshot: HistorySnapshot) => {
    setHistoryState({ stack: [snapshot], pointer: 0 });
  }, []);

  const addNode = (
    type: NodeClass,
    x?: number,
    y?: number,
    initialProps?: Record<string, unknown>,
    connectFromDraft?: { fromNodeId: string; fromOutputIndex: number; toInputIndex?: number }
  ) => {
    const result = addNodeToWorkflowSnapshot({
      nodes: currentNodesRef.current,
      links: currentLinksRef.current,
      type,
      x,
      y,
      initialProps,
      connectFromDraft,
    });
    const { id, node, nodes: nextNodes, links: nextLinks, warning } = result;
    if (warning) {
      appendLog("warning", warning);
    }
    currentNodesRef.current = nextNodes;
    currentLinksRef.current = nextLinks;
    markRemoteDirty("structure");
    setNodes(nextNodes);
    setLinks(nextLinks);
    setSelectedNodeId(node.id);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes, links: nextLinks },
    }));
    pushHistory({ nodes: nextNodes, links: nextLinks });
    appendLog("success", `宸叉坊鍔犺妭鐐?${node.title}`);
    return id;
  };

  const removeNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    const nextNodes = relayoutVideoFrameImageChildSnapshots(nodes.filter((n) => n.id !== nodeId));
    const nextLinks = links.filter((l) => l.fromNodeId !== nodeId && l.toNodeId !== nodeId);
    markRemoteDirty("structure");
    setNodes(nextNodes);
    setLinks(nextLinks);
    setNodeOutputs((prev) => {
      const m = new Map(prev);
      m.delete(nodeId);
      return m;
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes, links: nextLinks },
    }));
    pushHistory({ nodes: nextNodes, links: nextLinks });
    appendLog("warning", `宸插垹闄よ妭鐐?${node?.title ?? nodeId}`);
  };

  const removeNodes = (nodeIds: Iterable<string>) => {
    const idSet = new Set(nodeIds);
    if (idSet.size === 0) return 0;

    const activeNodes = currentNodesRef.current;
    const activeLinks = currentLinksRef.current;
    const removedNodes = activeNodes.filter((node) => idSet.has(node.id));
    if (removedNodes.length === 0) return 0;

    const nextNodes = relayoutVideoFrameImageChildSnapshots(
      activeNodes.filter((node) => !idSet.has(node.id))
    );
    const nextLinks = activeLinks.filter(
      (link) => !idSet.has(link.fromNodeId) && !idSet.has(link.toNodeId)
    );
    const nextNodeOutputs: NodeOutputMap = new Map(currentNodeOutputsRef.current);
    idSet.forEach((nodeId) => nextNodeOutputs.delete(nodeId));

    currentNodesRef.current = nextNodes;
    currentLinksRef.current = nextLinks;
    currentNodeOutputsRef.current = nextNodeOutputs;
    markRemoteDirty("structure");
    setNodes(nextNodes);
    setLinks(nextLinks);
    setNodeOutputs(nextNodeOutputs);
    if (selectedNodeId && idSet.has(selectedNodeId)) setSelectedNodeId(null);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: {
        ...wf.data,
        links: nextLinks,
        nodeOutputs: mapToOutputs(nextNodeOutputs),
        nodes: nextNodes,
      },
    }));
    pushHistory({ nodes: nextNodes, links: nextLinks });
    appendLog("warning", `已删除 ${removedNodes.length} 个节点。`);
    return removedNodes.length;
  };

  const duplicateNode = (nodeId: string) => {
    const src = nodes.find((n) => n.id === nodeId);
    if (!src) return;
    const id = makeId("node");
    const clone = duplicateNodeAsSource(
      src,
      id,
      getNextNumberedNodeTitle(nodes, src.type) || `${src.title} Copy`
    );
    const nextNodes = [...nodes, clone];
    markRemoteDirty("structure");
    setNodes(nextNodes);
    setSelectedNodeId(id);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes },
    }));
    pushHistory({ nodes: nextNodes, links });
    appendLog("info", `宸插鍒惰妭鐐?${src.title}`);
  };

  const insertNodesAndLinks = (incomingNodes: GraphNode[], incomingLinks: GraphLink[] = []) => {
    if (incomingNodes.length === 0) return [];

    const activeNodes = currentNodesRef.current;
    const activeLinks = currentLinksRef.current;
    const nextNodes = [...activeNodes, ...incomingNodes];
    const incomingNodeIds = new Set(incomingNodes.map((node) => node.id));
    const sanitizedLinks = incomingLinks.filter(
      (link) => incomingNodeIds.has(link.fromNodeId) && incomingNodeIds.has(link.toNodeId)
    );
    const nextLinks = [...activeLinks, ...sanitizedLinks];

    currentNodesRef.current = nextNodes;
    currentLinksRef.current = nextLinks;
    markRemoteDirty("structure");
    setNodes(nextNodes);
    setLinks(nextLinks);
    setSelectedNodeId(incomingNodes[0]?.id ?? null);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks, nodes: nextNodes },
    }));
    pushHistory({ nodes: nextNodes, links: nextLinks });
    appendLog(
      "success",
      `已粘贴 ${incomingNodes.length} 个节点${sanitizedLinks.length ? `，保留 ${sanitizedLinks.length} 条内部连线` : ""}。`
    );
    return incomingNodes.map((node) => node.id);
  };

  const updateNodePositions = (updates: NodePositionUpdate[]) => {
    if (updates.length === 0) return;
    const positionedNodes = applyNodePositionUpdates(currentNodesRef.current, updates);
    const nextNodes = syncNodeGroupMembership(positionedNodes, currentGroupsRef.current);
    if (nextNodes === currentNodesRef.current) return;
    currentNodesRef.current = nextNodes;
    markRemoteDirty(nextNodes === positionedNodes ? "position" : "structure");
    markLocalRemotePersistPending({ nodes: nextNodes });
    setNodes(nextNodes);
  };

  const layoutNodePositions = (updates: NodePositionUpdate[]) => {
    if (updates.length === 0) return false;
    const nextNodes = applyNodePositionUpdates(currentNodesRef.current, updates);
    if (nextNodes === currentNodesRef.current) return false;

    currentNodesRef.current = nextNodes;
    markRemoteDirty("position");
    markLocalRemotePersistPending({ nodes: nextNodes });
    setNodes(nextNodes);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes },
    }));
    pushHistory({ nodes: nextNodes, links: currentLinksRef.current });
    appendLog("info", `已调整 ${updates.length} 个节点的位置。`);
    return true;
  };

  const updateNodePosition = (nodeId: string, x: number, y: number) => {
    updateNodePositions([{ nodeId, x, y }]);
  };

  const clearCanvas = () => {
    currentNodesRef.current = [];
    currentLinksRef.current = [];
    currentGroupsRef.current = [];
    currentNodeOutputsRef.current = new Map();
    markRemoteDirty("structure");
    setNodes([]);
    setLinks([]);
    setGroups([]);
    setSelectedNodeId(null);
    setNodeOutputs(new Map());
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { groups: [], nodes: [], links: [], nodeOutputs: [] },
    }));
    pushHistory({ nodes: [], links: [] });
    appendLog("warning", "Canvas cleared.");
  };

  const addLinkFromDraft = (draft: {
    fromNodeId: string;
    toNodeId: string;
    fromOutputIndex: number;
    toInputIndex: number;
  }) => {
    const activeNodes = currentNodesRef.current;
    const activeLinks = currentLinksRef.current;
    const activeGraphIndex = buildCanvasGraphIndex(activeNodes, activeLinks);
    const fromNodeCandidate = activeGraphIndex.nodeById.get(draft.fromNodeId);
    const toNodeCandidate = activeGraphIndex.nodeById.get(draft.toNodeId);
    const fromOutput = fromNodeCandidate?.outputs[draft.fromOutputIndex];
    const requestedInput = toNodeCandidate?.inputs[draft.toInputIndex];
    const normalizedInputIndex =
      fromNodeCandidate &&
      toNodeCandidate &&
      fromOutput &&
      (!requestedInput || !isDataTypeCompatible(fromOutput.type, requestedInput.type))
        ? findFirstCompatibleInputIndex(fromNodeCandidate, toNodeCandidate, draft.fromOutputIndex)
        : draft.toInputIndex;
    const normalizedDraft = { ...draft, toInputIndex: normalizedInputIndex };
    const issue = getLinkDraftIssue({
      ...normalizedDraft,
      linkKeySet: activeGraphIndex.linkKeySet,
      nodeById: activeGraphIndex.nodeById,
      nodes: activeNodes,
      links: activeLinks,
    });
    if (issue) {
      appendLog("warning", issue);
      return false;
    }

    const fromNode = activeGraphIndex.nodeById.get(normalizedDraft.fromNodeId)!;
    const toNode = activeGraphIndex.nodeById.get(normalizedDraft.toNodeId)!;
    const link: GraphLink = {
      id: makeId("link"),
      fromNodeId: normalizedDraft.fromNodeId,
      fromOutputIndex: normalizedDraft.fromOutputIndex,
      toNodeId: normalizedDraft.toNodeId,
      toInputIndex: normalizedDraft.toInputIndex,
    };

    const nextLinks = [...activeLinks, link];
    currentLinksRef.current = nextLinks;
    markRemoteDirty("structure");
    setLinks(nextLinks);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks },
    }));
    pushHistory({ nodes, links: nextLinks });
    appendLog(
      "success",
      `宸插缓绔嬭繛绾?${fromNode.title}[${fromNode.outputs[normalizedDraft.fromOutputIndex].name}] -> ${toNode.title}[${toNode.inputs[normalizedDraft.toInputIndex].name}]`
    );
    return true;
  };

  const addLinksFromDrafts = (
    drafts: Array<{
      fromNodeId: string;
      toNodeId: string;
      fromOutputIndex: number;
      toInputIndex: number;
    }>
  ) => {
    const activeNodes = currentNodesRef.current;
    const activeLinks = currentLinksRef.current;
    const activeGraphIndex = buildCanvasGraphIndex(activeNodes, activeLinks);
    const createdLinks: GraphLink[] = [];
    const warnings: string[] = [];
    let nextLinks = activeLinks;
    const nextLinkKeySet = new Set(activeGraphIndex.linkKeySet);

    drafts.forEach((draft) => {
      const fromNodeCandidate = activeGraphIndex.nodeById.get(draft.fromNodeId);
      const toNodeCandidate = activeGraphIndex.nodeById.get(draft.toNodeId);
      const fromOutput = fromNodeCandidate?.outputs[draft.fromOutputIndex];
      const requestedInput = toNodeCandidate?.inputs[draft.toInputIndex];
      const normalizedInputIndex =
        fromNodeCandidate &&
        toNodeCandidate &&
        fromOutput &&
        (!requestedInput || !isDataTypeCompatible(fromOutput.type, requestedInput.type))
          ? findFirstCompatibleInputIndex(fromNodeCandidate, toNodeCandidate, draft.fromOutputIndex)
          : draft.toInputIndex;
      const normalizedDraft = { ...draft, toInputIndex: normalizedInputIndex };
      const issue = getLinkDraftIssue({
        ...normalizedDraft,
        linkKeySet: nextLinkKeySet,
        nodeById: activeGraphIndex.nodeById,
        nodes: activeNodes,
        links: nextLinks,
      });
      if (issue) {
        warnings.push(issue);
        return;
      }

      const link: GraphLink = {
        id: makeId("link"),
        fromNodeId: normalizedDraft.fromNodeId,
        fromOutputIndex: normalizedDraft.fromOutputIndex,
        toNodeId: normalizedDraft.toNodeId,
        toInputIndex: normalizedDraft.toInputIndex,
      };
      createdLinks.push(link);
      nextLinks = [...nextLinks, link];
      nextLinkKeySet.add(getGraphLinkKey(link));
    });

    if (createdLinks.length === 0) {
      appendLog("warning", warnings[0] ?? "没有可建立的连线。");
      return 0;
    }

    currentLinksRef.current = nextLinks;
    markRemoteDirty("structure");
    setLinks(nextLinks);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks },
    }));
    pushHistory({ nodes, links: nextLinks });
    appendLog("success", `已批量建立 ${createdLinks.length} 条连线。`);
    if (warnings.length > 0) {
      appendLog("warning", `${warnings.length} 条连线因端口不兼容或重复被跳过。`);
    }
    return createdLinks.length;
  };

  const addLink = () => {
    if (linkDraftIssue) {
      appendLog("warning", linkDraftIssue);
      return;
    }
    addLinkFromDraft({
      fromNodeId: linkFromNodeId,
      toNodeId: linkToNodeId,
      fromOutputIndex: linkFromOutputIndex,
      toInputIndex: linkToInputIndex,
    });
  };

  const clearLinkDraft = useCallback(() => {
    setLinkFromNodeId("");
    setLinkToNodeId("");
    setLinkFromOutputIndex(0);
    setLinkToInputIndex(0);
  }, []);

  useEffect(() => {
    if (!remoteProject) return;
    if (currentNodesRef.current.some(hasNodeRuntimeState)) return;
    const nextWorkspace = buildWorkspaceFromRemoteProject(remoteProject);
    const nextWorkflow = nextWorkspace.workflows[nextWorkspace.currentId];
    const nextNodes = normalizeNodes(nextWorkflow.data.nodes);
    const nextLinks = nextWorkflow.data.links;
    const nextGroups = nextWorkflow.data.groups ?? [];
    const nextNodeOutputs = outputsToMap(nextWorkflow.data.nodeOutputs);
    const incomingRemotePersistSignature = serializeRemotePersistSnapshot({
      workflowId: remoteProject.id,
      name: remoteProject.name,
      category: remoteProject.category,
      tags: remoteProject.tags,
      nodes: nextNodes,
      links: nextLinks,
      nodeOutputs: nextNodeOutputs,
      groups: nextGroups,
    });
    if (
      !shouldApplyRemoteWorkflowSnapshot({
        incomingRemotePersistSignature,
        pendingLocalPersistSignature: pendingLocalPersistSignatureRef.current,
      })
    ) {
      return;
    }
    if (incomingRemotePersistSignature === pendingLocalPersistSignatureRef.current) {
      pendingLocalPersistSignatureRef.current = "";
    }
    if (
      isRemoteWorkflowEcho(remoteProject, {
        workflowId: currentWorkflowIdRef.current,
        nodes: currentNodesRef.current,
        links: currentLinksRef.current,
        nodeOutputs: currentNodeOutputsRef.current,
        groups: currentGroupsRef.current,
      })
    ) {
      return;
    }

    skipNextRemotePersistRef.current = true;
    lastRemotePersistSignatureRef.current = incomingRemotePersistSignature;
    lastRemotePersistedAtRef.current = Date.now();
    remoteDirtyKindRef.current = "none";
    setWorkspace(nextWorkspace);
    setNodes(nextNodes);
    setLinks(nextLinks);
    setGroups(nextGroups);
    setNodeOutputs(nextNodeOutputs);
    setSelectedNodeId(null);
    clearLinkDraft();
    resetHistory({ nodes: nextNodes, links: nextLinks });
  }, [remoteProject, clearLinkDraft, resetHistory]);

  const removeLink = (linkId: string) => {
    const activeLinks = currentLinksRef.current;
    const activeNodes = currentNodesRef.current;
    const link = activeLinks.find((l) => l.id === linkId);
    if (link?.locked) {
      appendLog("warning", "This link was created by a quick template and cannot be removed.");
      return;
    }
    const nextLinks = activeLinks.filter((l) => l.id !== linkId);
    markRemoteDirty("structure");
    currentLinksRef.current = nextLinks;
    setLinks(nextLinks);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks },
    }));
    pushHistory({ nodes: activeNodes, links: nextLinks });
    appendLog("warning", `宸茬Щ闄よ繛绾?${linkId}`);
  };

  const removeInputReference = (linkId: string, value: string) => {
    const activeLinks = currentLinksRef.current;
    const activeNodes = currentNodesRef.current;
    const activeNodeOutputs = currentNodeOutputsRef.current;
    const link = activeLinks.find((l) => l.id === linkId);
    if (!link) return;
    if (link.locked) {
      appendLog("warning", "This link was created by a quick template and cannot be removed.");
      return;
    }

    const visibleReferences = collectNodeInputReferences({
      links: activeLinks,
      nodeOutputs: activeNodeOutputs,
      nodes: activeNodes,
      targetNodeId: link.toNodeId,
    }).filter((reference) => reference.linkId === linkId);
    if (visibleReferences.length <= 1) {
      removeLink(linkId);
      return;
    }

    const excludedInputValues = Array.from(
      new Set([...(link.excludedInputValues ?? []), value].filter(Boolean))
    );
    const nextLinks = activeLinks.map((item) =>
      item.id === linkId ? { ...item, excludedInputValues } : item
    );
    currentLinksRef.current = nextLinks;
    markRemoteDirty("structure");
    setLinks(nextLinks);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks },
    }));
    pushHistory({ nodes: activeNodes, links: nextLinks });
    appendLog("warning", `宸茬Щ闄よ緭鍏ヨ祫婧?${linkId}`);
  };

  const createImagePromptStarter = useCallback(
    (textNodeId: string) => {
      const textNode = nodes.find((n) => n.id === textNodeId && n.type === "text_node");
      if (!textNode) return null;
      const existingStarterLink = links.find((link) => link.toNodeId === textNodeId && link.locked);
      const imageNodeX = textNode.x - IMAGE_PROMPT_STARTER_IMAGE_OFFSET_X;
      const imageNodeY = textNode.y + IMAGE_PROMPT_STARTER_IMAGE_OFFSET_Y;
      if (existingStarterLink) {
        setSelectedNodeId(textNodeId);
        const imageNode = nodes.find((node) => node.id === existingStarterLink.fromNodeId);
        if (
          imageNode &&
          (imageNode.x !== imageNodeX ||
            imageNode.y !== imageNodeY ||
            imageNode.data?.imagePromptStarter !== true ||
            imageNode.data?.starterTextNodeId !== textNodeId)
        ) {
          const nextNodes = nodes.map((node) =>
            node.id === imageNode.id
              ? {
                  ...node,
                  x: imageNodeX,
                  y: imageNodeY,
                  data: {
                    ...(node.data || {}),
                    imagePromptStarter: true,
                    starterTextNodeId: textNodeId,
                    starterGapX: IMAGE_PROMPT_STARTER_GAP_X,
                  },
                }
              : node
          );
          markRemoteDirty("content");
          setNodes(nextNodes);
          syncCurrentWorkflowMeta((wf) => ({
            ...wf,
            summary: { ...wf.summary, updatedAt: Date.now() },
            data: { ...wf.data, nodes: nextNodes, links },
          }));
          pushHistory({ nodes: nextNodes, links });
          appendLog("info", "鍥剧墖鍙嶆帹鎻愮ず璇嶆ā鏉垮凡瀵归綈鍒版爣鍑嗗竷灞€");
        } else {
          appendLog("info", "鍥剧墖鍙嶆帹鎻愮ず璇嶆ā鏉垮凡瀛樺湪");
        }
        return {
          imageNodeId: existingStarterLink.fromNodeId,
          textNodeId,
          bounds: getImagePromptStarterFocusBounds(textNode, imageNodeX, imageNodeY),
        };
      }
      const imageId = makeId("node");
      const linkId = makeId("link");
      const imageNode = createNodeFromType("image_node", imageId, imageNodeX, imageNodeY);
      imageNode.title = getNextNumberedNodeTitle(nodes, "image_node") || imageNode.title;
      imageNode.properties = {
        ...imageNode.properties,
        imageUrl: IMAGE_PROMPT_PLACEHOLDER_URL,
        text: "鍥剧墖鍙嶆帹鎻愮ず璇嶅弬鑰冨浘",
      };
      imageNode.data = {
        ...(imageNode.data || {}),
        imageUrl: IMAGE_PROMPT_PLACEHOLDER_URL,
        imageUrls: [IMAGE_PROMPT_PLACEHOLDER_URL],
        activeImageIndex: 0,
        imageNaturalWidth: 1152,
        imageNaturalHeight: 864,
        isUploadPlaceholder: true,
        imagePromptStarter: true,
        starterTextNodeId: textNodeId,
        starterGapX: IMAGE_PROMPT_STARTER_GAP_X,
        status: "success",
        loading: false,
      };

      const nextNodes = [...nodes, imageNode].map((node) =>
        node.id === textNodeId
          ? {
              ...node,
              properties: {
                ...node.properties,
                text:
                  typeof node.properties.text === "string" && node.properties.text.trim()
                    ? node.properties.text
                    : IMAGE_PROMPT_DEFAULT_TEXT,
                model: DEFAULT_TEXT_REMOTE_MODEL,
                status: node.properties.status || "idle",
              },
            }
          : node
      );
      const nextLinks = [
        ...links,
        {
          id: linkId,
          fromNodeId: imageId,
          fromOutputIndex: 0,
          toNodeId: textNodeId,
          toInputIndex: 1,
          locked: true,
        },
      ];

      markRemoteDirty("structure");
      setNodes(nextNodes);
      setLinks(nextLinks);
      setSelectedNodeId(textNodeId);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodes, links: nextLinks },
      }));
      pushHistory({ nodes: nextNodes, links: nextLinks });
      appendLog("success", "宸插垱寤哄浘鐗囧弽鎺ㄦ彁绀鸿瘝妯℃澘");
      return {
        imageNodeId: imageId,
        textNodeId,
        bounds: getImagePromptStarterFocusBounds(textNode, imageNodeX, imageNodeY),
      };
    },
    [appendLog, links, markRemoteDirty, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const createTextNodeStarterFlow = useCallback(
    (textNodeId: string, action: TextNodeStarterFlowAction) => {
      const result = createTextNodeStarterFlowSnapshot({
        nodes,
        links,
        textNodeId,
        action,
        makeId,
      });
      if (!result) return null;

      markRemoteDirty("structure");
      setNodes(result.nodes);
      setLinks(result.links);
      setSelectedNodeId(textNodeId);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: result.nodes, links: result.links },
      }));
      pushHistory({ nodes: result.nodes, links: result.links });
      appendLog(
        "success",
        action === "video" ? "已创建文生视频流转节点" : "已创建文字生音乐流转节点"
      );
      return result;
    },
    [appendLog, links, markRemoteDirty, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const syncImagePromptStarterLayout = useCallback(
    (imageNodeId: string, imageNodeWidth: number) => {
      if (!Number.isFinite(imageNodeWidth) || imageNodeWidth <= 0) return;

      let nextNodesSnapshot: GraphNode[] | null = null;
      setNodes((prev) => {
        const imageNode = prev.find(
          (node) => node.id === imageNodeId && node.type === "image_node"
        );
        const textNodeId =
          typeof imageNode?.data?.starterTextNodeId === "string"
            ? imageNode.data.starterTextNodeId
            : "";
        const textNode = prev.find((node) => node.id === textNodeId && node.type === "text_node");
        if (!imageNode || !textNode) return prev;

        const nextTextNodeX = getImagePromptStarterTextNodeX(
          imageNode.x,
          imageNodeWidth,
          typeof imageNode.data?.starterGapX === "number"
            ? imageNode.data.starterGapX
            : IMAGE_PROMPT_STARTER_GAP_X
        );
        if (Math.abs(textNode.x - nextTextNodeX) < 1) return prev;

        const nextNodes = prev.map((node) =>
          node.id === textNode.id
            ? {
                ...node,
                x: nextTextNodeX,
              }
            : node
        );
        nextNodesSnapshot = nextNodes;
        return nextNodes;
      });

      if (!nextNodesSnapshot) return;

      markRemoteDirty("position");
      markLocalRemotePersistPending({ nodes: nextNodesSnapshot });
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodesSnapshot, links },
      }));
      pushHistory({ nodes: nextNodesSnapshot, links });
    },
    [links, markLocalRemotePersistPending, markRemoteDirty, pushHistory, syncCurrentWorkflowMeta]
  );

  const updateNodeProperty = (nodeId: string, key: string, value: unknown) => {
    markRemoteDirty("content");
    const activeNodes = currentNodesRef.current;
    const next = updateNodePropertySnapshot(activeNodes, nodeId, key, value);
    currentNodesRef.current = next;
    markLocalRemotePersistPending({ nodes: next });
    setNodes(next);
  };

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<GraphNode["data"]>) => {
      markRemoteDirty("content");
      const activeNodes = currentNodesRef.current;
      const activeLinks = currentLinksRef.current;
      const activeNodeOutputs = currentNodeOutputsRef.current;
      const patchedNodes = updateNodeDataSnapshot(activeNodes, nodeId, data);
      const synced =
        Array.isArray(data.batchReplacementSlots) &&
        patchedNodes.some(
          (node) => node.id === nodeId && node.type === "video_batch_replacement_node"
        )
          ? syncVideoBatchReplacementTargetsSnapshot({
              batchNodeId: nodeId,
              links: activeLinks,
              nodeOutputs: activeNodeOutputs,
              nodes: patchedNodes,
            })
          : { links: activeLinks, nodeOutputs: activeNodeOutputs, nodes: patchedNodes };

      currentNodesRef.current = synced.nodes;
      currentLinksRef.current = synced.links;
      currentNodeOutputsRef.current = synced.nodeOutputs;
      markLocalRemotePersistPending({
        links: synced.links,
        nodeOutputs: synced.nodeOutputs,
        nodes: synced.nodes,
      });
      setNodes(synced.nodes);
      if (synced.links !== activeLinks) setLinks(synced.links);
      if (synced.nodeOutputs !== activeNodeOutputs) setNodeOutputs(synced.nodeOutputs);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: {
          ...wf.data,
          links: synced.links,
          nodeOutputs: mapToOutputs(synced.nodeOutputs),
          nodes: synced.nodes,
        },
      }));
    },
    [markLocalRemotePersistPending, markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const setPrimaryImageResult = useCallback(
    (nodeId: string, imageUrl: string, imageIndex: number) => {
      markRemoteDirty("content");
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data || {}),
                  imageUrl,
                  activeImageIndex: imageIndex,
                },
              }
            : n
        )
      );
      setNodeOutputs((prev) => {
        const next = new Map(prev);
        const existingOutputs = next.get(nodeId);
        const inner = new Map<number, unknown>(
          existingOutputs instanceof Map ? existingOutputs : []
        );
        inner.set(0, imageUrl);
        next.set(nodeId, inner);
        return next;
      });
    },
    [markRemoteDirty]
  );

  const extractFrameImageNode = useCallback(
    (sourceNodeId: string, frameIndex: number, position?: { x: number; y: number }) => {
      const snapshot = createFrameImageChildSnapshot({
        nodes,
        links,
        sourceNodeId,
        frameIndex,
        position,
        makeId,
      });
      if (!snapshot) {
        appendLog("warning", "无法提取该帧图片");
        return null;
      }

      markRemoteDirty("structure");
      setNodes(snapshot.nodes);
      setLinks(snapshot.links);
      setSelectedNodeId(snapshot.createdNode.id);
      setNodeOutputs((prev) => {
        const next = new Map(prev);
        next.set(
          snapshot.createdNode.id,
          new Map([[0, snapshot.createdNode.data?.imageUrl || ""]])
        );
        return next;
      });
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: snapshot.nodes, links: snapshot.links },
      }));
      pushHistory({ nodes: snapshot.nodes, links: snapshot.links });
      appendLog("success", `已提取第 ${frameIndex + 1} 帧为图片节点`);
      return snapshot.createdNode.id;
    },
    [appendLog, links, markRemoteDirty, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const createVideoFrameImageNode = useCallback(
    (
      sourceNodeId: string,
      captureMode: VideoFrameImageCaptureMode,
      preview: { url: string; width: number; height: number }
    ) => {
      const snapshot = createVideoFrameImageChildSnapshot({
        captureMode,
        links: currentLinksRef.current,
        makeId,
        naturalSize: { width: preview.width, height: preview.height },
        nodes: currentNodesRef.current,
        previewUrl: preview.url,
        sourceNodeId,
      });
      if (!snapshot) {
        appendLog("warning", "无法创建视频截帧图片节点");
        return null;
      }

      currentNodesRef.current = snapshot.nodes;
      currentLinksRef.current = snapshot.links;
      markRemoteDirty("structure");
      setNodes(snapshot.nodes);
      setLinks(snapshot.links);
      setSelectedNodeId(snapshot.createdNode.id);
      setNodeOutputs((prev) => {
        const next = new Map(prev);
        next.set(
          snapshot.createdNode.id,
          new Map([[0, snapshot.createdNode.data?.imageUrl || ""]])
        );
        return next;
      });
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: snapshot.nodes, links: snapshot.links },
      }));
      pushHistory({ nodes: snapshot.nodes, links: snapshot.links });
      appendLog("success", `已创建${snapshot.createdNode.title}图片节点`);
      return snapshot.createdNode.id;
    },
    [appendLog, markRemoteDirty, pushHistory, syncCurrentWorkflowMeta]
  );

  const completeVideoFrameImageNode = useCallback(
    (nodeId: string, uploaded: { url: string; ossId?: string }) => {
      const result = completeVideoFrameImageChildSnapshot({
        nodeId,
        nodes: currentNodesRef.current,
        ossId: uploaded.ossId,
        uploadedUrl: uploaded.url,
      });
      currentNodesRef.current = result.nodes;
      markRemoteDirty("content");
      setNodes(result.nodes);
      setNodeOutputs((prev) => {
        const next = new Map(prev);
        next.set(nodeId, new Map([[0, result.nodeOutputValue]]));
        return next;
      });
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: result.nodes },
      }));
    },
    [markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const failVideoFrameImageNode = useCallback(
    (nodeId: string, error: string) => {
      const nextNodes = failVideoFrameImageChildSnapshot({
        error,
        nodeId,
        nodes: currentNodesRef.current,
      });
      currentNodesRef.current = nextNodes;
      markRemoteDirty("content");
      setNodes(nextNodes);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodes },
      }));
    },
    [markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const replaceExtractedFrameImage = useCallback(
    (childNodeId: string) => {
      const snapshot = replaceFrameImageFromChildSnapshot({
        nodes,
        nodeOutputs,
        childNodeId,
      });
      if (!snapshot) {
        appendLog("warning", "无法回填该图片节点");
        return false;
      }

      markRemoteDirty("content");
      setNodes(snapshot.nodes);
      setNodeOutputs(snapshot.nodeOutputs);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: snapshot.nodes, links },
      }));
      pushHistory({ nodes: snapshot.nodes, links });
      appendLog("success", `已回填第 ${snapshot.frameIndex + 1} 帧`);
      return true;
    },
    [appendLog, links, markRemoteDirty, nodeOutputs, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const replaceFrameImageUrl = useCallback(
    (
      sourceNodeId: string,
      frameIndex: number,
      replacementUrl: string,
      replacementOssId?: string
    ) => {
      const snapshot = replaceFrameImageUrlSnapshot({
        nodes,
        nodeOutputs,
        sourceNodeId,
        frameIndex,
        replacementUrl,
        replacementOssId,
      });
      if (!snapshot) {
        appendLog("warning", "无法覆盖该帧图片");
        return false;
      }

      markRemoteDirty("content");
      setNodes(snapshot.nodes);
      setNodeOutputs(snapshot.nodeOutputs);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: snapshot.nodes, links },
      }));
      pushHistory({ nodes: snapshot.nodes, links });
      appendLog("success", `已覆盖第 ${snapshot.frameIndex + 1} 帧`);
      return true;
    },
    [appendLog, links, markRemoteDirty, nodeOutputs, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const addVideoFrameAnalysis = useCallback(
    (videoNodeId: string, captures: VideoFrameCaptureItem[]) => {
      const snapshot = createVideoFrameCaptureSnapshot({
        nodes: currentNodesRef.current,
        links: currentLinksRef.current,
        nodeOutputs: currentNodeOutputsRef.current,
        sourceNodeId: videoNodeId,
        captures,
        makeId,
      });

      if (!snapshot) {
        appendLog(
          "warning",
          "\u9010\u5e27\u5206\u6790\u5931\u8d25\uff1a\u672a\u627e\u5230\u89c6\u9891\u8282\u70b9\u6216\u6ca1\u6709\u53ef\u7528\u5e27\u6570\u636e"
        );
        return;
      }

      markRemoteDirty("structure");
      currentNodesRef.current = snapshot.nodes;
      currentLinksRef.current = snapshot.links;
      currentNodeOutputsRef.current = snapshot.nodeOutputs;
      setNodes(snapshot.nodes);
      setLinks(snapshot.links);
      setNodeOutputs(snapshot.nodeOutputs);
      setSelectedNodeId(videoNodeId);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: {
          ...wf.data,
          nodes: snapshot.nodes,
          links: snapshot.links,
          nodeOutputs: mapToOutputs(snapshot.nodeOutputs),
        },
      }));
      pushHistory({ nodes: snapshot.nodes, links: snapshot.links });
      appendLog(
        "success",
        `\u9010\u5e27\u5206\u6790\u5b8c\u6210\uff1a\u751f\u6210 ${captures.length} \u7ec4\u63a5\u53e3\u8282\u70b9`
      );
    },
    [appendLog, markRemoteDirty, pushHistory, syncCurrentWorkflowMeta]
  );

  const addVideoPromptTextNode = useCallback(
    (videoNodeId: string, prompt: string) => {
      const snapshot = createVideoPromptTextSnapshot({
        nodes: currentNodesRef.current,
        links: currentLinksRef.current,
        nodeOutputs: currentNodeOutputsRef.current,
        sourceNodeId: videoNodeId,
        prompt,
        makeId,
      });

      if (!snapshot) {
        appendLog("warning", "视频反推失败：未找到视频节点或提示词为空");
        return null;
      }

      markRemoteDirty("structure");
      currentNodesRef.current = snapshot.nodes;
      currentLinksRef.current = snapshot.links;
      currentNodeOutputsRef.current = snapshot.nodeOutputs;
      setNodes(snapshot.nodes);
      setLinks(snapshot.links);
      setNodeOutputs(snapshot.nodeOutputs);
      setSelectedNodeId(snapshot.createdNode.id);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: {
          ...wf.data,
          nodes: snapshot.nodes,
          links: snapshot.links,
          nodeOutputs: mapToOutputs(snapshot.nodeOutputs),
        },
      }));
      pushHistory({ nodes: snapshot.nodes, links: snapshot.links });
      appendLog("success", "视频反推提示词完成：已生成文本节点");
      return snapshot.createdNode;
    },
    [appendLog, markRemoteDirty, pushHistory, syncCurrentWorkflowMeta]
  );

  const addVideoBatchReplacementNode = useCallback(
    (frameAnalysisNodeId: string) => {
      const snapshot = createVideoBatchReplacementSnapshot({
        nodes: currentNodesRef.current,
        links: currentLinksRef.current,
        sourceNodeId: frameAnalysisNodeId,
        makeId,
      });

      if (!snapshot) {
        appendLog("warning", "批量替换失败：请选择逐帧分析节点");
        return null;
      }

      markRemoteDirty("structure");
      currentNodesRef.current = snapshot.nodes;
      currentLinksRef.current = snapshot.links;
      setNodes(snapshot.nodes);
      setLinks(snapshot.links);
      setSelectedNodeId(snapshot.createdNode.id);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: {
          ...wf.data,
          nodes: snapshot.nodes,
          links: snapshot.links,
        },
      }));
      pushHistory({ nodes: snapshot.nodes, links: snapshot.links });
      appendLog("success", "已创建批量替换节点");
      return snapshot.createdNode;
    },
    [appendLog, markRemoteDirty, pushHistory, syncCurrentWorkflowMeta]
  );

  const createVideoBatchReplacementResultRun = useCallback(
    ({
      batchNodeId,
      frameAnalysisNodeId,
      frameCount,
      result,
      runId,
    }: {
      batchNodeId: string;
      frameAnalysisNodeId: string;
      frameCount: number;
      result?: BatchEditImagesTaskResult;
      runId: string;
    }) => {
      const snapshot = createBatchEditImagesResultRunSnapshot({
        batchNodeId,
        frameAnalysisNodeId,
        frameCount,
        links: currentLinksRef.current,
        makeId,
        nodeOutputs: currentNodeOutputsRef.current,
        nodes: currentNodesRef.current,
        result,
        runId,
      });

      if (snapshot.createdNodeIds.length === 0) return [];

      markRemoteDirty("structure");
      currentNodesRef.current = snapshot.nodes;
      currentLinksRef.current = snapshot.links;
      currentNodeOutputsRef.current = snapshot.nodeOutputs;
      markLocalRemotePersistPending({
        links: snapshot.links,
        nodeOutputs: snapshot.nodeOutputs,
        nodes: snapshot.nodes,
      });
      setNodes(snapshot.nodes);
      setLinks(snapshot.links);
      setNodeOutputs(snapshot.nodeOutputs);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: {
          ...wf.data,
          links: snapshot.links,
          nodeOutputs: mapToOutputs(snapshot.nodeOutputs),
          nodes: snapshot.nodes,
        },
      }));
      pushHistory({ nodes: snapshot.nodes, links: snapshot.links });
      return snapshot.createdNodeIds;
    },
    [markLocalRemotePersistPending, markRemoteDirty, pushHistory, syncCurrentWorkflowMeta]
  );

  const updateSelectedProperty = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    updateNodeProperty(selectedNodeId, key, value);
  };

  const createGroup = useCallback(
    (nodeIds: string[], title?: string): import("../types").GroupBox | null => {
      if (nodeIds.length < 2) {
        appendLog("warning", "Grouping requires at least 2 nodes.");
        return null;
      }
      const selectedNodes = nodes.filter((n) => nodeIds.includes(n.id));
      if (selectedNodes.length < 2) {
        appendLog("warning", "Grouping requires at least 2 nodes.");
        return null;
      }
      const bounds = getGroupBoundsForNodes(selectedNodes, 44);
      const id = makeId("group");
      const colors = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981"];
      const color = colors[groups.length % colors.length];
      const group: import("../types").GroupBox = {
        id,
        title: title?.trim() || getNextGroupTitle(groups),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        color,
      };
      const nextGroups = [...groups, group];
      const nextNodes = nodes.map((n) => (nodeIds.includes(n.id) ? { ...n, groupId: id } : n));
      markRemoteDirty("structure");
      currentGroupsRef.current = nextGroups;
      currentNodesRef.current = nextNodes;
      setGroups(nextGroups);
      setNodes(nextNodes);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, groups: nextGroups, nodes: nextNodes },
      }));
      appendLog("success", `宸叉墦缁?"${group.title}" (${nodeIds.length} 鑺傜偣)`);
      return group;
    },
    [nodes, groups, appendLog, markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const ungroup = useCallback(
    (groupId: string): boolean => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return false;
      const nextGroups = groups.filter((g) => g.id !== groupId);
      const nextNodes = nodes.map((n) => (n.groupId === groupId ? { ...n, groupId: null } : n));
      markRemoteDirty("structure");
      currentGroupsRef.current = nextGroups;
      currentNodesRef.current = nextNodes;
      setGroups(nextGroups);
      setNodes(nextNodes);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, groups: nextGroups, nodes: nextNodes },
      }));
      appendLog("info", `宸茶В缁?"${group.title}"`);
      return true;
    },
    [groups, nodes, appendLog, markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<import("../types").GroupBox>): boolean => {
      const nextGroups = groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
      markRemoteDirty("content");
      currentGroupsRef.current = nextGroups;
      setGroups(nextGroups);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, groups: nextGroups },
      }));
      return true;
    },
    [groups, markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const resizeGroup = useCallback(
    (
      groupId: string,
      rect: Pick<import("../types").GroupBox, "x" | "y" | "width" | "height">
    ): boolean => {
      const activeGroups = currentGroupsRef.current;
      const activeNodes = currentNodesRef.current;
      const nextGroups = activeGroups.map((g) => (g.id === groupId ? { ...g, ...rect } : g));
      const nextNodes = syncNodeGroupMembership(activeNodes, nextGroups);
      const nodesChanged = nextNodes !== activeNodes;

      markRemoteDirty(nodesChanged ? "structure" : "content");
      currentGroupsRef.current = nextGroups;
      currentNodesRef.current = nextNodes;
      setGroups(nextGroups);
      if (nodesChanged) setNodes(nextNodes);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, groups: nextGroups, nodes: nextNodes },
      }));
      return true;
    },
    [markRemoteDirty, syncCurrentWorkflowMeta]
  );

  const writeNodeOutput = useCallback((nodeId: string, outputs: Record<number, unknown>) => {
    setNodeOutputs((prev) => {
      const next = new Map(prev);
      const inner = new Map<number, unknown>();
      Object.entries(outputs).forEach(([k, v]) => {
        inner.set(Number(k), v);
      });
      next.set(nodeId, inner);
      return next;
    });
  }, []);

  const collectTextNodeMediaReferences = useCallback(
    (nodeId: string) =>
      collectLinkedMediaReferences({
        links,
        nodeId,
        nodeOutputs,
        nodes,
      }),
    [links, nodeOutputs, nodes]
  );

  const runNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const executor = getExecutor(node.type);
      if (!executor) {
        appendLog("warning", `[${node.title}] 鏆傛棤鎵ц鍣?璺宠繃`);
        return;
      }

      const inputs = resolveNodeInputs(node, links, nodeOutputs, nodes);
      if (["text_node", "image_node", "video_node", "audio_node"].includes(node.type)) {
        const { imageUrls, videoUrls, audioUrls, ossIds } = collectTextNodeMediaReferences(nodeId);
        if (imageUrls.length > 0) inputs.reference_images = imageUrls;
        if (videoUrls.length > 0) inputs.reference_videos = videoUrls;
        if (audioUrls.length > 0) inputs.reference_audios = audioUrls;
        if (ossIds.length > 0) inputs.reference_oss_ids = ossIds;
      }
      updateNodeData(nodeId, {
        loading: true,
        error: undefined,
        response: undefined,
        status: "loading",
      });
      appendLog("info", `寮€濮嬫墽琛?[${node.title}]`);

      try {
        const result = await executor({ inputs, properties: node.properties, apiConfig });
        if (result.pending?.type === "remote-video") {
          const nextNodes = applyPendingRemoteVideoTaskSnapshot({
            nodes: currentNodesRef.current,
            nodeId,
            patch: {
              error: undefined,
              ...(result.patch || {}),
            },
          });
          currentNodesRef.current = nextNodes;
          setNodes(nextNodes);
          markRemoteDirty("content");
          markLocalRemotePersistPending({ nodes: nextNodes });
          syncCurrentWorkflowMeta((workflow) => ({
            ...workflow,
            summary: { ...workflow.summary, updatedAt: Date.now() },
            data: { ...workflow.data, nodes: nextNodes },
          }));
          appendLog("info", `[${node.title}] 视频任务已提交，正在后台生成`);
          return;
        }

        writeNodeOutput(nodeId, result.outputs);
        const patch: Record<string, unknown> = {
          loading: false,
          error: undefined,
          ...(result.patch || {}),
        };
        if (typeof result.outputs[0] === "string") patch.response = result.outputs[0];
        updateNodeData(nodeId, patch);
        appendLog("success", `[${node.title}] 瀹屾垚`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updateNodeData(nodeId, { loading: false, error: message, status: "error" });
        appendLog("error", `[${node.title}] 澶辫触:${message}`);
      }
    },
    [
      nodes,
      links,
      nodeOutputs,
      apiConfig,
      appendLog,
      updateNodeData,
      writeNodeOutput,
      collectTextNodeMediaReferences,
      markLocalRemotePersistPending,
      markRemoteDirty,
      syncCurrentWorkflowMeta,
    ]
  );

  useEffect(() => {
    const activeKeys = new Set<string>();

    const stopPoll = (key: string) => {
      const entry = remoteVideoPollsRef.current.get(key);
      if (!entry) return;
      entry.cancelled = true;
      if (entry.timeoutId !== undefined) window.clearTimeout(entry.timeoutId);
      remoteVideoPollsRef.current.delete(key);
    };

    nodes.forEach((node) => {
      if (!isPendingRemoteVideoNode(node)) return;
      const taskId = node.data?.remoteVideoTaskId?.trim();
      if (!taskId) return;
      const key = `${node.id}:${taskId}`;
      activeKeys.add(key);
      if (remoteVideoPollsRef.current.has(key)) return;

      const entry: { cancelled: boolean; timeoutId?: number } = { cancelled: false };
      remoteVideoPollsRef.current.set(key, entry);

      const poll = async () => {
        if (entry.cancelled) return;
        const latestNode = currentNodesRef.current.find((candidate) => candidate.id === node.id);
        if (
          !latestNode ||
          latestNode.data?.remoteVideoTaskId !== taskId ||
          !isPendingRemoteVideoNode(latestNode)
        ) {
          stopPoll(key);
          return;
        }

        try {
          const result = await queryRemoteVideoGenerationTask(taskId);
          const snapshot = applyRemoteVideoTaskResultSnapshot({
            nodes: currentNodesRef.current,
            nodeOutputs: currentNodeOutputsRef.current,
            nodeId: node.id,
            taskId,
            result,
          });

          currentNodesRef.current = snapshot.nodes;
          currentNodeOutputsRef.current = snapshot.nodeOutputs;
          setNodes(snapshot.nodes);
          setNodeOutputs(snapshot.nodeOutputs);
          syncCurrentWorkflowMeta((workflow) => ({
            ...workflow,
            summary: { ...workflow.summary, updatedAt: Date.now() },
            data: {
              ...workflow.data,
              nodes: snapshot.nodes,
              nodeOutputs: mapToOutputs(snapshot.nodeOutputs),
            },
          }));

          if (result.status === "success") {
            appendLog("success", `[${latestNode.title}] 视频生成完成`);
            stopPoll(key);
            return;
          }

          if (result.status === "error") {
            appendLog("error", `[${latestNode.title}] 视频生成失败:${result.error || "任务失败"}`);
            stopPoll(key);
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setNodes((prev) =>
            prev.map((candidate) =>
              candidate.id === node.id && candidate.data?.remoteVideoTaskId === taskId
                ? {
                    ...candidate,
                    data: {
                      ...(candidate.data || {}),
                      loading: true,
                      status: "loading",
                      loadingOperation: "generate",
                      remoteVideoTaskError: message,
                    },
                  }
                : candidate
            )
          );
        }

        if (!entry.cancelled) {
          entry.timeoutId = window.setTimeout(poll, REMOTE_VIDEO_POLL_INTERVAL_MS);
        }
      };

      void poll();
    });

    Array.from(remoteVideoPollsRef.current.keys() as Iterable<string>).forEach((key) => {
      if (!activeKeys.has(key)) stopPoll(key);
    });
  }, [appendLog, nodes, syncCurrentWorkflowMeta]);

  useEffect(() => {
    const pollMap = remoteVideoPollsRef.current;
    return () => {
      pollMap.forEach((entry) => {
        entry.cancelled = true;
        if (entry.timeoutId !== undefined) window.clearTimeout(entry.timeoutId);
      });
      pollMap.clear();
    };
  }, []);

  useEffect(() => {
    const activeKeys = new Set<string>();

    const stopPoll = (key: string) => {
      const entry = batchEditImagesPollsRef.current.get(key);
      if (!entry) return;
      entry.cancelled = true;
      if (entry.timeoutId !== undefined) window.clearTimeout(entry.timeoutId);
      batchEditImagesPollsRef.current.delete(key);
    };

    nodes.forEach((node) => {
      if (!isPendingBatchEditImagesNode(node)) return;
      const taskId = node.data?.batchReplacementTaskId?.trim();
      if (!taskId) return;
      const key = `${node.id}:${taskId}`;
      activeKeys.add(key);
      if (batchEditImagesPollsRef.current.has(key)) return;

      const entry: { cancelled: boolean; timeoutId?: number } = { cancelled: false };
      batchEditImagesPollsRef.current.set(key, entry);

      const poll = async () => {
        if (entry.cancelled) return;
        const latestNode = currentNodesRef.current.find((candidate) => candidate.id === node.id);
        if (
          !latestNode ||
          latestNode.data?.batchReplacementTaskId !== taskId ||
          !isPendingBatchEditImagesNode(latestNode)
        ) {
          stopPoll(key);
          return;
        }

        try {
          const result = await queryBatchEditImagesTask(taskId);
          const patchedNodes = applyBatchEditImagesTaskResultSnapshot({
            nodes: currentNodesRef.current,
            nodeId: node.id,
            taskId,
            result,
          });
          const syncedResultNodes = applyBatchEditImagesResultNodesSnapshot({
            batchNodeId: node.id,
            nodeOutputs: currentNodeOutputsRef.current,
            nodes: patchedNodes,
            result,
            runId: taskId,
          });
          const nextNodes = syncedResultNodes.nodes;
          const nextNodeOutputs = syncedResultNodes.nodeOutputs;

          currentNodesRef.current = nextNodes;
          currentNodeOutputsRef.current = nextNodeOutputs;
          setNodes(nextNodes);
          setNodeOutputs(nextNodeOutputs);
          syncCurrentWorkflowMeta((workflow) => ({
            ...workflow,
            summary: { ...workflow.summary, updatedAt: Date.now() },
            data: {
              ...workflow.data,
              nodes: nextNodes,
              nodeOutputs: mapToOutputs(nextNodeOutputs),
            },
          }));

          if (result.status === "success") {
            appendLog("success", `[${latestNode.title}] 批量替换完成`);
            stopPoll(key);
            return;
          }

          if (result.status === "error") {
            appendLog("error", `[${latestNode.title}] 批量替换失败:${result.error || "任务失败"}`);
            stopPoll(key);
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setNodes((prev) => {
            const nextNodes = prev.map((candidate) =>
              candidate.id === node.id && candidate.data?.batchReplacementTaskId === taskId
                ? {
                    ...candidate,
                    data: {
                      ...(candidate.data || {}),
                      loading: true,
                      status: "loading",
                      loadingOperation: "batch-replacement",
                      batchReplacementTaskError: message,
                    },
                  }
                : candidate
            );
            currentNodesRef.current = nextNodes;
            return nextNodes;
          });
        }

        if (!entry.cancelled) {
          entry.timeoutId = window.setTimeout(poll, REMOTE_VIDEO_POLL_INTERVAL_MS);
        }
      };

      void poll();
    });

    Array.from(batchEditImagesPollsRef.current.keys() as Iterable<string>).forEach((key) => {
      if (!activeKeys.has(key)) stopPoll(key);
    });
  }, [appendLog, nodes, syncCurrentWorkflowMeta]);

  useEffect(() => {
    const pollMap = batchEditImagesPollsRef.current;
    return () => {
      pollMap.forEach((entry) => {
        entry.cancelled = true;
        if (entry.timeoutId !== undefined) window.clearTimeout(entry.timeoutId);
      });
      pollMap.clear();
    };
  }, []);

  const runGroup = useCallback(
    async (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const memberIds = new Set(nodes.filter((n) => n.groupId === groupId).map((n) => n.id));
      if (memberIds.size === 0) {
        appendLog("warning", `Group "${group.title}" has no nodes.`);
        return;
      }
      appendLog("info", `寮€濮嬩竴閿噸璺戠粍 "${group.title}" (${memberIds.size} 鑺傜偣)`);
      setIsRunning(true);
      try {
        for (const id of memberIds) {
          await runNode(id);
        }
        appendLog("success", `Group "${group.title}" rerun completed.`);
      } finally {
        setIsRunning(false);
      }
    },
    [groups, nodes, runNode, appendLog]
  );

  const runWorkflow = useCallback(async () => {
    if (isRunning) return;
    if (!nodes.length) {
      appendLog("warning", "There are no runnable nodes.");
      return;
    }

    const { levels, hasCycle, cyclePath } = topologicalLevels(nodes, links);
    if (hasCycle) {
      appendLog(
        "error",
        `椤圭洰瀛樺湪寰幆渚濊禆,鏃犳硶鎵ц銆傛秹鍙婅妭鐐?${cyclePath.join(", ")}`
      );
      return;
    }

    setIsRunning(true);
    setNodeOutputs(new Map());
    appendLog(
      "info",
      `Running project "${currentWorkflowSummary?.name ?? ""}" with ${nodes.length} nodes across ${levels.length} levels.`
    );

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      appendLog(
        "info",
        `绗?${i + 1}/${levels.length} 灞?(${level.length} 涓妭鐐瑰苟鍙? 鈥?[${level.map((n) => n.title).join(", ")}]`
      );
      await Promise.all(level.map((node) => runNode(node.id)));
    }

    appendLog("success", "Project run completed.");
    setIsRunning(false);
  }, [nodes, links, isRunning, runNode, appendLog, currentWorkflowSummary]);

  const clearExecution = useCallback(() => {
    setNodeOutputs(new Map());
    nodes.forEach((n) => updateNodeData(n.id, { loading: false, error: undefined }));
  }, [nodes, updateNodeData]);

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.pointer <= 0) return prev;
      const target = prev.stack[prev.pointer - 1];
      const nextNodes = normalizeNodes(target.nodes);
      setNodes(nextNodes);
      setLinks(target.links);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodes, links: target.links },
      }));
      appendLog("info", `宸叉挙閿€ (${prev.pointer} 鈫?${prev.pointer - 1})`);
      return { ...prev, pointer: prev.pointer - 1 };
    });
  }, [appendLog, syncCurrentWorkflowMeta]);

  const redo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.pointer >= prev.stack.length - 1) return prev;
      const target = prev.stack[prev.pointer + 1];
      const nextNodes = normalizeNodes(target.nodes);
      setNodes(nextNodes);
      setLinks(target.links);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodes, links: target.links },
      }));
      appendLog("info", `宸查噸鍋?(${prev.pointer} 鈫?${prev.pointer + 1})`);
      return { ...prev, pointer: prev.pointer + 1 };
    });
  }, [appendLog, syncCurrentWorkflowMeta]);

  const createWorkflow = useCallback(
    (name?: string): WorkflowSummary => {
      const wf = makeEmptyWorkflow(
        name?.trim() || `椤圭洰 ${Object.keys(workspace.workflows).length + 1}`
      );
      setWorkspace((prev) => ({
        ...prev,
        workflows: { ...prev.workflows, [wf.summary.id]: wf },
      }));
      appendLog("success", `宸叉柊寤洪」鐩?"${wf.summary.name}"`);
      return wf.summary;
    },
    [appendLog, workspace.workflows]
  );

  const createWorkflowFromTemplate = useCallback(
    (templateId: string, customName?: string): WorkflowSummary | null => {
      const tmpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!tmpl) {
        appendLog("warning", `Template "${templateId}" was not found.`);
        return null;
      }
      const wfId = makeId("wf");
      const now = Date.now();
      const nodeIds: string[] = [];
      const nodes: GraphNode[] = normalizeNodes(
        tmpl.nodes.map((n) => {
          const nodeId = makeId("node");
          nodeIds.push(nodeId);
          const base = createNodeFromType(n.type, nodeId, n.x, n.y);
          if (n.defaultProperties) {
            base.properties = { ...base.properties, ...n.defaultProperties };
          }
          return base;
        })
      );
      const links: GraphLink[] = tmpl.links.map((l) => ({
        id: makeId("link"),
        fromNodeId: nodeIds[l.fromNodeIndex],
        fromOutputIndex: l.fromOutputIndex,
        toNodeId: nodeIds[l.toNodeIndex],
        toInputIndex: l.toInputIndex,
      }));
      const outputsMap = new Map<string, Map<number, unknown>>();
      if (tmpl.defaultOutputs) {
        for (const { nodeIdx, outputIdx, value } of tmpl.defaultOutputs) {
          const targetNodeId = nodeIds[nodeIdx];
          if (!targetNodeId) continue;
          let inner = outputsMap.get(targetNodeId);
          if (!inner) {
            inner = new Map();
            outputsMap.set(targetNodeId, inner);
          }
          inner.set(outputIdx, value);
        }
      }
      for (const [targetNodeId, inner] of outputsMap) {
        const first = inner.get(0);
        if (typeof first === "string") {
          const node = nodes.find((n) => n.id === targetNodeId);
          if (node) node.data = { ...(node.data || {}), response: first, loading: false };
        }
      }
      const wf: Workflow = {
        summary: {
          id: wfId,
          name: customName?.trim() || `${tmpl.name} (妯℃澘)`,
          category: tmpl.category,
          tags: ["妯℃澘", tmpl.category],
          sortIndex: now,
          createdAt: now,
          updatedAt: now,
        },
        data: {
          nodes,
          links,
          nodeOutputs: Array.from(outputsMap.entries()).map(([k, v]) => [
            k,
            Array.from(v.entries()),
          ]),
        },
      };
      setWorkspace((prev) => ({ ...prev, workflows: { ...prev.workflows, [wfId]: wf } }));
      setNodes(nodes);
      setLinks(links);
      setNodeOutputs(outputsMap);
      setSelectedNodeId(null);
      clearLinkDraft();
      resetHistory({ nodes, links });
      appendLog(
        "success",
        `宸蹭粠妯℃澘 "${tmpl.name}" 鍒涘缓椤圭洰 (${nodes.length} 鑺傜偣, ${links.length} 杩炵嚎, 鍒嗙被 "${tmpl.category}", 棰勫～ ${outputsMap.size} 涓崰浣嶇粨鏋?`
      );
      return wf.summary;
    },
    [appendLog, clearLinkDraft, resetHistory]
  );

  const resetCurrentToDemo = useCallback(
    (templateId: string): boolean => {
      const tmpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!tmpl) {
        appendLog("warning", `Template "${templateId}" was not found.`);
        return false;
      }
      if (!workspace.workflows[workspace.currentId]) {
        appendLog("warning", "褰撳墠娌℃湁鍙噸缃殑椤圭洰");
        return false;
      }
      const now = Date.now();
      const nodeIds: string[] = [];
      const nodes: GraphNode[] = normalizeNodes(
        tmpl.nodes.map((n) => {
          const nodeId = makeId("node");
          nodeIds.push(nodeId);
          const base = createNodeFromType(n.type, nodeId, n.x, n.y);
          if (n.defaultProperties) {
            base.properties = { ...base.properties, ...n.defaultProperties };
          }
          return base;
        })
      );
      const links: GraphLink[] = tmpl.links.map((l) => ({
        id: makeId("link"),
        fromNodeId: nodeIds[l.fromNodeIndex],
        fromOutputIndex: l.fromOutputIndex,
        toNodeId: nodeIds[l.toNodeIndex],
        toInputIndex: l.toInputIndex,
      }));
      const outputsMap = new Map<string, Map<number, unknown>>();
      if (tmpl.defaultOutputs) {
        for (const { nodeIdx, outputIdx, value } of tmpl.defaultOutputs) {
          const targetNodeId = nodeIds[nodeIdx];
          if (!targetNodeId) continue;
          let inner = outputsMap.get(targetNodeId);
          if (!inner) {
            inner = new Map();
            outputsMap.set(targetNodeId, inner);
          }
          inner.set(outputIdx, value);
        }
      }
      for (const [targetNodeId, inner] of outputsMap) {
        const first = inner.get(0);
        if (typeof first === "string") {
          const node = nodes.find((n) => n.id === targetNodeId);
          if (node) node.data = { ...(node.data || {}), response: first, loading: false };
        }
      }
      setWorkspace((prev) => {
        const cur = prev.workflows[prev.currentId];
        if (!cur) return prev;
        const updated: Workflow = {
          ...cur,
          summary: {
            ...cur.summary,
            category: tmpl.category,
            tags: ["妯℃澘", tmpl.category],
            updatedAt: now,
          },
          data: {
            nodes: nodes.map((n) => ({ ...n })),
            links: links.map((l) => ({ ...l })),
            nodeOutputs: Array.from(outputsMap.entries()).map(([k, v]) => [
              k,
              Array.from(v.entries()),
            ]),
          },
        };
        return { ...prev, workflows: { ...prev.workflows, [prev.currentId]: updated } };
      });
      setNodes(nodes.map((n) => ({ ...n })));
      setLinks(links.map((l) => ({ ...l })));
      setNodeOutputs(new Map(outputsMap));
      setSelectedNodeId(null);
      clearLinkDraft();
      resetHistory({ nodes, links });
      appendLog(
        "success",
        `宸查噸缃綋鍓嶇敾甯冧负 demo "${tmpl.name}" (${nodes.length} 鑺傜偣, ${links.length} 杩炵嚎, 棰勫～ ${outputsMap.size} 涓崰浣嶇粨鏋?`
      );
      return true;
    },
    [workspace, appendLog, clearLinkDraft, resetHistory]
  );

  const switchWorkflow = useCallback(
    (id: string): boolean => {
      if (!workspace.workflows[id]) {
        appendLog("warning", `Project ${id} was not found.`);
        return false;
      }
      if (id === workspace.currentId) {
        appendLog("info", `宸插湪椤圭洰 "${workspace.workflows[id].summary.name}"`);
        return true;
      }
      setWorkspace((prev) => {
        const target = prev.workflows[id];
        if (!target) return prev;
        const nextNodes = normalizeNodes(target.data.nodes);
        setNodes(nextNodes);
        setLinks(target.data.links);
        setNodeOutputs(outputsToMap(target.data.nodeOutputs));
        setSelectedNodeId(null);
        clearLinkDraft();
        resetHistory({ nodes: nextNodes, links: target.data.links });
        appendLog(
          "info",
          `宸插垏鎹㈠埌椤圭洰 "${target.summary.name}" (${nextNodes.length} 鑺傜偣, ${target.data.links.length} 杩炵嚎)`
        );
        return { ...prev, currentId: id };
      });
      return true;
    },
    [workspace, appendLog, clearLinkDraft, resetHistory]
  );

  const renameWorkflow = useCallback(
    (id: string, name: string): boolean => {
      const trimmed = name.trim();
      if (!trimmed) {
        appendLog("warning", "椤圭洰鍚嶇О涓嶈兘涓虹┖");
        return false;
      }
      if (!workspace.workflows[id]) return false;
      setWorkspace((prev) => {
        const wf = prev.workflows[id];
        const updated: Workflow = {
          ...wf,
          summary: { ...wf.summary, name: trimmed, updatedAt: Date.now() },
        };
        return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
      });
      appendLog("success", `宸查噸鍛藉悕涓?"${trimmed}"`);
      return true;
    },
    [workspace, appendLog]
  );

  const setWorkflowCategory = useCallback(
    (id: string, category: string): boolean => {
      if (!workspace.workflows[id]) return false;
      const trimmed = category.trim();
      setWorkspace((prev) => {
        const wf = prev.workflows[id];
        const updated: Workflow = {
          ...wf,
          summary: {
            ...wf.summary,
            category: trimmed || undefined,
            updatedAt: Date.now(),
          },
        };
        return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
      });
      return true;
    },
    [workspace]
  );

  const addTagToWorkflow = useCallback(
    (id: string, tag: string): boolean => {
      const trimmed = tag.trim();
      if (!trimmed) {
        appendLog("warning", "鏍囩涓嶈兘涓虹┖");
        return false;
      }
      if (!workspace.workflows[id]) return false;
      const wf = workspace.workflows[id];
      const existing = wf.summary.tags ?? [];
      if (existing.includes(trimmed)) return false;
      setWorkspace((prev) => {
        const target = prev.workflows[id];
        if (!target) return prev;
        const updated: Workflow = {
          ...target,
          summary: {
            ...target.summary,
            tags: [...(target.summary.tags ?? []), trimmed],
            updatedAt: Date.now(),
          },
        };
        return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
      });
      return true;
    },
    [workspace, appendLog]
  );

  const removeTagFromWorkflow = useCallback(
    (id: string, tag: string): boolean => {
      if (!workspace.workflows[id]) return false;
      setWorkspace((prev) => {
        const target = prev.workflows[id];
        if (!target) return prev;
        const updated: Workflow = {
          ...target,
          summary: {
            ...target.summary,
            tags: (target.summary.tags ?? []).filter((t) => t !== tag),
            updatedAt: Date.now(),
          },
        };
        return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
      });
      return true;
    },
    [workspace]
  );

  const moveWorkflow = useCallback(
    (sourceId: string, targetId: string, position: "before" | "after" = "before"): boolean => {
      if (sourceId === targetId) return false;
      if (!workspace.workflows[sourceId] || !workspace.workflows[targetId]) return false;

      const sortedIds = (Object.values(workspace.workflows) as Workflow[])
        .map((w) => w.summary)
        .sort((a, b) => b.sortIndex - a.sortIndex)
        .map((s) => s.id);
      const fromIdx = sortedIds.indexOf(sourceId);
      const toIdx = sortedIds.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return false;

      const reordered = [...sortedIds];
      reordered.splice(fromIdx, 1);
      const newToIdx = reordered.indexOf(targetId);
      const insertIdx = position === "before" ? newToIdx : newToIdx + 1;
      reordered.splice(insertIdx, 0, sourceId);

      const step = 1000;
      const now = Date.now();
      const next: Record<string, Workflow> = { ...workspace.workflows };
      reordered.forEach((id, idx) => {
        const wf = next[id];
        if (!wf) return;
        const newSortIndex = (reordered.length - idx) * step + Math.floor(now / 1e9);
        if (wf.summary.sortIndex !== newSortIndex) {
          next[id] = {
            ...wf,
            summary: { ...wf.summary, sortIndex: newSortIndex, updatedAt: Date.now() },
          };
        }
      });
      setWorkspace((prev) => ({ ...prev, workflows: { ...next } }));
      return true;
    },
    [workspace]
  );

  const deleteWorkflow = useCallback(
    (id: string): boolean => {
      if (!workspace.workflows[id]) return false;
      if (workspace.workflows[id].summary.deletedAt) return false;
      const removed = workspace.workflows[id];
      const remaining = (Object.values(workspace.workflows) as Workflow[]).filter(
        (w) => w.summary.id !== id
      );
      if (remaining.length === 0) {
        appendLog("warning", "At least one project must remain.");
        return false;
      }
      const wasCurrent = id === workspace.currentId;
      const nextCurrentId = wasCurrent
        ? remaining.sort((a, b) => b.summary.updatedAt - a.summary.updatedAt)[0].summary.id
        : workspace.currentId;
      const now = Date.now();
      const tombstoned: Workflow = {
        ...removed,
        summary: { ...removed.summary, deletedAt: now, updatedAt: now },
      };
      setWorkspace((prev) => {
        const next = { ...prev.workflows };
        delete next[id];
        return {
          ...prev,
          workflows: next,
          trash: [tombstoned, ...prev.trash.filter((w) => w.summary.id !== id)],
          currentId: nextCurrentId,
        };
      });
      if (wasCurrent) {
        const nextWf = workspace.workflows[nextCurrentId];
        const nextNodes = normalizeNodes(nextWf.data.nodes);
        setNodes(nextNodes);
        setLinks(nextWf.data.links);
        setNodeOutputs(outputsToMap(nextWf.data.nodeOutputs));
        setSelectedNodeId(null);
        clearLinkDraft();
        resetHistory({ nodes: nextNodes, links: nextWf.data.links });
      }
      appendLog("warning", `宸茬Щ鑷冲洖鏀剁珯 "${removed.summary.name}"`);
      return true;
    },
    [workspace, appendLog, clearLinkDraft, resetHistory]
  );

  const restoreWorkflow = useCallback(
    (id: string): boolean => {
      const src = workspace.trash.find((w) => w.summary.id === id);
      if (!src) return false;
      if (workspace.workflows[id]) {
        appendLog("warning", `椤圭洰 "${src.summary.name}" 宸插瓨鍦?鏃犳硶杩樺師`);
        return false;
      }
      const now = Date.now();
      const restored: Workflow = {
        ...src,
        summary: { ...src.summary, deletedAt: undefined, updatedAt: now },
      };
      setWorkspace((prev) => ({
        ...prev,
        workflows: { ...prev.workflows, [id]: restored },
        trash: prev.trash.filter((w) => w.summary.id !== id),
      }));
      appendLog("success", `宸茶繕鍘?"${src.summary.name}"`);
      return true;
    },
    [workspace, appendLog]
  );

  const purgeWorkflow = useCallback(
    (id: string): boolean => {
      const src = workspace.trash.find((w) => w.summary.id === id);
      if (!src) return false;
      setWorkspace((prev) => ({
        ...prev,
        trash: prev.trash.filter((w) => w.summary.id !== id),
      }));
      appendLog("warning", `宸叉案涔呭垹闄?"${src.summary.name}"`);
      return true;
    },
    [workspace, appendLog]
  );

  const emptyTrash = useCallback((): number => {
    const count = workspace.trash.length;
    if (count === 0) return 0;
    setWorkspace((prev) => ({ ...prev, trash: [] }));
    appendLog("warning", `宸叉竻绌哄洖鏀剁珯 (${count} 涓」鐩姘镐箙鍒犻櫎)`);
    return count;
  }, [workspace, appendLog]);

  const purgeExpiredTrash = useCallback((): number => {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const expired = workspace.trash.filter((w) => (w.summary.deletedAt ?? 0) < cutoff);
    if (expired.length === 0) return 0;
    const expiredIds = new Set(expired.map((w) => w.summary.id));
    setWorkspace((prev) => ({
      ...prev,
      trash: prev.trash.filter((w) => !expiredIds.has(w.summary.id)),
    }));
    appendLog(
      "warning",
      `Trash cleanup removed ${expired.length} expired projects older than ${TRASH_RETENTION_DAYS} days${
        expired.length > 0
          ? ` ("${expired
              .slice(0, 3)
              .map((w) => w.summary.name)
              .join('", "')}${expired.length > 3 ? '" etc.' : '"'})`
          : ""
      }`
    );
    return expired.length;
  }, [workspace, appendLog]);

  const duplicateWorkflow = useCallback(
    (id: string): WorkflowSummary | null => {
      const src = workspace.workflows[id];
      if (!src) return null;
      const now = Date.now();
      const wf: Workflow = {
        summary: {
          id: makeId("wf"),
          name: `${src.summary.name} - 鍓湰`,
          category: src.summary.category,
          tags: [...(src.summary.tags ?? [])],
          sortIndex: now,
          createdAt: now,
          updatedAt: now,
        },
        data: {
          nodes: src.data.nodes.map((n) => ({ ...n, id: makeId("node") })),
          links: [],
          nodeOutputs: [],
        },
      };
      const oldToNew = new Map<string, string>();
      src.data.nodes.forEach((n, i) => oldToNew.set(n.id, wf.data.nodes[i].id));
      wf.data.links = src.data.links
        .filter((l) => oldToNew.has(l.fromNodeId) && oldToNew.has(l.toNodeId))
        .map((l) => ({
          ...l,
          id: makeId("link"),
          fromNodeId: oldToNew.get(l.fromNodeId)!,
          toNodeId: oldToNew.get(l.toNodeId)!,
        }));
      setWorkspace((prev) => ({
        ...prev,
        workflows: { ...prev.workflows, [wf.summary.id]: wf },
      }));
      appendLog(
        "success",
        `宸插鍒朵负鏂伴」鐩?"${wf.summary.name}" (${wf.data.nodes.length} 鑺傜偣)`
      );
      return wf.summary;
    },
    [workspace, appendLog]
  );

  const exportWorkspaceJson = useCallback((): string => {
    return JSON.stringify(workspace, null, 2);
  }, [workspace]);

  const importWorkspaceJson = useCallback(
    (
      json: string,
      options: { includeTrash?: boolean; renameConflicts?: boolean } = {}
    ): { imported: number; skipped: number; renamed: number; errors: string[] } => {
      const { includeTrash = true, renameConflicts = true } = options;
      const result = { imported: 0, skipped: 0, renamed: 0, errors: [] };
      let parsed: any;
      try {
        parsed = JSON.parse(json);
      } catch (err) {
        result.errors.push(`JSON 瑙ｆ瀽澶辫触:${err instanceof Error ? err.message : String(err)}`);
        return result;
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.workflows ||
        typeof parsed.workflows !== "object"
      ) {
        result.errors.push("鏂囦欢鏍煎紡鏃犳晥:缂哄皯 workflows 瀛楁");
        return result;
      }
      const incoming = parsed.workflows as Record<string, Workflow>;
      const incomingTrash: Workflow[] = Array.isArray(parsed.trash)
        ? (parsed.trash as Workflow[])
        : [];

      setWorkspace((prev) => {
        const merged: Record<string, Workflow> = { ...prev.workflows };
        for (const [id, wf] of Object.entries(incoming)) {
          if (!wf || !wf.summary || !wf.data) {
            result.skipped++;
            continue;
          }
          if (merged[id]) {
            if (!renameConflicts) {
              result.skipped++;
              continue;
            }
            const newId = makeId("wf");
            const oldToNewNode = new Map<string, string>();
            const remappedNodes = wf.data.nodes.map((n) => {
              const newNodeId = makeId("node");
              oldToNewNode.set(n.id, newNodeId);
              return { ...n, id: newNodeId };
            });
            const remappedLinks = wf.data.links
              .filter((l) => oldToNewNode.has(l.fromNodeId) && oldToNewNode.has(l.toNodeId))
              .map((l) => ({
                ...l,
                id: makeId("link"),
                fromNodeId: oldToNewNode.get(l.fromNodeId)!,
                toNodeId: oldToNewNode.get(l.toNodeId)!,
              }));
            merged[newId] = {
              ...wf,
              summary: {
                ...wf.summary,
                id: newId,
                name: `${wf.summary.name} (瀵煎叆)`,
                updatedAt: Date.now(),
              },
              data: { ...wf.data, nodes: remappedNodes, links: remappedLinks, nodeOutputs: [] },
            };
            result.renamed++;
            result.imported++;
          } else {
            merged[id] = wf;
            result.imported++;
          }
        }
        const mergedTrash = includeTrash
          ? [...incomingTrash.filter((w) => w && w.summary && w.data), ...prev.trash]
          : prev.trash;
        return { ...prev, workflows: merged, trash: mergedTrash };
      });
      return result;
    },
    []
  );

  const getWorkspaceSnapshot = useCallback((): Workspace => workspace, [workspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasPendingRuntimeState = nodes.some(
        (node) => hasNodeRuntimeState(node) && !isPendingRemoteVideoNode(node)
      );
      if (hasPendingRuntimeState) return;
      const persistableNodes = sanitizeNodesRuntimeState(nodes);
      const nextData = {
        nodes: persistableNodes,
        links,
        nodeOutputs: mapToOutputs(nodeOutputs),
        groups,
      };

      setWorkspace((prev) => {
        const cur = prev.workflows[prev.currentId];
        if (!cur) return prev;
        return {
          ...prev,
          workflows: {
            ...prev.workflows,
            [prev.currentId]: {
              ...cur,
              data: nextData,
              summary: { ...cur.summary, updatedAt: Date.now() },
            },
          },
        };
      });

      if (isRemoteMode) {
        if (!onRemotePersist) return;
        if (skipNextRemotePersistRef.current) {
          skipNextRemotePersistRef.current = false;
          return;
        }
        if (!currentWorkflowSummary?.id) return;

        const persistSignature = serializeRemotePersistSnapshot({
          workflowId: currentWorkflowSummary.id,
          name: currentWorkflowSummary.name,
          category: currentWorkflowSummary.category,
          tags: currentWorkflowSummary.tags ?? [],
          nodes: persistableNodes,
          links,
          nodeOutputs,
          groups,
        });
        const projectSnapshot = buildRemoteProjectSnapshot(currentWorkflowSummary, {
          ...nextData,
        });
        const persistKey = getRemotePersistKey?.(projectSnapshot) ?? persistSignature;
        if (persistKey === lastRemotePersistSignatureRef.current) return;
        if (persistKey === inFlightRemotePersistKeyRef.current) return;
        if (
          shouldDeferRemoteSnapshotForInFlight({
            inFlightKey: inFlightRemotePersistKeyRef.current,
            nextKey: persistKey,
          })
        ) {
          deferredRemotePersistRef.current = true;
          return;
        }
        const dirtyKind =
          remoteDirtyKindRef.current === "none" ? "content" : remoteDirtyKindRef.current;
        const now = Date.now();
        if (
          !shouldPersistRemoteSnapshot({
            dirtyKind,
            hasPendingRuntimeState,
            lastPersistedAt: lastRemotePersistedAtRef.current,
            lastSignature: lastRemotePersistSignatureRef.current,
            now,
            nextSignature: persistKey,
          })
        ) {
          if (dirtyKind === "position" && lastRemotePersistedAtRef.current > 0) {
            const retryDelay = Math.max(
              0,
              REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS - (now - lastRemotePersistedAtRef.current)
            );
            remotePersistRetryTimeoutRef.current = window.setTimeout(() => {
              remotePersistRetryTimeoutRef.current = null;
              setRemotePersistRetryTick((tick) => tick + 1);
            }, retryDelay);
          }
          return;
        }

        pendingLocalPersistSignatureRef.current = persistSignature;
        inFlightRemotePersistKeyRef.current = persistKey;

        void Promise.resolve(onRemotePersist(projectSnapshot))
          .then(() => {
            if (inFlightRemotePersistKeyRef.current !== persistKey) return;
            inFlightRemotePersistKeyRef.current = "";
            lastRemotePersistSignatureRef.current = persistKey;
            lastRemotePersistedAtRef.current = Date.now();
            if (pendingLocalPersistSignatureRef.current === persistSignature) {
              pendingLocalPersistSignatureRef.current = "";
            }
            remoteDirtyKindRef.current = "none";
            if (deferredRemotePersistRef.current) {
              deferredRemotePersistRef.current = false;
              setRemotePersistRetryTick((tick) => tick + 1);
            }
          })
          .catch((error) => {
            if (inFlightRemotePersistKeyRef.current === persistKey) {
              inFlightRemotePersistKeyRef.current = "";
            }
            console.warn("Failed to persist remote canvas", error);
            deferredRemotePersistRef.current = false;
            setRemotePersistRetryTick((tick) => tick + 1);
          });
        return;
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      if (remotePersistRetryTimeoutRef.current !== null) {
        window.clearTimeout(remotePersistRetryTimeoutRef.current);
        remotePersistRetryTimeoutRef.current = null;
      }
    };
  }, [
    currentWorkflowSummary,
    groups,
    isRemoteMode,
    links,
    nodeOutputs,
    getRemotePersistKey,
    nodes,
    onRemotePersist,
    remotePersistRetryTick,
  ]);

  useEffect(() => {
    if (isRemoteMode) return;
    purgeExpiredTrash();
    const intervalId = window.setInterval(purgeExpiredTrash, TRASH_PURGE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isRemoteMode, purgeExpiredTrash]);

  return {
    nodes,
    links,
    groups,
    setGroups,
    selectedNodeId,
    selectedNode,
    logs,
    linkFromNodeId,
    linkToNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkDraftIssue,
    nodeOutputs,
    resolvedInputsMap,
    isRunning,
    canUndo,
    canRedo,
    workspace,
    workflowList,
    trashList,
    currentWorkflowSummary,
    allCategories,
    allTags,
    setSelectedNodeId,
    setLinkFromNodeId,
    setLinkToNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    clearLinkDraft,
    addNode,
    createImagePromptStarter,
    createTextNodeStarterFlow,
    syncImagePromptStarterLayout,
    removeNode,
    removeNodes,
    duplicateNode,
    insertNodesAndLinks,
    updateNodePosition,
    updateNodePositions,
    layoutNodePositions,
    updateNodeProperty,
    updateNodeData,
    setPrimaryImageResult,
    extractFrameImageNode,
    createVideoFrameImageNode,
    completeVideoFrameImageNode,
    failVideoFrameImageNode,
    replaceExtractedFrameImage,
    replaceFrameImageUrl,
    addVideoFrameAnalysis,
    addVideoBatchReplacementNode,
    createVideoBatchReplacementResultRun,
    addVideoPromptTextNode,
    clearCanvas,
    clearExecution,
    addLinkFromDraft,
    addLinksFromDrafts,
    addLink,
    removeLink,
    removeInputReference,
    updateSelectedProperty,
    createGroup,
    ungroup,
    updateGroup,
    resizeGroup,
    runGroup,
    runNode,
    runWorkflow,
    undo,
    redo,
    createWorkflow,
    createWorkflowFromTemplate,
    resetCurrentToDemo,
    switchWorkflow,
    renameWorkflow,
    setWorkflowCategory,
    addTagToWorkflow,
    removeTagFromWorkflow,
    moveWorkflow,
    deleteWorkflow,
    duplicateWorkflow,
    restoreWorkflow,
    purgeWorkflow,
    emptyTrash,
    purgeExpiredTrash,
    exportWorkspaceJson,
    importWorkspaceJson,
    getWorkspaceSnapshot,
  };
}
