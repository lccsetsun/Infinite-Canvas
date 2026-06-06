import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";
import type { GraphLink, GraphNode, GroupBox } from "../../types";
import type { HomeProjectCard } from "./projectTypes";

export type SerializedNodeOutput = [string, [number, unknown][]];

export interface RemoteCanvasWorkflowData {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeOutputs: SerializedNodeOutput[];
  groups?: GroupBox[];
}

export interface RemoteCanvasProject {
  id: string;
  name: string;
  coverUrl: string;
  category?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  workflow: RemoteCanvasWorkflowData;
}

export interface RemoteCanvasListResponse {
  projects: HomeProjectCard[];
  total: number;
}

export interface RemoteCanvasListItem {
  id?: string;
  canvasId?: string;
  canvasName?: string;
  projectName?: string;
  name?: string;
  previewImage?: string;
  previewImageUrl?: string;
  coverUrl?: string;
  category?: string;
  tags?: string[];
  nodeCount?: number;
  createTime?: string | number;
  createdAt?: string | number;
  updateTime?: string | number;
  updatedAt?: string | number;
}

type RemoteCanvasListEnvelope = {
  rows?: RemoteCanvasListItem[];
  total?: number;
  list?: RemoteCanvasListItem[];
  data?: {
    rows?: RemoteCanvasListItem[];
    total?: number;
    list?: RemoteCanvasListItem[];
  };
};

type RemoteCanvasDetailResponse = Record<string, unknown>;

function toTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWorkflowData(raw: unknown): RemoteCanvasWorkflowData {
  if (!isRecord(raw)) {
    return { nodes: [], links: [], nodeOutputs: [], groups: [] };
  }

  return {
    nodes: Array.isArray(raw.nodes) ? (raw.nodes as GraphNode[]) : [],
    links: Array.isArray(raw.links) ? (raw.links as GraphLink[]) : [],
    nodeOutputs: Array.isArray(raw.nodeOutputs) ? (raw.nodeOutputs as SerializedNodeOutput[]) : [],
    groups: Array.isArray(raw.groups) ? (raw.groups as GroupBox[]) : [],
  };
}

function extractWorkflowData(payload: Record<string, unknown>): RemoteCanvasWorkflowData {
  const nestedCandidates = [payload.metadata, payload.data, payload.canvasData, payload.content, payload.workflow];

  for (const candidate of nestedCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      try {
        return normalizeWorkflowData(JSON.parse(candidate));
      } catch {
        // Ignore invalid JSON and continue checking other shapes.
      }
    }

    if (isRecord(candidate)) {
      return normalizeWorkflowData(candidate);
    }
  }

  return normalizeWorkflowData(payload);
}

export function mapRemoteProjectToCard(item: RemoteCanvasListItem): HomeProjectCard {
  return {
    id: String(item.id || item.canvasId || ""),
    name: String(item.canvasName || item.projectName || item.name || "未命名项目"),
    updatedAt: toTimestamp(item.updatedAt ?? item.updateTime),
    tagLabel: item.category || toStringArray(item.tags)[0] || "创作项目",
    previewUrl:
      typeof item.previewImage === "string" && item.previewImage.trim()
        ? item.previewImage.trim()
        : typeof item.previewImageUrl === "string" && item.previewImageUrl.trim()
          ? item.previewImageUrl.trim()
          : typeof item.coverUrl === "string"
            ? item.coverUrl.trim()
            : "",
    nodeCount: typeof item.nodeCount === "number" ? item.nodeCount : 0,
  };
}

export async function listRemoteProjects({
  pageNum,
  pageSize,
}: {
  pageNum: number;
  pageSize: number;
}): Promise<RemoteCanvasListResponse> {
  const response = await devApiFetch(`/system/canvas/list?pageNum=${pageNum}&pageSize=${pageSize}`, {
    method: "GET",
  });
  const parsed = await parseDevApiEnvelope<RemoteCanvasListEnvelope>(response);
  const envelope: RemoteCanvasListEnvelope = isRecord(parsed.data)
    ? (parsed.data as RemoteCanvasListEnvelope)
    : (parsed as unknown as RemoteCanvasListEnvelope);
  const rows = Array.isArray(envelope?.rows)
    ? envelope.rows
    : Array.isArray(envelope?.list)
      ? envelope.list
      : [];

  return {
    total: typeof envelope?.total === "number" ? envelope.total : rows.length,
    projects: rows.map(mapRemoteProjectToCard),
  };
}

export async function getRemoteProjectDetail(projectId: string): Promise<RemoteCanvasProject> {
  const response = await devApiFetch(`/system/canvas/${projectId}`, {
    method: "GET",
  });
  const parsed = await parseDevApiEnvelope<RemoteCanvasDetailResponse>(response);
  const payload = isRecord(parsed.data) ? parsed.data : {};
  const workflow = extractWorkflowData(payload);
  const tags = toStringArray(payload.tags);

  return {
    id: String(payload.id || payload.canvasId || projectId),
    name: String(payload.canvasName || payload.projectName || payload.name || "未命名项目"),
    coverUrl:
      typeof payload.previewImage === "string" && payload.previewImage.trim()
        ? payload.previewImage.trim()
        : typeof payload.previewImageUrl === "string" && payload.previewImageUrl.trim()
          ? payload.previewImageUrl.trim()
          : typeof payload.coverUrl === "string"
            ? payload.coverUrl.trim()
            : "",
    category: typeof payload.category === "string" && payload.category.trim() ? payload.category.trim() : undefined,
    tags,
    createdAt: toTimestamp(payload.createdAt ?? payload.createTime),
    updatedAt: toTimestamp(payload.updatedAt ?? payload.updateTime),
    nodeCount: workflow.nodes.length,
    workflow,
  };
}

function buildProjectPayload(project: {
  id?: string;
  name: string;
  coverUrl?: string;
  category?: string;
  tags?: string[];
  workflow: RemoteCanvasWorkflowData;
}) {
  const serializedWorkflow = JSON.stringify(project.workflow);
  return {
    ...(project.id ? { id: project.id } : {}),
    canvasName: project.name,
    projectName: project.name,
    name: project.name,
    previewImage: project.coverUrl || "",
    previewImageUrl: project.coverUrl || "",
    coverUrl: project.coverUrl || "",
    category: project.category || "",
    tags: project.tags || [],
    metadata: serializedWorkflow,
    data: project.workflow,
    canvasData: serializedWorkflow,
    nodes: project.workflow.nodes,
    links: project.workflow.links,
    nodeOutputs: project.workflow.nodeOutputs,
    groups: project.workflow.groups || [],
  };
}

export async function createRemoteProject(project: {
  name: string;
  coverUrl?: string;
  category?: string;
  tags?: string[];
  workflow?: RemoteCanvasWorkflowData;
}) {
  const workflow = project.workflow || { nodes: [], links: [], nodeOutputs: [], groups: [] };
  const response = await devApiFetch("/system/canvas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildProjectPayload({ ...project, workflow })),
  });
  const parsed = await parseDevApiEnvelope<Record<string, unknown>>(response);
  const createdId = String(
    (isRecord(parsed.data) && (parsed.data.id || parsed.data.canvasId || parsed.data.projectId)) || ""
  ).trim();
  return createdId;
}

export async function updateRemoteProject(project: {
  id: string;
  name: string;
  coverUrl?: string;
  category?: string;
  tags?: string[];
  workflow: RemoteCanvasWorkflowData;
}) {
  const response = await devApiFetch("/system/canvas", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildProjectPayload(project)),
  });
  await parseDevApiEnvelope<unknown>(response);
}

export async function deleteRemoteProject(ids: string | string[]) {
  const joinedIds = Array.isArray(ids) ? ids.join(",") : ids;
  const response = await devApiFetch(`/system/canvas/${joinedIds}`, {
    method: "DELETE",
  });
  await parseDevApiEnvelope<unknown>(response);
}

export async function copyRemoteProject(id: string) {
  const response = await devApiFetch(`/system/canvas/copy/${id}`, {
    method: "GET",
  });
  const parsed = await parseDevApiEnvelope<Record<string, unknown>>(response);
  return String(
    (isRecord(parsed.data) && (parsed.data.id || parsed.data.canvasId || parsed.data.projectId)) || ""
  ).trim();
}

export async function renameRemoteProject(projectId: string, name: string) {
  const detail = await getRemoteProjectDetail(projectId);
  await updateRemoteProject({
    id: detail.id,
    name,
    coverUrl: detail.coverUrl,
    category: detail.category,
    tags: detail.tags,
    workflow: detail.workflow,
  });
}

export async function updateRemoteProjectCover(projectId: string, coverUrl: string) {
  const detail = await getRemoteProjectDetail(projectId);
  await updateRemoteProject({
    id: detail.id,
    name: detail.name,
    coverUrl,
    category: detail.category,
    tags: detail.tags,
    workflow: detail.workflow,
  });
}
