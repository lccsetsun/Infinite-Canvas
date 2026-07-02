import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";
import type { CanvasAsset, CanvasAssetKind } from "../../utils/canvasAssets";

export interface ListOssResourceAssetsParams {
  fileName?: string;
  kind: CanvasAssetKind | "portrait";
  tabType: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return String(value);
  }
  return "";
}

function timestampValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 0;
}

function normalizeResourceKind(kind: CanvasAssetKind | "portrait"): CanvasAssetKind {
  return kind === "portrait" ? "image" : kind;
}

function extractRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  for (const key of ["rows", "list", "records", "items", "data"]) {
    const value = data[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      const nested = extractRows(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function toCanvasAsset(
  item: unknown,
  index: number,
  params: ListOssResourceAssetsParams
): CanvasAsset | null {
  if (!isRecord(item)) return null;
  const url = stringValue(
    item.url,
    item.fileUrl,
    item.ossUrl,
    item.resourceUrl,
    item.previewUrl,
    item.thumbnailUrl,
    item.filePath
  );
  if (!url) return null;
  const fileName = stringValue(item.fileName, item.name, item.originalName, item.realName) || "历史资产";
  const id = stringValue(item.ossId, item.id, item.ossFileId, item.fileId) || `${params.tabType}-${index}-${url}`;
  return {
    createdAt: timestampValue(
      item.createTime,
      item.createdAt,
      item.createAt,
      item.updateTime,
      item.updatedAt
    ),
    id: `oss:${id}`,
    kind: normalizeResourceKind(params.kind),
    nodeId: `oss:${id}`,
    nodeTitle: fileName,
    source: params.tabType,
    url,
  };
}

export async function listOssResourceAssets(
  params: ListOssResourceAssetsParams
): Promise<CanvasAsset[]> {
  const query = new URLSearchParams({
    fileName: params.fileName ?? "",
    tabType: params.tabType,
  });
  const response = await devApiFetch(`/ai/resource/oss/list?${query.toString()}`, {
    method: "GET",
    timeoutMs: 10000,
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  return extractRows(parsed.data)
    .map((item, index) => toCanvasAsset(item, index, params))
    .filter((asset): asset is CanvasAsset => Boolean(asset));
}
