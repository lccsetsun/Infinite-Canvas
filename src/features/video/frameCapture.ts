import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export type VideoFrameCaptureItem = {
  index: number;
  videoUrl: string;
  frameImages: string[];
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

function normalizeFrameCaptureItem(
  item: RawVideoFrameCaptureItem,
  fallbackIndex: number
): VideoFrameCaptureItem | null {
  const videoUrl = typeof item.video === "string" ? item.video.trim() : "";
  const frameImages = Array.isArray(item.frame_images)
    ? item.frame_images.map(normalizeFrameImageUrl).filter((url) => Boolean(url))
    : [];

  if (!videoUrl && frameImages.length === 0) return null;

  return {
    index:
      typeof item.index === "number" && Number.isFinite(item.index) ? item.index : fallbackIndex,
    videoUrl,
    frameImages,
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
