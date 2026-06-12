import type { AiModel } from "../api/aiModelCatalog";
import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export type RemoteVideoTaskStatus = "pending" | "success" | "error";

export interface RemoteVideoTaskResult {
  status: RemoteVideoTaskStatus;
  videoUrl: string;
  error: string;
  rawStatus: string;
}

export interface CreateRemoteVideoTaskInput {
  prompt: string;
  duration: number;
  generateAudio: boolean;
  ratio: string;
  resolution: string;
  ossIds: string[];
  resourceIds: number[];
  model: Pick<AiModel, "apiId" | "modelId">;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return String(value);
  }
  return "";
}

function findNestedString(value: unknown, keys: string[]): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findNestedString(item, keys);
      if (nested) return nested;
    }
    return "";
  }
  if (!isRecord(value)) return "";

  for (const key of keys) {
    const next = value[key];
    if (typeof next === "string" && next.trim()) return next.trim();
  }

  for (const key of ["data", "result", "output", "video", "file", "info", "payload"]) {
    const nested = findNestedString(value[key], keys);
    if (nested) return nested;
  }
  return "";
}

function isLikelyUrl(value: string): boolean {
  const normalized = value.trim();
  return /^(https?:|blob:|data:video\/)/i.test(normalized) || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(normalized);
}

function extractRemoteVideoTaskId(data: unknown): string {
  if (typeof data === "string" && data.trim() && !isLikelyUrl(data)) return data.trim();
  if (!isRecord(data)) return "";
  return firstString(
    data.id,
    data.taskId,
    data.task_id,
    data.jobId,
    data.job_id,
    isRecord(data.data) ? data.data.id : undefined,
    isRecord(data.data) ? data.data.taskId : undefined,
    isRecord(data.data) ? data.data.task_id : undefined
  );
}

function extractRemoteVideoUrl(data: unknown): string {
  const candidate = findNestedString(data, [
    "videoUrl",
    "video_url",
    "url",
    "src",
    "fileUrl",
    "file_url",
    "downloadUrl",
    "download_url",
    "result",
    "output",
  ]);
  return isLikelyUrl(candidate) ? candidate : "";
}

function extractRemoteVideoRawStatus(data: unknown): string {
  if (!isRecord(data)) return "";
  return firstString(
    data.status,
    data.state,
    data.taskStatus,
    data.task_status,
    isRecord(data.data) ? data.data.status : undefined,
    isRecord(data.data) ? data.data.state : undefined,
    isRecord(data.data) ? data.data.taskStatus : undefined,
    isRecord(data.data) ? data.data.task_status : undefined
  ).toLowerCase();
}

function extractRemoteVideoError(data: unknown): string {
  if (!isRecord(data)) return "";
  return firstString(
    data.error,
    data.message,
    data.msg,
    data.reason,
    isRecord(data.data) ? data.data.error : undefined,
    isRecord(data.data) ? data.data.message : undefined,
    isRecord(data.data) ? data.data.msg : undefined
  );
}

export function parseRemoteVideoTaskResult(data: unknown): RemoteVideoTaskResult {
  const videoUrl = extractRemoteVideoUrl(data);
  const rawStatus = extractRemoteVideoRawStatus(data);
  const error = extractRemoteVideoError(data);

  if (videoUrl) {
    return { status: "success", videoUrl, error: "", rawStatus };
  }

  if (["failed", "fail", "error", "canceled", "cancelled"].includes(rawStatus)) {
    return { status: "error", videoUrl: "", error: error || "视频生成任务失败", rawStatus };
  }

  return { status: "pending", videoUrl: "", error: "", rawStatus };
}

async function parseRemoteVideoRunningError(response: Response): Promise<RemoteVideoTaskResult | null> {
  const rawText = await response.text().catch(() => "");
  if (!rawText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const code = typeof parsed.code === "number" ? parsed.code : undefined;
  const message = firstString(parsed.msg, parsed.message);
  if (code !== 500 || !/未知任务状态[:：]\s*running/i.test(message)) return null;

  return {
    status: "pending",
    videoUrl: "",
    error: "",
    rawStatus: "running",
  };
}

export async function createRemoteVideoGenerationTask({
  prompt,
  duration,
  generateAudio,
  ratio,
  resolution,
  ossIds,
  resourceIds,
  model,
  timeoutMs,
  signal,
}: CreateRemoteVideoTaskInput): Promise<{ taskId: string; videoUrl: string }> {
  const response = await devApiFetch("/system/generator/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeoutMs,
    signal,
    body: JSON.stringify({
      prompt,
      duration,
      generateAudio,
      ratio,
      resolution,
      ossId: ossIds,
      resrouceId: resourceIds,
      model: {
        apiId: model.apiId,
        modelId: model.modelId,
      },
    }),
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  const taskId = extractRemoteVideoTaskId(parsed.data);
  const videoUrl = extractRemoteVideoUrl(parsed.data);
  if (!taskId && !videoUrl) {
    throw new Error("远程视频模型未返回任务 ID");
  }
  return { taskId, videoUrl };
}

export async function queryRemoteVideoGenerationTask(
  taskId: string
): Promise<RemoteVideoTaskResult> {
  const response = await devApiFetch(`/system/generator/video/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const runningResult = await parseRemoteVideoRunningError(response.clone());
  if (runningResult) return runningResult;

  const parsed = await parseDevApiEnvelope<unknown>(response);
  return parseRemoteVideoTaskResult(parsed.data);
}
