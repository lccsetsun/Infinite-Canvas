import type { GraphNode } from "../../types";

const STORAGE_KEY = "aicanvas_workspace_v2";
const WORKSPACE_VERSION = 2 as const;

export interface HomeWorkflowSummary {
  id: string;
  name: string;
  category?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  coverUrl?: string;
}

interface HomeWorkflowData {
  nodes: GraphNode[];
  links: Array<unknown>;
  nodeOutputs: Array<unknown>;
  groups?: Array<unknown>;
}

interface HomeWorkflow {
  summary: HomeWorkflowSummary;
  data: HomeWorkflowData;
}

interface HomeWorkspaceSnapshot {
  version: number;
  currentId: string;
  workflows: Record<string, HomeWorkflow>;
  trash: HomeWorkflow[];
}

export interface HomeProjectCard {
  id: string;
  name: string;
  updatedAt: number;
  tagLabel: string;
  previewUrl: string;
  nodeCount: number;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function makeEmptyWorkflow(name = "默认项目"): HomeWorkflow {
  const id = makeId("wf");
  const now = Date.now();
  return {
    summary: {
      id,
      name,
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    data: {
      nodes: [],
      links: [],
      nodeOutputs: [],
    },
  };
}

function makeWorkspace(): HomeWorkspaceSnapshot {
  const workflow = makeEmptyWorkflow();
  return {
    version: WORKSPACE_VERSION,
    currentId: workflow.summary.id,
    workflows: {
      [workflow.summary.id]: workflow,
    },
    trash: [],
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object";
}

function readWorkspace(): HomeWorkspaceSnapshot {
  if (typeof localStorage === "undefined") {
    return makeWorkspace();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeWorkspace();
    const parsed = JSON.parse(raw) as HomeWorkspaceSnapshot;
    if (!isRecord(parsed) || !isRecord(parsed.workflows) || typeof parsed.currentId !== "string") {
      return makeWorkspace();
    }
    return parsed;
  } catch {
    return makeWorkspace();
  }
}

function writeWorkspace(workspace: HomeWorkspaceSnapshot) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function getNodePreviewUrl(node: GraphNode) {
  const imageList = Array.isArray(node.data?.imageUrls) ? node.data?.imageUrls : [];
  const candidates = [
    typeof node.data?.imageUrl === "string" ? node.data.imageUrl : "",
    typeof node.properties?.imageUrl === "string" ? node.properties.imageUrl : "",
    typeof node.data?.videoFrameUrl === "string" ? node.data.videoFrameUrl : "",
    typeof node.data?.videoUrl === "string" ? node.data.videoUrl : "",
    typeof node.properties?.videoUrl === "string" ? node.properties.videoUrl : "",
    imageList.find((item) => typeof item === "string" && item.trim()) ?? "",
  ];

  return candidates.find((item) => typeof item === "string" && item.trim())?.trim() || "";
}

function getWorkflowPreviewUrl(workflow: HomeWorkflow) {
  if (typeof workflow.summary.coverUrl === "string" && workflow.summary.coverUrl.trim()) {
    return workflow.summary.coverUrl.trim();
  }
  for (const node of workflow.data.nodes ?? []) {
    const previewUrl = getNodePreviewUrl(node);
    if (previewUrl) return previewUrl;
  }
  return "";
}

function getWorkflowTag(workflow: HomeWorkflow) {
  if (workflow.summary.tags?.length) return workflow.summary.tags[0];
  if (workflow.summary.category) return workflow.summary.category;

  const nodeTypes = new Set((workflow.data.nodes ?? []).map((node) => node.type));
  if (nodeTypes.has("video_node")) return "视频项目";
  if (nodeTypes.has("image_node")) return "图像项目";
  if (nodeTypes.has("text_node")) return "文本项目";
  return "创作项目";
}

export function listRecentHomeProjects(limit = 4): HomeProjectCard[] {
  const workspace = readWorkspace();
  return Object.values(workspace.workflows)
    .sort((a, b) => b.summary.updatedAt - a.summary.updatedAt)
    .slice(0, limit)
    .map((workflow) => ({
      id: workflow.summary.id,
      name: workflow.summary.name || "未命名",
      updatedAt: workflow.summary.updatedAt,
      tagLabel: getWorkflowTag(workflow),
      previewUrl: getWorkflowPreviewUrl(workflow),
      nodeCount: workflow.data.nodes?.length ?? 0,
    }));
}

export function openHomeProject(projectId: string) {
  const workspace = readWorkspace();
  if (!workspace.workflows[projectId]) return false;
  workspace.currentId = projectId;
  writeWorkspace(workspace);
  return true;
}

export function createHomeProject(name?: string) {
  const workspace = readWorkspace();
  const workflow = makeEmptyWorkflow(name?.trim() || `项目 ${Object.keys(workspace.workflows).length + 1}`);
  workspace.workflows[workflow.summary.id] = workflow;
  workspace.currentId = workflow.summary.id;
  writeWorkspace(workspace);
  return workflow.summary.id;
}

export function renameHomeProject(projectId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const workspace = readWorkspace();
  const target = workspace.workflows[projectId];
  if (!target) return false;
  target.summary.name = trimmed;
  target.summary.updatedAt = Date.now();
  writeWorkspace(workspace);
  return true;
}

export function updateHomeProjectCover(projectId: string, coverUrl: string) {
  const workspace = readWorkspace();
  const target = workspace.workflows[projectId];
  if (!target) return false;
  target.summary.coverUrl = coverUrl.trim();
  target.summary.updatedAt = Date.now();
  writeWorkspace(workspace);
  return true;
}

export function duplicateHomeProject(projectId: string) {
  const workspace = readWorkspace();
  const source = workspace.workflows[projectId];
  if (!source) return "";
  const now = Date.now();
  const nextId = makeId("wf");
  const cloned = JSON.parse(JSON.stringify(source)) as HomeWorkflow;
  cloned.summary = {
    ...cloned.summary,
    id: nextId,
    name: `${source.summary.name} 副本`,
    createdAt: now,
    updatedAt: now,
  };
  workspace.workflows[nextId] = cloned;
  workspace.currentId = nextId;
  writeWorkspace(workspace);
  return nextId;
}

export function deleteHomeProject(projectId: string) {
  const workspace = readWorkspace();
  if (!workspace.workflows[projectId]) return false;
  delete workspace.workflows[projectId];
  const remainingIds = Object.keys(workspace.workflows);
  if (remainingIds.length === 0) {
    const fallback = makeEmptyWorkflow();
    workspace.workflows[fallback.summary.id] = fallback;
    workspace.currentId = fallback.summary.id;
  } else if (workspace.currentId === projectId) {
    workspace.currentId = remainingIds[0];
  }
  writeWorkspace(workspace);
  return true;
}
