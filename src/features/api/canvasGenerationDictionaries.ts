import {
  IMAGE_RESOLUTION_PRESET_GROUPS,
  type ImageResolutionPresetGroup,
} from "../nodes/imageResolutionPresets";
import { devApiFetch } from "../auth/request";
import {
  DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS,
  type VideoBatchReplacementMode,
  type VideoBatchReplacementModeOption,
} from "../../utils/videoBatchReplacementLayout";

export interface CanvasGenerationDictionaries {
  imageResolutionGroups: ImageResolutionPresetGroup[];
  videoBatchReplacementModeOptions: VideoBatchReplacementModeOption[];
  videoResolutionGroups: ImageResolutionPresetGroup[];
}

interface DictRow {
  dictLabel?: unknown;
  dictSort?: unknown;
  dictValue?: unknown;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);
  return "";
}

function sortDictRows(rows: DictRow[]): DictRow[] {
  return [...rows].sort((left, right) => {
    const leftSort = Number(left.dictSort ?? 0);
    const rightSort = Number(right.dictSort ?? 0);
    return leftSort - rightSort;
  });
}

function parseDictRows(payload: unknown): DictRow[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as DictRow[]) : [];
}

async function fetchDictRows(dictType: string): Promise<DictRow[]> {
  const response = await devApiFetch(
    `/system/dict/data/list?dictType=${encodeURIComponent(dictType)}`,
    { method: "GET", timeoutMs: 10000 }
  );
  const payload = await response.json().catch(() => null);
  return sortDictRows(parseDictRows(payload));
}

function parseSize(value: string): { width: number; height: number } {
  const match = value.match(/(\d+)\s*[xX*×]\s*(\d+)/);
  if (!match) return { height: 0, width: 0 };
  return {
    height: Number.parseInt(match[2], 10),
    width: Number.parseInt(match[1], 10),
  };
}

function resolutionLabelFromKey(key: string, fallback: string): string {
  const match = key.match(/_(\d+k)$/i);
  if (match) return match[1].toUpperCase();
  return fallback || key;
}

export function buildImageResolutionGroupsFromDicts(
  imageKeyRows: DictRow[],
  ratioRowsByKey: Record<string, DictRow[]>
): ImageResolutionPresetGroup[] {
  const groups = sortDictRows(imageKeyRows)
    .map((row) => {
      const key = stringValue(row.dictValue) || stringValue(row.dictLabel);
      if (!key) return null;
      const resolution = resolutionLabelFromKey(key, stringValue(row.dictLabel));
      const presets = sortDictRows(ratioRowsByKey[key] ?? [])
        .map((ratioRow) => {
          const aspectRatio = stringValue(ratioRow.dictLabel) || stringValue(ratioRow.dictValue);
          const size = parseSize(stringValue(ratioRow.dictValue));
          if (!aspectRatio || size.width <= 0 || size.height <= 0) return null;
          return {
            aspectRatio,
            height: size.height,
            resolution,
            width: size.width,
          };
        })
        .filter((preset): preset is ImageResolutionPresetGroup["presets"][number] =>
          Boolean(preset)
        );
      return presets.length > 0 ? { presets, resolution } : null;
    })
    .filter((group): group is ImageResolutionPresetGroup => Boolean(group));

  return groups.length > 0 ? groups : IMAGE_RESOLUTION_PRESET_GROUPS;
}

export function buildVideoResolutionGroupsFromDicts(
  ratioRows: DictRow[],
  resolutionRows: DictRow[]
): ImageResolutionPresetGroup[] {
  const ratios = sortDictRows(ratioRows)
    .map((row) => stringValue(row.dictValue) || stringValue(row.dictLabel))
    .filter(Boolean);
  const resolutions = sortDictRows(resolutionRows)
    .map((row) => stringValue(row.dictValue) || stringValue(row.dictLabel))
    .filter(Boolean);

  if (ratios.length === 0 || resolutions.length === 0) return [];

  return resolutions.map((resolution) => ({
    presets: ratios.map((aspectRatio) => ({
      aspectRatio,
      height: 0,
      resolution,
      width: 0,
    })),
    resolution,
  }));
}

function normalizeBatchEditImageModeValue(
  value: string,
  label: string
): VideoBatchReplacementMode | null {
  const normalized = value.toLowerCase();
  if (normalized === "product" || label.includes("产品")) return "product";
  if (normalized === "scene" || label.includes("场景")) return "scene";
  return null;
}

export function buildVideoBatchReplacementModeOptionsFromDicts(
  rows: DictRow[]
): VideoBatchReplacementModeOption[] {
  const options = sortDictRows(rows)
    .map((row) => {
      const label = stringValue(row.dictLabel);
      const value = stringValue(row.dictValue);
      const mode = normalizeBatchEditImageModeValue(value, label);
      if (!mode) return null;
      const fallbackLabel =
        DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS.find((option) => option.value === mode)
          ?.label ?? label;
      return {
        label: label || fallbackLabel,
        value: mode,
      };
    })
    .filter((option): option is VideoBatchReplacementModeOption => Boolean(option));

  const uniqueOptions = options.filter(
    (option, index) => options.findIndex((item) => item.value === option.value) === index
  );

  return uniqueOptions.length > 0 ? uniqueOptions : DEFAULT_VIDEO_BATCH_REPLACEMENT_MODE_OPTIONS;
}

export async function fetchCanvasGenerationDictionaries(): Promise<CanvasGenerationDictionaries> {
  const imageKeyRows = await fetchDictRows("images_ratio_key");
  const imageRatioKeys = imageKeyRows
    .map((row) => stringValue(row.dictValue) || stringValue(row.dictLabel))
    .filter(Boolean);

  const [imageRatioRows, videoRatioRows, videoResolutionRows, batchEditImageRows] =
    await Promise.all([
      Promise.all(imageRatioKeys.map(async (key) => [key, await fetchDictRows(key)] as const)).then(
        (entries) => Object.fromEntries(entries)
      ),
      fetchDictRows("video_ratio"),
      fetchDictRows("video_p"),
      fetchDictRows("batch_edit_image_key"),
    ]);

  return {
    imageResolutionGroups: buildImageResolutionGroupsFromDicts(imageKeyRows, imageRatioRows),
    videoBatchReplacementModeOptions:
      buildVideoBatchReplacementModeOptionsFromDicts(batchEditImageRows),
    videoResolutionGroups: buildVideoResolutionGroupsFromDicts(videoRatioRows, videoResolutionRows),
  };
}
