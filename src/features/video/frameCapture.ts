import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export type VideoFrameCaptureItem = {
  index: number;
  videoUrl: string;
  frameImages: string[];
  frameImageOssIds: string[];
};

type RawVideoFrameCaptureItem = {
  index?: unknown;
  video?: unknown;
  frame_images?: unknown;
};

function normalizeFrameImageUrl(item: unknown) {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && "url" in item) {
    const url = (item as { url?: unknown }).url;
    return typeof url === "string" ? url.trim() : "";
  }
  return "";
}

function normalizeFrameImageOssId(item: unknown) {
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  const value = record.ossId ?? record.oss_id ?? record.ossID ?? record.id;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "bigint") return String(value);
  return "";
}

function normalizeFrameCaptureItem(
  item: RawVideoFrameCaptureItem,
  fallbackIndex: number
): VideoFrameCaptureItem | null {
  const videoUrl = typeof item.video === "string" ? item.video.trim() : "";
  const normalizedFrameImages = Array.isArray(item.frame_images)
    ? item.frame_images
        .map((frameImage) => ({
          ossId: normalizeFrameImageOssId(frameImage),
          url: normalizeFrameImageUrl(frameImage),
        }))
        .filter((frameImage) => Boolean(frameImage.url))
    : [];
  const frameImages = normalizedFrameImages.map((frameImage) => frameImage.url);
  const frameImageOssIds = normalizedFrameImages.map((frameImage) => frameImage.ossId);

  if (!videoUrl && frameImages.length === 0) return null;

  return {
    index:
      typeof item.index === "number" && Number.isFinite(item.index) ? item.index : fallbackIndex,
    videoUrl,
    frameImages,
    frameImageOssIds,
  };
}

export async function fetchVideoFrameCapture(videoUrl: string) {
  const response = await devApiFetch(`/video/frameCapture?url=${encodeURIComponent(videoUrl)}`, {
    method: "GET",
    timeoutMs: 120000,
  });
  const parsed = await parseDevApiEnvelope<RawVideoFrameCaptureItem[]>(response);
  return (Array.isArray(parsed.data) ? parsed.data : [])
    .map((item, index) => normalizeFrameCaptureItem(item, index))
    .filter((item): item is VideoFrameCaptureItem => Boolean(item));
}
