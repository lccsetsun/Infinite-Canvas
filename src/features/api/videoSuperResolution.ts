import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export const VIDEO_SUPER_RESOLUTION_SUBMIT_ENDPOINT =
  "/system/ai/videoEnhance";
export const VIDEO_SUPER_RESOLUTION_QUERY_ENDPOINT =
  "/system/ai/videoEnhance";

export type VideoSuperResolutionTaskStatus = "pending" | "success" | "error";

export interface VideoSuperResolutionSubmitInput {
  videoUrl: string;
}

export interface VideoSuperResolutionSubmitResult {
  taskId: string;
  videoUrl: string;
}

export interface VideoSuperResolutionTaskResult {
  status: VideoSuperResolutionTaskStatus;
  videoUrl: string;
  error: string;
  rawStatus: string;
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

function isLikelyVideoUrl(value: string): boolean {
  const normalized = value.trim();
  return /^(https?:|blob:|data:video\/)/i.test(normalized) || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(normalized);
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

  for (const key of ["data", "result", "output", "video", "file", "payload"]) {
    const nested = findNestedString(value[key], keys);
    if (nested) return nested;
  }
  return "";
}

function extractTaskId(data: unknown): string {
  if (typeof data === "string" && data.trim() && !isLikelyVideoUrl(data)) return data.trim();
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

function extractVideoUrl(data: unknown): string {
  const candidate = findNestedString(data, [
    "url",
    "videoUrl",
    "video_url",
    "src",
    "fileUrl",
    "file_url",
    "downloadUrl",
    "download_url",
    "result",
    "output",
  ]);
  return isLikelyVideoUrl(candidate) ? candidate : "";
}

function extractRawStatus(data: unknown): string {
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

function extractError(data: unknown): string {
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

export function parseVideoSuperResolutionTaskResult(
  data: unknown
): VideoSuperResolutionTaskResult {
  const videoUrl = extractVideoUrl(data);
  const rawStatus = extractRawStatus(data);
  const error = extractError(data);

  if (videoUrl) {
    return { status: "success", videoUrl, error: "", rawStatus };
  }

  if (["failed", "fail", "error", "canceled", "cancelled"].includes(rawStatus)) {
    return { status: "error", videoUrl: "", error: error || "视频超分任务失败", rawStatus };
  }

  return { status: "pending", videoUrl: "", error: "", rawStatus };
}

export async function submitVideoSuperResolution({
  videoUrl,
}: VideoSuperResolutionSubmitInput): Promise<VideoSuperResolutionSubmitResult> {
  const trimmedVideoUrl = videoUrl.trim();
  const response = await devApiFetch(VIDEO_SUPER_RESOLUTION_SUBMIT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoUrl: trimmedVideoUrl,
    }),
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  const taskId = extractTaskId(parsed.data);
  const resultVideoUrl = extractVideoUrl(parsed.data);
  if (!taskId && !resultVideoUrl) {
    throw new Error("视频超分接口未返回任务 ID");
  }
  return { taskId, videoUrl: resultVideoUrl };
}

export async function queryVideoSuperResolutionTask(
  taskId: string
): Promise<VideoSuperResolutionTaskResult> {
  const response = await devApiFetch(
    `${VIDEO_SUPER_RESOLUTION_QUERY_ENDPOINT}/${encodeURIComponent(taskId)}`,
    { method: "GET" }
  );
  const parsed = await parseDevApiEnvelope<unknown>(response);
  return parseVideoSuperResolutionTaskResult(parsed.data);
}
