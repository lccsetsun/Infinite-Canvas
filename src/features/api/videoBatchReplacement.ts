import type { AiModel } from "./aiModelCatalog";
import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export interface BatchEditImagesRequest {
  prompt: string;
  productOssId: string[];
  customSize: string;
  ossId: string[];
  batchEditType?: "product" | "scene";
  model: Pick<AiModel, "apiId" | "modelId">;
}

export interface BatchEditFrameImage {
  url: string;
  ossId: string | number;
}

export interface BatchEditImagesResultItem {
  index: number;
  video?: string;
  url?: string;
  ossId?: string | number;
  frame_images?: BatchEditFrameImage[];
}

export type BatchEditImagesTaskStatus = "pending" | "success" | "error";

export interface BatchEditImagesSubmitResult {
  taskId: string;
  items: BatchEditImagesResultItem[];
}

export interface BatchEditImagesTaskResult {
  status: BatchEditImagesTaskStatus;
  items: BatchEditImagesResultItem[];
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

function extractBatchEditImagesTaskId(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.trim();
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

function extractBatchEditImagesItems(data: unknown): BatchEditImagesResultItem[] {
  if (Array.isArray(data)) return data as BatchEditImagesResultItem[];
  if (!isRecord(data)) return [];
  for (const key of ["items", "list", "result", "results", "resultList", "data"]) {
    const value = data[key];
    if (Array.isArray(value)) return value as BatchEditImagesResultItem[];
  }
  return [];
}

function extractBatchEditImagesRawStatus(data: unknown): string {
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

function extractBatchEditImagesError(data: unknown): string {
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

export function parseBatchEditImagesTaskResult(data: unknown): BatchEditImagesTaskResult {
  const items = extractBatchEditImagesItems(data);
  const rawStatus = extractBatchEditImagesRawStatus(data);
  const error = extractBatchEditImagesError(data);

  if (["success", "succeeded", "completed", "complete", "done"].includes(rawStatus)) {
    return { status: "success", items, error: "", rawStatus };
  }

  if (["failed", "fail", "error", "canceled", "cancelled"].includes(rawStatus)) {
    return { status: "error", items: [], error: error || "Batch replacement task failed", rawStatus };
  }

  return { status: "pending", items, error: "", rawStatus };
}

async function parseBatchEditImagesRunningError(
  response: Response
): Promise<BatchEditImagesTaskResult | null> {
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
  const message = firstString(parsed.msg, parsed.message).toLowerCase();
  if (code !== 500 || !/(running|generating|处理中|生成中|进行中|稍后)/i.test(message)) {
    return null;
  }

  return {
    status: "pending",
    items: [],
    error: "",
    rawStatus: "running",
  };
}

export async function batchEditImages(
  payload: BatchEditImagesRequest
): Promise<BatchEditImagesSubmitResult> {
  const requestPayload: BatchEditImagesRequest = {
    ...payload,
    batchEditType: payload.batchEditType ?? "product",
  };
  const response = await devApiFetch("/system/generator/batchEditImgaes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  return {
    taskId: extractBatchEditImagesTaskId(parsed.data),
    items: extractBatchEditImagesItems(parsed.data),
  };
}

export async function queryBatchEditImagesTask(
  taskId: string
): Promise<BatchEditImagesTaskResult> {
  const response = await devApiFetch(
    `/system/generator/batchEditImgaes/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
    }
  );
  const runningResult = await parseBatchEditImagesRunningError(response.clone());
  if (runningResult) return runningResult;

  const parsed = await parseDevApiEnvelope<unknown>(response);
  return parseBatchEditImagesTaskResult(parsed.data);
}
