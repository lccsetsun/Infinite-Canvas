import { useCallback, useEffect, useMemo, useState } from "react";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import { getExecutor } from "../features/nodes/nodeExecutors";
import { WORKFLOW_TEMPLATES } from "../features/templates/workflowTemplates";
import { ExecutionLog, GraphLink, GraphNode, NodeClass, VideoFrameAnalysisSegment } from "../types";
import { findFirstCompatibleInputIndex, getLinkDraftIssue, isDataTypeCompatible } from "../utils/linking";
import { NodeOutputMap, buildResolvedInputsMap, resolveNodeInputs, topologicalLevels } from "../runtime/dataflow";

const STORAGE_KEY = "aicanvas_workspace_v2";
const HISTORY_LIMIT = 50;
const PERSIST_DEBOUNCE_MS = 800;
const DEFAULT_WORKFLOW_NAME = "默认工作流";
const WORKSPACE_VERSION = 2 as const;
const WORKSPACE_LEGACY_VERSIONS = [1] as const;
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 86_400_000;
const TRASH_PURGE_INTERVAL_MS = 60 * 60 * 1000;
const VIDEO_IMAGE_INPUT = { name: "image", type: "IMAGE" as const };
const MINIMAX_IMAGE_RATIOS = new Set(["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"]);
const IMAGE_NODE_MODEL_FALLBACKS = new Set(["", "lib-navo-pro", "flux-1", "sdxl", "midjourney"]);
const TEXT_NODE_MODEL_FALLBACKS = new Set(["", "deepseek-v4-flash"]);

interface HistorySnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
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

function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Workspace;
      if (parsed && parsed.workflows && parsed.currentId) {
        if (parsed.version === WORKSPACE_VERSION && parsed.workflows[parsed.currentId]) {
          const migrated: Workspace = {
            ...parsed,
            trash: Array.isArray(parsed.trash) ? parsed.trash : [],
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
        ...wf,
        summary: {
          ...wf.summary,
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
    if (TEXT_NODE_MODEL_FALLBACKS.has(model)) {
      nextNode = {
        ...nextNode,
        properties: {
          ...nextNode.properties,
          model: "deepseek-chat",
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
  const [logs, setLogs] = useState<ExecutionLog[]>([makeLog("info", "初始化完成:工作流编辑器已就绪。")]);
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

  const addNode = (type: NodeClass, x?: number, y?: number, initialProps?: Record<string, unknown>) => {
    const id = makeId("node");
    const nextX = x ?? 80 + (nodes.length % 4) * 280;
    const nextY = y ?? 120 + Math.floor(nodes.length / 4) * 180;
    const node = createNodeFromType(type, id, nextX, nextY);
    if (type === "text_node") {
      node.title = `文本节点 ${nodes.filter((n) => n.type === "text_node").length + 1}`;
    }
    if (type === "image_node") {
      node.title = `图片节点 ${nodes.filter((n) => n.type === "image_node").length + 1}`;
    }
    if (type === "video_node") {
      node.title = `视频节点 ${nodes.filter((n) => n.type === "video_node").length + 1}`;
    }
    if (initialProps) {
      const { __uploadedAssetUrl, __uploadedAssetKind, __uploadedAssetName, ...restProps } = initialProps;
      node.properties = { ...node.properties, ...restProps };
      if (__uploadedAssetKind === "image" && typeof __uploadedAssetUrl === "string") {
        node.data = {
          ...(node.data || {}),
          imageUrl: __uploadedAssetUrl,
          status: "success",
          loading: false,
        };
        node.properties.imageUrl = __uploadedAssetUrl;
        if (typeof __uploadedAssetName === "string" && __uploadedAssetName.trim()) {
          node.title = `图片节点 ${nodes.filter((n) => n.type === "image_node").length + 1}`;
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
          node.title = `视频节点 ${nodes.filter((n) => n.type === "video_node").length + 1}`;
        }
      }
    }
    const nextNodes = [...nodes, node];
    setNodes(nextNodes);
    setSelectedNodeId(node.id);
    syncCurrentWorkflowMeta((wf) => ({
      ...wf,
      summary: { ...wf.summary, updatedAt: Date.now() },
      data: { ...wf.data, nodes: nextNodes },
    }));
    pushHistory({ nodes: nextNodes, links });
    appendLog("success", `已添加节点:${node.title}`);
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

  const updateNodeProperty = (nodeId: string, key: string, value: unknown) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, properties: { ...n.properties, [key]: value } } : n)));
  };

  const updateNodeData = useCallback((nodeId: string, data: Partial<GraphNode["data"]>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...data } } : n)));
  }, []);

  const addVideoFrameAnalysis = useCallback(
    (videoNodeId: string, segments: VideoFrameAnalysisSegment[], analysisMarkdown: string) => {
      const sourceNode = nodes.find((n) => n.id === videoNodeId);
      if (!sourceNode || segments.length === 0) {
        appendLog("warning", "逐帧分析失败:未找到视频节点或没有可用分段");
        return;
      }

      const baseX = sourceNode.x + 720;
      const baseY = sourceNode.y;
      const nextNodes = [...nodes];
      const nextLinks = [...links];
      const nextOutputs: NodeOutputMap = new Map(nodeOutputs);
      const createdNodes: GraphNode[] = [];

      segments.forEach((segment, index) => {
        const id = makeId("node");
        const node = createNodeFromType("image_node", id, baseX, baseY + index * 230);
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
          imageDisplayWidth: Math.min(280, segment.width),
          imageDisplayHeight: Math.round(Math.min(280, segment.width) * (segment.height / Math.max(segment.width, 1))),
        };
        nextNodes.push(node);
        createdNodes.push(node);
        nextOutputs.set(id, new Map([[0, segment.imageUrl]]));
        nextLinks.push({
          id: makeId("link"),
          fromNodeId: sourceNode.id,
          fromOutputIndex: 0,
          toNodeId: id,
          toInputIndex: 0,
        });
      });

      if (analysisMarkdown.trim()) {
        const id = makeId("node");
        const node = createNodeFromType("text_node", id, baseX, baseY + segments.length * 230 + 48);
        node.title = `视频分析 ${segments.length}段`;
        node.properties = {
          ...node.properties,
          response: analysisMarkdown,
          text: "视频逐帧分析结果",
        };
        node.data = { response: analysisMarkdown, loading: false, status: "success" };
        nextNodes.push(node);
        createdNodes.push(node);
        nextOutputs.set(id, new Map([[0, analysisMarkdown]]));
        nextLinks.push({
          id: makeId("link"),
          fromNodeId: sourceNode.id,
          fromOutputIndex: 0,
          toNodeId: id,
          toInputIndex: 1,
        });
      }

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
      appendLog("success", `逐帧分析完成:生成 ${segments.length} 个关键帧节点${analysisMarkdown.trim() ? "和 1 个分析文本节点" : ""}`);
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
      title: title?.trim() || `工作流组 ${groups.length + 1}`,
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
    [nodes, links, nodeOutputs, apiConfig, appendLog, updateNodeData, writeNodeOutput]
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
      appendLog("error", `工作流存在循环依赖,无法执行。涉及节点:${cyclePath.join(", ")}`);
      return;
    }

    setIsRunning(true);
    setNodeOutputs(new Map());
    appendLog("info", `开始执行工作流 "${currentWorkflowSummary?.name ?? ""}",共 ${nodes.length} 个节点,分 ${levels.length} 层并发`);

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      appendLog("info", `第 ${i + 1}/${levels.length} 层 (${level.length} 个节点并发) — [${level.map((n) => n.title).join(", ")}]`);
      await Promise.all(level.map((node) => runNode(node.id)));
    }

    appendLog("success", "工作流执行完成。");
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
    const wf = makeEmptyWorkflow(name?.trim() || `工作流 ${Object.keys(workspace.workflows).length + 1}`);
    setWorkspace((prev) => ({
      ...prev,
      workflows: { ...prev.workflows, [wf.summary.id]: wf },
    }));
    appendLog("success", `已新建工作流 "${wf.summary.name}"`);
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
        `已从模板 "${tmpl.name}" 创建工作流 (${nodes.length} 节点, ${links.length} 连线, 分类 "${tmpl.category}", 预填 ${outputsMap.size} 个占位结果)`
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
        appendLog("warning", "当前没有可重置的工作流");
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
      appendLog("warning", `工作流 ${id} 不存在`);
      return false;
    }
    if (id === workspace.currentId) {
      appendLog("info", `已在工作流 "${workspace.workflows[id].summary.name}"`);
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
      appendLog("info", `已切换到工作流 "${target.summary.name}" (${nextNodes.length} 节点, ${target.data.links.length} 连线)`);
      return { ...prev, currentId: id };
    });
    return true;
  }, [workspace, appendLog, clearLinkDraft, resetHistory]);

  const renameWorkflow = useCallback((id: string, name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      appendLog("warning", "工作流名称不能为空");
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
      appendLog("warning", "至少需要保留一个工作流");
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
      appendLog("warning", `工作流 "${src.summary.name}" 已存在,无法还原`);
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
    appendLog("warning", `已清空回收站 (${count} 个工作流被永久删除)`);
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
      `自动清理回收站:已永久删除 ${expired.length} 个超过 ${TRASH_RETENTION_DAYS} 天的过期工作流${expired.length > 0 ? ` ("${expired.slice(0, 3).map((w) => w.summary.name).join('", "')}${expired.length > 3 ? '" 等' : '"'})` : ""}`
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
    appendLog("success", `已复制为新工作流 "${wf.summary.name}" (${wf.data.nodes.length} 节点)`);
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
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } catch {
        // quota exceeded or serialization error — silently ignore
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [nodes, links, nodeOutputs]);

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
      appendLog("info", `已从本地恢复 ${Object.keys(initial.workflows).length} 个工作流 (合计 ${totalNodes} 节点)`);
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
    removeNode,
    duplicateNode,
    updateNodePosition,
    updateNodeProperty,
    updateNodeData,
    addVideoFrameAnalysis,
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
