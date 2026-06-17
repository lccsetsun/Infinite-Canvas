import type { GraphNode } from "../types";

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

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function resolveVideoBatchReplacementSourceFrames(frameAnalysisNode: GraphNode): {
  frameCount: number;
  ossIds: string[];
} {
  const groupSourceOssIds = collectOssIdsFromValue(
    frameAnalysisNode.data?.groupBatchReplacementSourceOssIds
  );
  if (groupSourceOssIds.length > 0) {
    return {
      frameCount: groupSourceOssIds.length,
      ossIds: groupSourceOssIds,
    };
  }

  const ossIds = collectOssIdsFromValue(frameAnalysisNode.data?.frameImageOssIds);
  const visibleFrameUrls = [
    ...normalizeStringList(frameAnalysisNode.data?.imageUrls),
    ...normalizeStringList(frameAnalysisNode.properties.imageUrls),
  ];

  return {
    frameCount: Math.max(ossIds.length, visibleFrameUrls.length),
    ossIds,
  };
}
