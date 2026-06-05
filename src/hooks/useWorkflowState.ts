import { useCallback, useEffect, useMemo, useState } from "react";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import { getExecutor } from "../features/nodes/nodeExecutors";
import { WORKFLOW_TEMPLATES } from "../features/templates/workflowTemplates";
import { ExecutionLog, GraphLink, GraphNode, NodeClass, VideoFrameAnalysisOverview, VideoFrameAnalysisSegment, VideoSegmentTextAnalysis } from "../types";
import { IMAGE_PROMPT_STARTER_GAP_X, getImagePromptStarterTextNodeX } from "../utils/imagePromptStarterLayout";
import { findFirstCompatibleInputIndex, getLinkDraftIssue, isDataTypeCompatible } from "../utils/linking";
import { sanitizeWorkspaceForStorage } from "../utils/workspaceStorage";
import { NodeOutputMap, buildResolvedInputsMap, resolveNodeInputs, topologicalLevels } from "../runtime/dataflow";

const STORAGE_KEY = "aicanvas_workspace_v2";
const HISTORY_LIMIT = 50;
const PERSIST_DEBOUNCE_MS = 800;
const DEFAULT_WORKFLOW_NAME = "默认项目";
const WORKSPACE_VERSION = 2 as const;
const WORKSPACE_LEGACY_VERSIONS = [1] as const;
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 86_400_000;
const TRASH_PURGE_INTERVAL_MS = 60 * 60 * 1000;
const VIDEO_IMAGE_INPUT = { name: "image", type: "IMAGE" as const };
const MINIMAX_IMAGE_RATIOS = new Set(["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"]);
const IMAGE_NODE_MODEL_FALLBACKS = new Set(["", "lib-navo-pro", "flux-1", "sdxl", "midjourney"]);
const TEXT_NODE_MODEL_FALLBACKS = new Set(["", "deepseek-v4-flash"]);
const FRAME_IMAGE_MAX_WIDTH = 520;
const FRAME_IMAGE_MAX_HEIGHT = 390;
const IMAGE_PROMPT_PLACEHOLDER_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1152' height='864' viewBox='0 0 1152 864'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23131d2a'/%3E%3Cstop offset='1' stop-color='%230c1018'/%3E%3C/linearGradient%3E%3CradialGradient id='glow' cx='50%25' cy='40%25' r='55%25'%3E%3Cstop stop-color='%238b5cf6' stop-opacity='.32'/%3E%3Cstop offset='1' stop-color='%238b5cf6' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='1152' height='864' rx='44' fill='url(%23bg)'/%3E%3Crect width='1152' height='864' rx='44' fill='url(%23glow)'/%3E%3Cg fill='none' stroke='%23c4b5fd' stroke-width='24' stroke-linecap='round' stroke-linejoin='round' opacity='.72'%3E%3Crect x='420' y='284' width='312' height='236' rx='28'/%3E%3Ccircle cx='512' cy='376' r='34'/%3E%3Cpath d='M444 488l92-92 66 66 42-42 64 68'/%3E%3C/g%3E%3Ctext x='576' y='602' fill='%23e9d5ff' font-family='Arial, sans-serif' font-size='38' font-weight='700' text-anchor='middle'%3E添加参考图%3C/text%3E%3Ctext x='576' y='654' fill='%2394a3b8' font-family='Arial, sans-serif' font-size='24' text-anchor='middle'%3E连接到文本节点后生成图片反推提示词%3C/text%3E%3C/svg%3E";
const IMAGE_PROMPT_DEFAULT_TEXT =
  "根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言与风格关键词。";
const IMAGE_PROMPT_STARTER_IMAGE_OFFSET_X = 680;
const IMAGE_PROMPT_STARTER_IMAGE_OFFSET_Y = 56;

function getImagePromptStarterFocusBounds(textNode: GraphNode, imageNodeX: number, imageNodeY: number) {
  return {
    minX: imageNodeX - 18,
    minY: Math.min(textNode.y - 18, imageNodeY - 24),
    maxX: textNode.x + 428,
    maxY: Math.max(textNode.y + 620, imageNodeY + 556),
  };
}

function fitFrameImageSize(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(FRAME_IMAGE_MAX_WIDTH / safeWidth, FRAME_IMAGE_MAX_HEIGHT / safeHeight, 1);
  return {
    width: Math.round(safeWidth * scale),
    height: Math.round(safeHeight * scale),
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

function migrateProjectName(name: string): string {
  if (name === "默认工作流") return "默认项目";
  const generatedName = name.match(/^工作流\s+(\d+)$/);
  if (generatedName) return `项目 ${generatedName[1]}`;
  return name;
}

function migrateProjectWorkflow(wf: Workflow): Workflow {
  return {
    ...wf,
    summary: {
      ...wf.summary,
      name: migrateProjectName(wf.summary.name),
    },
  };
}

function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Workspace;
      if (parsed && parsed.workflows && parsed.currentId) {
        if (parsed.version === WORKSPACE_VERSION && parsed.workflows[parsed.currentId]) {
          const migrated: Workspace = {
            ...parsed,
            trash: Array.isArray(parsed.trash) ? parsed.trash.map(migrateProjectWorkflow) : [],
            workflows: backfillSortIndex(parsed.workflows),
          };
          return migrated;
        }
        if (WORKSPACE_LEGACY_VERSIONS.includes(parsed.version as 1) && parsed.workflows[parsed.currentId]) {
          return {
            version: WORKSPACE_VERSION,
            currentId: parsed.currentId,
            workflows: backfillSortIndex(parsed.workflows),
            trash: [],
          };
        }
      }
    }
  } catch {
    // fall through
  }
  return makeWorkspace();
}

function backfillSortIndex(workflows: Record<string, Workflow>): Record<string, Workflow> {
  const out: Record<string, Workflow> = {};
  let i = 0;
  (Object.values(workflows) as Workflow[])
    .sort((a, b) => b.summary.updatedAt - a.summary.updatedAt)
    .forEach((wf) => {
      const step = 1000;
      i += 1;
      out[wf.summary.id] = {
        ...migrateProjectWorkflow(wf),
        summary: {
          ...wf.summary,
          name: migrateProjectName(wf.summary.name),
          tags: wf.summary.tags ?? [],
          sortIndex: typeof wf.summary.sortIndex === "number" ? wf.summary.sortIndex : i * step,
        },
      };
    });
  return out;
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

function normalizeNodePorts(node: GraphNode): GraphNode {
  let nextNode = node;
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
    if (TEXT_NODE_MODEL_FALLBACKS.has(model) || inputsChanged) {
      nextNode = {
        ...nextNode,
        inputs: normalizedInputs,
        properties: {
          ...nextNode.properties,
          model: TEXT_NODE_MODEL_FALLBACKS.has(model) ? "deepseek-chat" : model,
        },
      };
    }
  }

  if (nextNode.type === "image_node") {
    const aspectRatio = String(nextNode.properties.aspect_ratio || "16:9");
    const model = String(nextNode.properties.model || "");
    nextNode = {
      ...nextNode,
      properties: {
        ...nextNode.properties,
        model: IMAGE_NODE_MODEL_FALLBACKS.has(model) ? "image-01" : model,
        aspect_ratio: MINIMAX_IMAGE_RATIOS.has(aspectRatio) ? aspectRatio : "16:9",
        quantity: "1张",
        n: 1,
        prompt_optimizer: false,
      },
    };
  }

  if (nextNode.type !== "video_node" || nextNode.inputs.some((input) => input.type === "IMAGE")) return nextNode;
  const promptIndex = nextNode.inputs.findIndex((input) => input.name === "prompt");
  const insertAt = promptIndex >= 0 ? promptIndex + 1 : 0;
  return {
    ...nextNode,
    inputs: [...nextNode.inputs.slice(0, insertAt), VIDEO_IMAGE_INPUT, ...nextNode.inputs.slice(insertAt)],
  };
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
    deepseekBaseUrl?: string;
    deepseekApiKey?: string;
    deepseekModel?: string;
    minimaxApiKey?: string;
    minimaxBaseUrl?: string;
    providerApiKeys?: Partial<Record<string, string>>;
    providerBaseUrls?: Partial<Record<string, string>>;
    providerModels?: Partial<Record<string, string>>;
  };
}

export function useWorkflowState(options: UseWorkflowStateOptions) {
  const { apiConfig } = options;

  const initial = useMemo<Workspace>(() => loadWorkspace(), []);

  const [workspace, setWorkspace] = useState<Workspace>(initial);
  const initialWf = initial.workflows[initial.currentId];
  const initialNodes = normalizeNodes(initialWf?.data.nodes ?? []);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([makeLog("info", "初始化完成:项目画布已就绪。")]);
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

  const [historyState, setHistoryState] = useState<{ stack: HistorySnapshot[]; pointer: number }>(() => ({
    stack: [{ nodes: initialNodes, links: initialWf?.data.links ?? [] }],
    pointer: 0,
  }));
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

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const linkDraftIssue = useMemo(
    () =>
      getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: linkToNodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: linkToInputIndex,
        nodes,
        links,
      }),
    [linkFromNodeId, linkToNodeId, linkFromOutputIndex, linkToInputIndex, nodes, links]
  );

  const resolvedInputsMap = useMemo(
    () => buildResolvedInputsMap(nodes, links, nodeOutputs),
    [nodes, links, nodeOutputs]
  );

  const appendLog = useCallback((type: ExecutionLog["type"], message: string) => {
    setLogs((prev) => [...prev, makeLog(type, message)].slice(-80));
  }, []);

  const syncCurrentWorkflowMeta = useCallback((updater: (wf: Workflow) => Workflow) => {
    setWorkspace((prev) => {
      const wf = prev.workflows[prev.currentId];
      if (!wf) return prev;
      const next = updater(wf);
      if (next === wf) return prev;
      return { ...prev, workflows: { ...prev.workflows, [wf.summary.id]: next } };
    });
  }, []);

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
    const id = makeId("node");
    const nextX = x ?? 80 + (nodes.length % 4) * 280;
    const nextY = y ?? 120 + Math.floor(nodes.length / 4) * 180;
    const node = createNodeFromType(type, id, nextX, nextY);
    node.title = getNextNumberedNodeTitle(nodes, type) || node.title;
    if (initialProps) {
      const { __nodeTitle, __uploadedAssetUrl, __uploadedAssetKind, __uploadedAssetName, ...restProps } = initialProps;
      node.properties = { ...node.properties, ...restProps };
      if (typeof __nodeTitle === "string" && __nodeTitle.trim()) {
        node.title = __nodeTitle.trim();
      }
      if (__uploadedAssetKind === "image" && typeof __uploadedAssetUrl === "string") {
        node.data = {
          ...(node.data || {}),
          imageUrl: __uploadedAssetUrl,
          status: "success",
          loading: false,
        };
        node.properties.imageUrl = __uploadedAssetUrl;
        if (typeof __uploadedAssetName === "string" && __uploadedAssetName.trim()) {
          node.title = getNextNumberedNodeTitle(nodes, "image_node") || node.title;
        }
      }
      if (__uploadedAssetKind === "video" && typeof __uploadedAssetUrl === "string") {
        node.data = {
          ...(node.data || {}),
          videoUrl: __uploadedAssetUrl,
          status: "success",
          loading: false,
        };
        node.properties.videoUrl = __uploadedAssetUrl;
        if (typeof __uploadedAssetName === "string" && __uploadedAssetName.trim()) {
          node.title = getNextNumberedNodeTitle(nodes, "video_node") || node.title;
        }
      }
    }
    const nextNodes = [...nodes, node];
    let nextLinks = links;
    if (connectFromDraft) {
      const fromNodeCandidate = nextNodes.find((n) => n.id === connectFromDraft.fromNodeId);
      const toNodeCandidate = node;
      const requestedInputIndex = connectFromDraft.toInputIndex ?? 0;
      const fromOutput = fromNodeCandidate?.outputs[connectFromDraft.fromOutputIndex];
      const requestedInput = toNodeCandidate.inputs[requestedInputIndex];
      const normalizedInputIndex =
        fromNodeCandidate && fromOutput && (!requestedInput || !isDataTypeCompatible(fromOutput.type, requestedInput.type))
          ? findFirstCompatibleInputIndex(fromNodeCandidate, toNodeCandidate, connectFromDraft.fromOutputIndex)
          : requestedInputIndex;
      const normalizedDraft = {
        fromNodeId: connectFromDraft.fromNodeId,
        fromOutputIndex: connectFromDraft.fromOutputIndex,
        toNodeId: id,
        toInputIndex: normalizedInputIndex,
      };
      const issue = getLinkDraftIssue({ ...normalizedDraft, nodes: nextNodes, links });
      if (issue) {
        appendLog("warning", issue);
      } else {
        nextLinks = [
          ...links,
          {
            id: makeId("link"),
            fromNodeId: normalizedDraft.fromNodeId,
            fromOutputIndex: normalizedDraft.fromOutputIndex,
            toNodeId: normalizedDraft.toNodeId,
            toInputIndex: normalizedDraft.toInputIndex,
          },
        ];
      }
    }
    setNodes(nextNodes);
    setLinks(nextLinks);
    setSelectedNodeId(node.id);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes, links: nextLinks },
    }));
    pushHistory({ nodes: nextNodes, links: nextLinks });
    appendLog("success", `已添加节点:${node.title}`);
    return id;
  };

  const removeNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    const nextNodes = nodes.filter((n) => n.id !== nodeId);
    const nextLinks = links.filter((l) => l.fromNodeId !== nodeId && l.toNodeId !== nodeId);
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
    appendLog("warning", `已删除节点:${node?.title ?? nodeId}`);
  };

  const duplicateNode = (nodeId: string) => {
    const src = nodes.find((n) => n.id === nodeId);
    if (!src) return;
    const id = makeId("node");
    const clone: GraphNode = {
      ...src,
      id,
      x: src.x + 36,
      y: src.y + 36,
      inputs: src.inputs.map((i) => ({ ...i })),
      outputs: src.outputs.map((o) => ({ ...o })),
      properties: { ...src.properties },
      data: src.data ? { ...src.data } : {},
      title: getNextNumberedNodeTitle(nodes, src.type) || `${src.title} Copy`,
    };
    const nextNodes = [...nodes, clone];
    setNodes(nextNodes);
    setSelectedNodeId(id);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes },
    }));
    pushHistory({ nodes: nextNodes, links });
    appendLog("info", `已复制节点:${src.title}`);
  };

  const updateNodePosition = (nodeId: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)));
  };

  const clearCanvas = () => {
    setNodes([]);
    setLinks([]);
    setSelectedNodeId(null);
    setNodeOutputs(new Map());
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { nodes: [], links: [], nodeOutputs: [] },
    }));
    pushHistory({ nodes: [], links: [] });
    appendLog("warning", "画布已清空。");
  };

  const addLinkFromDraft = (draft: { fromNodeId: string; toNodeId: string; fromOutputIndex: number; toInputIndex: number }) => {
    const fromNodeCandidate = nodes.find((n) => n.id === draft.fromNodeId);
    const toNodeCandidate = nodes.find((n) => n.id === draft.toNodeId);
    const fromOutput = fromNodeCandidate?.outputs[draft.fromOutputIndex];
    const requestedInput = toNodeCandidate?.inputs[draft.toInputIndex];
    const normalizedInputIndex =
      fromNodeCandidate && toNodeCandidate && fromOutput && (!requestedInput || !isDataTypeCompatible(fromOutput.type, requestedInput.type))
        ? findFirstCompatibleInputIndex(fromNodeCandidate, toNodeCandidate, draft.fromOutputIndex)
        : draft.toInputIndex;
    const normalizedDraft = { ...draft, toInputIndex: normalizedInputIndex };
    const issue = getLinkDraftIssue({ ...normalizedDraft, nodes, links });
    if (issue) {
      appendLog("warning", issue);
      return false;
    }

    const fromNode = nodes.find((n) => n.id === normalizedDraft.fromNodeId)!;
    const toNode = nodes.find((n) => n.id === normalizedDraft.toNodeId)!;
    const link: GraphLink = {
      id: makeId("link"),
      fromNodeId: normalizedDraft.fromNodeId,
      fromOutputIndex: normalizedDraft.fromOutputIndex,
      toNodeId: normalizedDraft.toNodeId,
      toInputIndex: normalizedDraft.toInputIndex,
    };

    const nextLinks = [...links, link];
    setLinks(nextLinks);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks },
    }));
    pushHistory({ nodes, links: nextLinks });
    appendLog(
      "success",
      `已建立连线:${fromNode.title}[${fromNode.outputs[normalizedDraft.fromOutputIndex].name}] -> ${toNode.title}[${toNode.inputs[normalizedDraft.toInputIndex].name}]`
    );
    return true;
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

  const removeLink = (linkId: string) => {
    const link = links.find((l) => l.id === linkId);
    if (link?.locked) {
      appendLog("warning", "该连线由快捷模板创建，不可删除");
      return;
    }
    const nextLinks = links.filter((l) => l.id !== linkId);
    setLinks(nextLinks);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, links: nextLinks },
    }));
    pushHistory({ nodes, links: nextLinks });
    appendLog("warning", `已移除连线:${linkId}`);
  };

  const createImagePromptStarter = useCallback((textNodeId: string) => {
    const textNode = nodes.find((n) => n.id === textNodeId && n.type === "text_node");
    if (!textNode) return null;
    const existingStarterLink = links.find((link) => link.toNodeId === textNodeId && link.locked);
    const imageNodeX = textNode.x - IMAGE_PROMPT_STARTER_IMAGE_OFFSET_X;
    const imageNodeY = textNode.y + IMAGE_PROMPT_STARTER_IMAGE_OFFSET_Y;
    if (existingStarterLink) {
      setSelectedNodeId(textNodeId);
      const imageNode = nodes.find((node) => node.id === existingStarterLink.fromNodeId);
      if (imageNode && (
        imageNode.x !== imageNodeX ||
        imageNode.y !== imageNodeY ||
        imageNode.data?.imagePromptStarter !== true ||
        imageNode.data?.starterTextNodeId !== textNodeId
      )) {
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
        setNodes(nextNodes);
        syncCurrentWorkflowMeta((wf) => ({
          ...wf,
          summary: { ...wf.summary, updatedAt: Date.now() },
          data: { ...wf.data, nodes: nextNodes, links },
        }));
        pushHistory({ nodes: nextNodes, links });
        appendLog("info", "图片反推提示词模板已对齐到标准布局");
      } else {
        appendLog("info", "图片反推提示词模板已存在");
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
      text: "图片反推提示词参考图",
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

    const nextNodes = [
      ...nodes,
      imageNode,
    ].map((node) =>
      node.id === textNodeId
        ? {
            ...node,
            properties: {
              ...node.properties,
              text: typeof node.properties.text === "string" && node.properties.text.trim()
                ? node.properties.text
                : IMAGE_PROMPT_DEFAULT_TEXT,
              model: "MiniMax-M3",
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

    setNodes(nextNodes);
    setLinks(nextLinks);
    setSelectedNodeId(textNodeId);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes, links: nextLinks },
    }));
    pushHistory({ nodes: nextNodes, links: nextLinks });
    appendLog("success", "已创建图片反推提示词模板");
    return {
      imageNodeId: imageId,
      textNodeId,
      bounds: getImagePromptStarterFocusBounds(textNode, imageNodeX, imageNodeY),
    };
  }, [appendLog, links, nodes, pushHistory, syncCurrentWorkflowMeta]);

  const syncImagePromptStarterLayout = useCallback((imageNodeId: string, imageNodeWidth: number) => {
    if (!Number.isFinite(imageNodeWidth) || imageNodeWidth <= 0) return;

    let nextNodesSnapshot: GraphNode[] | null = null;
    setNodes((prev) => {
      const imageNode = prev.find((node) => node.id === imageNodeId && node.type === "image_node");
      const textNodeId = typeof imageNode?.data?.starterTextNodeId === "string" ? imageNode.data.starterTextNodeId : "";
      const textNode = prev.find((node) => node.id === textNodeId && node.type === "text_node");
      if (!imageNode || !textNode) return prev;

      const nextTextNodeX = getImagePromptStarterTextNodeX(
        imageNode.x,
        imageNodeWidth,
        typeof imageNode.data?.starterGapX === "number" ? imageNode.data.starterGapX : IMAGE_PROMPT_STARTER_GAP_X
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

    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodesSnapshot, links },
    }));
    pushHistory({ nodes: nextNodesSnapshot, links });
  }, [links, pushHistory, syncCurrentWorkflowMeta]);

  const updateNodeProperty = (nodeId: string, key: string, value: unknown) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, properties: { ...n.properties, [key]: value } } : n)));
  };

  const updateNodeData = useCallback((nodeId: string, data: Partial<GraphNode["data"]>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...data } } : n)));
  }, []);

  const setPrimaryImageResult = useCallback((nodeId: string, imageUrl: string, imageIndex: number) => {
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
      const inner = new Map<number, unknown>(existingOutputs instanceof Map ? existingOutputs : []);
      inner.set(0, imageUrl);
      next.set(nodeId, inner);
      return next;
    });
  }, []);

  const addVideoFrameAnalysis = useCallback(
    (videoNodeId: string, segments: VideoFrameAnalysisSegment[], overview: VideoFrameAnalysisOverview, analysisMarkdown: string) => {
      const sourceNode = nodes.find((n) => n.id === videoNodeId);
      if (!sourceNode || segments.length === 0 || !overview.imageUrl) {
        appendLog("warning", "逐帧分析失败:未找到视频节点或没有可用分段");
        return;
      }

      const baseX = sourceNode.x + 720;
      const baseY = sourceNode.y;
      const childX = baseX + 720;
      const nextNodes = [...nodes];
      const nextLinks = [...links];
      const nextOutputs: NodeOutputMap = new Map(nodeOutputs);
      const createdNodes: GraphNode[] = [];
      const videoUrl = (sourceNode.data?.videoUrl as string) || (sourceNode.properties.videoUrl as string) || "";

      const makePreviewNode = (title: string, x: number, y: number) => {
        const id = makeId("node");
        const node = createNodeFromType("video_node", id, x, y);
        node.title = title;
        node.properties = {
          ...node.properties,
          videoUrl,
          text: "",
        };
        node.data = {
          ...(node.data || {}),
          videoUrl,
          videoNaturalWidth: sourceNode.data?.videoNaturalWidth,
          videoNaturalHeight: sourceNode.data?.videoNaturalHeight,
          videoDisplayWidth: sourceNode.data?.videoDisplayWidth,
          videoDisplayHeight: sourceNode.data?.videoDisplayHeight,
          status: "success",
          loading: false,
        };
        nextNodes.push(node);
        createdNodes.push(node);
        nextOutputs.set(id, new Map([[0, videoUrl]]));
        nextLinks.push({
          id: makeId("link"),
          fromNodeId: sourceNode.id,
          fromOutputIndex: 0,
          toNodeId: id,
          toInputIndex: 0,
        });
        return node;
      };

      const analysisPreview = makePreviewNode("完整视频分析", baseX, baseY);
      const segmentPreview = makePreviewNode("分段逐帧拆解", baseX, baseY + 520);

      const textId = makeId("node");
      const textNode = createNodeFromType("text_node", textId, childX, baseY);
      textNode.title = "完整视频分析文本";
      textNode.properties = {
        ...textNode.properties,
        frameAnalysisVideoUrl: videoUrl,
        frameAnalysisSegments: segments.map(({ title, start, end, frameCount, width, height }) => ({ title, start, end, frameCount, width, height })),
        isFullVideoAnalysisText: true,
        response: analysisMarkdown,
        text: "完整视频分析结果",
      };
      textNode.data = { response: analysisMarkdown, loading: false, status: "success" };
      nextNodes.push(textNode);
      createdNodes.push(textNode);
      nextOutputs.set(textId, new Map([[0, analysisMarkdown]]));
      nextLinks.push({
        id: makeId("link"),
        fromNodeId: analysisPreview.id,
        fromOutputIndex: 0,
        toNodeId: textId,
        toInputIndex: 1,
      });

      const overviewSize = fitFrameImageSize(overview.width, overview.height);
      const overviewId = makeId("node");
      const overviewNode = createNodeFromType("image_node", overviewId, childX, baseY + 300);
      overviewNode.title = "完整视频逐帧总览";
      overviewNode.properties = {
        ...overviewNode.properties,
        imageUrl: overview.imageUrl,
        text: "",
      };
      overviewNode.data = {
        imageUrl: overview.imageUrl,
        imageNaturalWidth: overview.width,
        imageNaturalHeight: overview.height,
        imageDisplayWidth: overviewSize.width,
        imageDisplayHeight: overviewSize.height,
      };
      nextNodes.push(overviewNode);
      createdNodes.push(overviewNode);
      nextOutputs.set(overviewId, new Map([[0, overview.imageUrl]]));
      nextLinks.push({
        id: makeId("link"),
        fromNodeId: analysisPreview.id,
        fromOutputIndex: 0,
        toNodeId: overviewId,
        toInputIndex: 0,
      });

      segments.forEach((segment, index) => {
        const id = makeId("node");
        const size = fitFrameImageSize(segment.width, segment.height);
        const node = createNodeFromType("image_node", id, childX, baseY + 620 + index * 230);
        node.title = segment.title;
        node.properties = {
          ...node.properties,
          imageUrl: segment.imageUrl,
          text: "",
        };
        node.data = {
          imageUrl: segment.imageUrl,
          imageNaturalWidth: segment.width,
          imageNaturalHeight: segment.height,
          imageDisplayWidth: size.width,
          imageDisplayHeight: size.height,
        };
        nextNodes.push(node);
        createdNodes.push(node);
        nextOutputs.set(id, new Map([[0, segment.imageUrl]]));
        nextLinks.push({
          id: makeId("link"),
          fromNodeId: segmentPreview.id,
          fromOutputIndex: 0,
          toNodeId: id,
          toInputIndex: 0,
        });
      });

      setNodes(nextNodes);
      setLinks(nextLinks);
      setNodeOutputs(nextOutputs);
      setSelectedNodeId(createdNodes[0]?.id ?? sourceNode.id);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodes, links: nextLinks, nodeOutputs: mapToOutputs(nextOutputs) },
      }));
      pushHistory({ nodes: nextNodes, links: nextLinks });
      appendLog("success", `逐帧分析完成:生成 2 个视频预览节点、1 个分析文本节点、1 个总览图和 ${segments.length} 个分段图节点`);
    },
    [appendLog, links, nodeOutputs, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const addSegmentVideoAnalyses = useCallback(
    (parentNodeId: string, analyses: VideoSegmentTextAnalysis[]) => {
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (!parentNode || analyses.length === 0) {
        appendLog("warning", "反推失败:未找到分析文本节点或没有分段结果");
        return;
      }

      const baseX = parentNode.x + 620;
      const baseY = parentNode.y;
      const nextNodes = [...nodes];
      const nextLinks = [...links];
      const nextOutputs: NodeOutputMap = new Map(nodeOutputs);
      const createdNodes: GraphNode[] = [];

      analyses.forEach((analysis, index) => {
        const id = makeId("node");
        const node = createNodeFromType("text_node", id, baseX, baseY + index * 260);
        node.title = `${analysis.title} 分析`;
        node.properties = {
          ...node.properties,
          response: analysis.text,
          text: `${analysis.title} 视频分析结果`,
          sourceSegment: {
            title: analysis.title,
            start: analysis.start,
            end: analysis.end,
          },
        };
        node.data = { response: analysis.text, loading: false, status: "success" };
        nextNodes.push(node);
        createdNodes.push(node);
        nextOutputs.set(id, new Map([[0, analysis.text]]));
        nextLinks.push({
          id: makeId("link"),
          fromNodeId: parentNode.id,
          fromOutputIndex: 0,
          toNodeId: id,
          toInputIndex: 1,
        });
      });

      setNodes(nextNodes);
      setLinks(nextLinks);
      setNodeOutputs(nextOutputs);
      setSelectedNodeId(createdNodes[0]?.id ?? parentNode.id);
      syncCurrentWorkflowMeta((wf) => ({
        ...wf,
        summary: { ...wf.summary, updatedAt: Date.now() },
        data: { ...wf.data, nodes: nextNodes, links: nextLinks, nodeOutputs: mapToOutputs(nextOutputs) },
      }));
      pushHistory({ nodes: nextNodes, links: nextLinks });
      appendLog("success", `反推完成:生成 ${analyses.length} 个分段视频分析文本节点`);
    },
    [appendLog, links, nodeOutputs, nodes, pushHistory, syncCurrentWorkflowMeta]
  );

  const updateSelectedProperty = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    updateNodeProperty(selectedNodeId, key, value);
  };

  const createGroup = useCallback((nodeIds: string[], title?: string): import("../types").GroupBox | null => {
    if (nodeIds.length < 2) {
      appendLog("warning", "打组至少需要 2 个节点");
      return null;
    }
    const selectedNodes = nodes.filter((n) => nodeIds.includes(n.id));
    if (selectedNodes.length < 2) {
      appendLog("warning", "打组至少需要 2 个节点");
      return null;
    }
    const minX = Math.min(...selectedNodes.map((n) => n.x)) - 24;
    const minY = Math.min(...selectedNodes.map((n) => n.y)) - 56;
    const maxX = Math.max(...selectedNodes.map((n) => n.x + 280)) + 24;
    const maxY = Math.max(...selectedNodes.map((n) => n.y + 200)) + 24;
    const id = makeId("group");
    const colors = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981"];
    const color = colors[groups.length % colors.length];
    const group: import("../types").GroupBox = {
      id,
      title: title?.trim() || `节点分组 ${groups.length + 1}`,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      color,
    };
    const nextGroups = [...groups, group];
    const nextNodes = nodes.map((n) => (nodeIds.includes(n.id) ? { ...n, groupId: id } : n));
    setGroups(nextGroups);
    setNodes(nextNodes);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, groups: nextGroups, nodes: nextNodes },
    }));
    appendLog("success", `已打组 "${group.title}" (${nodeIds.length} 节点)`);
    return group;
  }, [nodes, groups, appendLog, syncCurrentWorkflowMeta]);

  const ungroup = useCallback((groupId: string): boolean => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return false;
    const nextGroups = groups.filter((g) => g.id !== groupId);
    const nextNodes = nodes.map((n) => (n.groupId === groupId ? { ...n, groupId: null } : n));
    setGroups(nextGroups);
    setNodes(nextNodes);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, groups: nextGroups, nodes: nextNodes },
    }));
    appendLog("info", `已解组 "${group.title}"`);
    return true;
  }, [groups, nodes, appendLog, syncCurrentWorkflowMeta]);

  const updateGroup = useCallback((groupId: string, patch: Partial<import("../types").GroupBox>): boolean => {
    const nextGroups = groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    setGroups(nextGroups);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, groups: nextGroups },
    }));
    return true;
  }, [groups, syncCurrentWorkflowMeta]);

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
    (nodeId: string) => {
      const imageUrls: string[] = [];
      const videoUrls: string[] = [];
      const audioUrls: string[] = [];

      links.forEach((link) => {
        if (link.toNodeId !== nodeId) return;
        const sourceNode = nodes.find((candidate) => candidate.id === link.fromNodeId);
        if (!sourceNode) return;

        if (sourceNode.type === "image_node") {
          const imageUrl =
            (typeof sourceNode.data?.imageUrl === "string" && sourceNode.data.imageUrl.trim()) ||
            (typeof sourceNode.properties.imageUrl === "string" && sourceNode.properties.imageUrl.trim()) ||
            "";
          if (imageUrl && !imageUrls.includes(imageUrl)) imageUrls.push(imageUrl);
          return;
        }

        if (sourceNode.type === "video_node") {
          const videoUrl =
            (typeof sourceNode.data?.videoUrl === "string" && sourceNode.data.videoUrl.trim()) ||
            (typeof sourceNode.properties.videoUrl === "string" && sourceNode.properties.videoUrl.trim()) ||
            "";
          if (videoUrl && !videoUrls.includes(videoUrl)) videoUrls.push(videoUrl);
          return;
        }

        if (sourceNode.type === "audio_node") {
          const audioUrl =
            (typeof sourceNode.data?.audioUrl === "string" && sourceNode.data.audioUrl.trim()) ||
            (typeof sourceNode.properties.audioUrl === "string" && sourceNode.properties.audioUrl.trim()) ||
            "";
          if (audioUrl && !audioUrls.includes(audioUrl)) audioUrls.push(audioUrl);
        }
      });

      return { imageUrls, videoUrls, audioUrls };
    },
    [links, nodes]
  );

  const runNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const executor = getExecutor(node.type);
      if (!executor) {
        appendLog("warning", `[${node.title}] 暂无执行器,跳过`);
        return;
      }

      const inputs = resolveNodeInputs(node, links, nodeOutputs);
      if (node.type === "text_node") {
        const { imageUrls, videoUrls, audioUrls } = collectTextNodeMediaReferences(nodeId);
        if (imageUrls.length > 0) inputs.reference_images = imageUrls;
        if (videoUrls.length > 0) inputs.reference_videos = videoUrls;
        if (audioUrls.length > 0) inputs.reference_audios = audioUrls;
      }
      updateNodeData(nodeId, { loading: true, error: undefined, response: undefined, status: "loading" });
      appendLog("info", `开始执行 [${node.title}]`);

      try {
        const result = await executor({ inputs, properties: node.properties, apiConfig });
        writeNodeOutput(nodeId, result.outputs);
        const patch: Record<string, unknown> = { loading: false, error: undefined, ...(result.patch || {}) };
        if (typeof result.outputs[0] === "string") patch.response = result.outputs[0];
        updateNodeData(nodeId, patch);
        appendLog("success", `[${node.title}] 完成`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updateNodeData(nodeId, { loading: false, error: message, status: "error" });
        appendLog("error", `[${node.title}] 失败:${message}`);
      }
    },
    [nodes, links, nodeOutputs, apiConfig, appendLog, updateNodeData, writeNodeOutput, collectTextNodeMediaReferences]
  );

  const runGroup = useCallback(async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const memberIds = new Set(nodes.filter((n) => n.groupId === groupId).map((n) => n.id));
    if (memberIds.size === 0) {
      appendLog("warning", `组 "${group.title}" 内没有节点`);
      return;
    }
    appendLog("info", `开始一键重跑组 "${group.title}" (${memberIds.size} 节点)`);
    setIsRunning(true);
    try {
      for (const id of memberIds) {
        await runNode(id);
      }
      appendLog("success", `组 "${group.title}" 一键重跑完成`);
    } finally {
      setIsRunning(false);
    }
  }, [groups, nodes, runNode, appendLog]);

  const runWorkflow = useCallback(async () => {
    if (isRunning) return;
    if (!nodes.length) {
      appendLog("warning", "当前没有可执行节点。");
      return;
    }

    const { levels, hasCycle, cyclePath } = topologicalLevels(nodes, links);
    if (hasCycle) {
      appendLog("error", `项目存在循环依赖,无法执行。涉及节点:${cyclePath.join(", ")}`);
      return;
    }

    setIsRunning(true);
    setNodeOutputs(new Map());
    appendLog("info", `开始执行项目 "${currentWorkflowSummary?.name ?? ""}",共 ${nodes.length} 个节点,分 ${levels.length} 层并发`);

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      appendLog("info", `第 ${i + 1}/${levels.length} 层 (${level.length} 个节点并发) — [${level.map((n) => n.title).join(", ")}]`);
      await Promise.all(level.map((node) => runNode(node.id)));
    }

    appendLog("success", "项目执行完成。");
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
      appendLog("info", `已撤销 (${prev.pointer} → ${prev.pointer - 1})`);
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
      appendLog("info", `已重做 (${prev.pointer} → ${prev.pointer + 1})`);
      return { ...prev, pointer: prev.pointer + 1 };
    });
  }, [appendLog, syncCurrentWorkflowMeta]);

  const createWorkflow = useCallback((name?: string): WorkflowSummary => {
    const wf = makeEmptyWorkflow(name?.trim() || `项目 ${Object.keys(workspace.workflows).length + 1}`);
    setWorkspace((prev) => ({
      ...prev,
      workflows: { ...prev.workflows, [wf.summary.id]: wf },
    }));
    appendLog("success", `已新建项目 "${wf.summary.name}"`);
    return wf.summary;
  }, [appendLog, workspace.workflows]);

  const createWorkflowFromTemplate = useCallback(
    (templateId: string, customName?: string): WorkflowSummary | null => {
      const tmpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!tmpl) {
        appendLog("warning", `模板 "${templateId}" 不存在`);
        return null;
      }
      const wfId = makeId("wf");
      const now = Date.now();
      const nodeIds: string[] = [];
      const nodes: GraphNode[] = normalizeNodes(tmpl.nodes.map((n) => {
        const nodeId = makeId("node");
        nodeIds.push(nodeId);
        const base = createNodeFromType(n.type, nodeId, n.x, n.y);
        if (n.defaultProperties) {
          base.properties = { ...base.properties, ...n.defaultProperties };
        }
        return base;
      }));
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
          name: customName?.trim() || `${tmpl.name} (模板)`,
          category: tmpl.category,
          tags: ["模板", tmpl.category],
          sortIndex: now,
          createdAt: now,
          updatedAt: now,
        },
        data: {
          nodes,
          links,
          nodeOutputs: Array.from(outputsMap.entries()).map(([k, v]) => [k, Array.from(v.entries())]),
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
        `已从模板 "${tmpl.name}" 创建项目 (${nodes.length} 节点, ${links.length} 连线, 分类 "${tmpl.category}", 预填 ${outputsMap.size} 个占位结果)`
      );
      return wf.summary;
    },
    [appendLog, clearLinkDraft, resetHistory]
  );

  const resetCurrentToDemo = useCallback(
    (templateId: string): boolean => {
      const tmpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
      if (!tmpl) {
        appendLog("warning", `模板 "${templateId}" 不存在`);
        return false;
      }
      if (!workspace.workflows[workspace.currentId]) {
        appendLog("warning", "当前没有可重置的项目");
        return false;
      }
      const now = Date.now();
      const nodeIds: string[] = [];
      const nodes: GraphNode[] = normalizeNodes(tmpl.nodes.map((n) => {
        const nodeId = makeId("node");
        nodeIds.push(nodeId);
        const base = createNodeFromType(n.type, nodeId, n.x, n.y);
        if (n.defaultProperties) {
          base.properties = { ...base.properties, ...n.defaultProperties };
        }
        return base;
      }));
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
          summary: { ...cur.summary, category: tmpl.category, tags: ["模板", tmpl.category], updatedAt: now },
          data: {
            nodes: nodes.map((n) => ({ ...n })),
            links: links.map((l) => ({ ...l })),
            nodeOutputs: Array.from(outputsMap.entries()).map(([k, v]) => [k, Array.from(v.entries())]),
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
        `已重置当前画布为 demo "${tmpl.name}" (${nodes.length} 节点, ${links.length} 连线, 预填 ${outputsMap.size} 个占位结果)`
      );
      return true;
    },
    [workspace, appendLog, clearLinkDraft, resetHistory]
  );

  const switchWorkflow = useCallback((id: string): boolean => {
    if (!workspace.workflows[id]) {
      appendLog("warning", `项目 ${id} 不存在`);
      return false;
    }
    if (id === workspace.currentId) {
      appendLog("info", `已在项目 "${workspace.workflows[id].summary.name}"`);
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
      appendLog("info", `已切换到项目 "${target.summary.name}" (${nextNodes.length} 节点, ${target.data.links.length} 连线)`);
      return { ...prev, currentId: id };
    });
    return true;
  }, [workspace, appendLog, clearLinkDraft, resetHistory]);

  const renameWorkflow = useCallback((id: string, name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      appendLog("warning", "项目名称不能为空");
      return false;
    }
    if (!workspace.workflows[id]) return false;
    setWorkspace((prev) => {
      const wf = prev.workflows[id];
      const updated: Workflow = { ...wf, summary: { ...wf.summary, name: trimmed, updatedAt: Date.now() } };
      return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
    });
    appendLog("success", `已重命名为 "${trimmed}"`);
    return true;
  }, [workspace, appendLog]);

  const setWorkflowCategory = useCallback((id: string, category: string): boolean => {
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
  }, [workspace]);

  const addTagToWorkflow = useCallback((id: string, tag: string): boolean => {
    const trimmed = tag.trim();
    if (!trimmed) {
      appendLog("warning", "标签不能为空");
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
        summary: { ...target.summary, tags: [...(target.summary.tags ?? []), trimmed], updatedAt: Date.now() },
      };
      return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
    });
    return true;
  }, [workspace, appendLog]);

  const removeTagFromWorkflow = useCallback((id: string, tag: string): boolean => {
    if (!workspace.workflows[id]) return false;
    setWorkspace((prev) => {
      const target = prev.workflows[id];
      if (!target) return prev;
      const updated: Workflow = {
        ...target,
        summary: { ...target.summary, tags: (target.summary.tags ?? []).filter((t) => t !== tag), updatedAt: Date.now() },
      };
      return { ...prev, workflows: { ...prev.workflows, [id]: updated } };
    });
    return true;
  }, [workspace]);

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

  const deleteWorkflow = useCallback((id: string): boolean => {
    if (!workspace.workflows[id]) return false;
    if (workspace.workflows[id].summary.deletedAt) return false;
    const removed = workspace.workflows[id];
    const remaining = (Object.values(workspace.workflows) as Workflow[]).filter((w) => w.summary.id !== id);
    if (remaining.length === 0) {
      appendLog("warning", "至少需要保留一个项目");
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
    appendLog("warning", `已移至回收站 "${removed.summary.name}"`);
    return true;
  }, [workspace, appendLog, clearLinkDraft, resetHistory]);

  const restoreWorkflow = useCallback((id: string): boolean => {
    const src = workspace.trash.find((w) => w.summary.id === id);
    if (!src) return false;
    if (workspace.workflows[id]) {
      appendLog("warning", `项目 "${src.summary.name}" 已存在,无法还原`);
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
    appendLog("success", `已还原 "${src.summary.name}"`);
    return true;
  }, [workspace, appendLog]);

  const purgeWorkflow = useCallback((id: string): boolean => {
    const src = workspace.trash.find((w) => w.summary.id === id);
    if (!src) return false;
    setWorkspace((prev) => ({
      ...prev,
      trash: prev.trash.filter((w) => w.summary.id !== id),
    }));
    appendLog("warning", `已永久删除 "${src.summary.name}"`);
    return true;
  }, [workspace, appendLog]);

  const emptyTrash = useCallback((): number => {
    const count = workspace.trash.length;
    if (count === 0) return 0;
    setWorkspace((prev) => ({ ...prev, trash: [] }));
    appendLog("warning", `已清空回收站 (${count} 个项目被永久删除)`);
    return count;
  }, [workspace, appendLog]);

  const purgeExpiredTrash = useCallback((): number => {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const expired = workspace.trash.filter((w) => (w.summary.deletedAt ?? 0) < cutoff);
    if (expired.length === 0) return 0;
    const expiredIds = new Set(expired.map((w) => w.summary.id));
    setWorkspace((prev) => ({ ...prev, trash: prev.trash.filter((w) => !expiredIds.has(w.summary.id)) }));
    appendLog(
      "warning",
      `自动清理回收站:已永久删除 ${expired.length} 个超过 ${TRASH_RETENTION_DAYS} 天的过期项目${expired.length > 0 ? ` ("${expired.slice(0, 3).map((w) => w.summary.name).join('", "')}${expired.length > 3 ? '" 等' : '"'})` : ""}`
    );
    return expired.length;
  }, [workspace, appendLog]);

  const duplicateWorkflow = useCallback((id: string): WorkflowSummary | null => {
    const src = workspace.workflows[id];
    if (!src) return null;
    const now = Date.now();
    const wf: Workflow = {
      summary: {
        id: makeId("wf"),
        name: `${src.summary.name} - 副本`,
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
    appendLog("success", `已复制为新项目 "${wf.summary.name}" (${wf.data.nodes.length} 节点)`);
    return wf.summary;
  }, [workspace, appendLog]);

  const exportWorkspaceJson = useCallback((): string => {
    return JSON.stringify(workspace, null, 2);
  }, [workspace]);

  const importWorkspaceJson = useCallback(
    (json: string, options: { includeTrash?: boolean; renameConflicts?: boolean } = {}): { imported: number; skipped: number; renamed: number; errors: string[] } => {
      const { includeTrash = true, renameConflicts = true } = options;
      const result = { imported: 0, skipped: 0, renamed: 0, errors: [] };
      let parsed: any;
      try {
        parsed = JSON.parse(json);
      } catch (err) {
        result.errors.push(`JSON 解析失败:${err instanceof Error ? err.message : String(err)}`);
        return result;
      }
      if (!parsed || typeof parsed !== "object" || !parsed.workflows || typeof parsed.workflows !== "object") {
        result.errors.push("文件格式无效:缺少 workflows 字段");
        return result;
      }
      const incoming = parsed.workflows as Record<string, Workflow>;
      const incomingTrash: Workflow[] = Array.isArray(parsed.trash) ? (parsed.trash as Workflow[]) : [];

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
              summary: { ...wf.summary, id: newId, name: `${wf.summary.name} (导入)`, updatedAt: Date.now() },
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
      try {
        setWorkspace((prev) => {
          const cur = prev.workflows[prev.currentId];
          if (!cur) return prev;
          const next: Workspace = {
            ...prev,
            workflows: {
              ...prev.workflows,
              [prev.currentId]: {
                ...cur,
                data: {
                  ...cur.data,
                  nodes,
                  links,
                  nodeOutputs: mapToOutputs(nodeOutputs),
                },
                summary: { ...cur.summary, updatedAt: Date.now() },
              },
            },
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeWorkspaceForStorage(next)));
          return next;
        });
      } catch {
        appendLog("warning", "本地项目缓存空间不足，已跳过超大临时媒体的持久化");
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [appendLog, nodes, links, nodeOutputs]);

  useEffect(() => {
    purgeExpiredTrash();
    const intervalId = window.setInterval(purgeExpiredTrash, TRASH_PURGE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [purgeExpiredTrash]);

  useEffect(() => {
    if (initial && Object.keys(initial.workflows).length > 0) {
      const totalNodes = (Object.values(initial.workflows) as Workflow[]).reduce(
        (sum, w) => sum + w.data.nodes.length,
        0
      );
      appendLog("info", `已从本地恢复 ${Object.keys(initial.workflows).length} 个项目 (合计 ${totalNodes} 节点)`);
    }
  }, [appendLog, initial]);

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
    syncImagePromptStarterLayout,
    removeNode,
    duplicateNode,
    updateNodePosition,
    updateNodeProperty,
    updateNodeData,
    setPrimaryImageResult,
    addVideoFrameAnalysis,
    addSegmentVideoAnalyses,
    clearCanvas,
    clearExecution,
    addLinkFromDraft,
    addLink,
    removeLink,
    updateSelectedProperty,
    createGroup,
    ungroup,
    updateGroup,
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
