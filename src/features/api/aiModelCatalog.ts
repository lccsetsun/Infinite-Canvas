import { devApiFetch } from "../auth/request";

export type AiModelType = "文本" | "图片" | "视频" | "音频";

export interface AiModel {
  id: string;
  apiId: string;
  modelId: string;
  modelType: string;
  price?: number;
  chargeUnit?: number;
  desc?: string;
  isDeleted?: number;
}

export type AiModelsByType = Record<AiModelType, AiModel[]>;

export const AI_MODEL_TYPES: AiModelType[] = ["文本", "图片", "视频", "音频"];

export const EMPTY_AI_MODELS_BY_TYPE: AiModelsByType = {
  文本: [],
  图片: [],
  视频: [],
  音频: [],
};

export function makeEmptyAiModelsByType(): AiModelsByType {
  return {
    文本: [],
    图片: [],
    视频: [],
    音频: [],
  };
}

function isAiModelType(value: string): value is AiModelType {
  return AI_MODEL_TYPES.includes(value as AiModelType);
}

function normalizeIdValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "bigint") return String(value);
  return "";
}

function normalizeModelRow(row: unknown): AiModel | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Partial<AiModel>;
  if (typeof item.modelId !== "string" || !item.modelId.trim()) return null;
  if (typeof item.modelType !== "string" || !item.modelType.trim()) return null;
  return {
    id: normalizeIdValue(item.id),
    apiId: normalizeIdValue(item.apiId),
    modelId: item.modelId.trim(),
    modelType: item.modelType.trim(),
    price: typeof item.price === "number" ? item.price : undefined,
    chargeUnit: typeof item.chargeUnit === "number" ? item.chargeUnit : undefined,
    desc: typeof item.desc === "string" ? item.desc : undefined,
    isDeleted: typeof item.isDeleted === "number" ? item.isDeleted : undefined,
  };
}

export function groupAiModelsByType(rows: unknown[]): AiModelsByType {
  const grouped = makeEmptyAiModelsByType();
  rows.map(normalizeModelRow).forEach((item) => {
    if (!item || !isAiModelType(item.modelType)) return;
    grouped[item.modelType].push(item);
  });
  return grouped;
}

export function getModelOptionGroups(
  _builtInModels: string[],
  remoteModels: AiModel[]
): { builtIn: string[]; remote: string[] } {
  const remoteSeen = new Set<string>();
  const remote: string[] = [];

  remoteModels.forEach((model) => {
    const modelId = model.modelId.trim();
    if (!modelId || remoteSeen.has(modelId)) return;
    remoteSeen.add(modelId);
    remote.push(modelId);
  });

  return { builtIn: [], remote };
}

export async function fetchAiModelCatalog(): Promise<AiModelsByType> {
  const response = await devApiFetch("/system/model/list?pageNum=1&pageSize=100", {
    method: "GET",
    timeoutMs: 10000,
  });
  const data = await response.json().catch(() => null);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return groupAiModelsByType(rows);
}
