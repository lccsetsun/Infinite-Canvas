import type { NodeOutputMap } from "../runtime/dataflow";
import type { GraphNode } from "../types";

export type CanvasAssetKind = "image" | "video" | "audio";

export interface CanvasAsset {
  createdAt: number;
  id: string;
  kind: CanvasAssetKind;
  nodeId: string;
  nodeTitle: string;
  source: string;
  url: string;
}

const PLACEHOLDER_URLS = new Set(["__batch_replacement_frame_placeholder__"]);

function isUsableAssetUrl(value: string) {
  const url = value.trim();
  if (!url || PLACEHOLDER_URLS.has(url)) return false;
  if (url.startsWith("data:image/svg+xml")) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  );
}

function inferAssetKind(url: string): CanvasAssetKind | null {
  if (url.startsWith("data:image/")) return "image";
  if (url.startsWith("data:video/")) return "video";
  if (url.startsWith("data:audio/")) return "audio";
  if (/\.(png|jpe?g|webp|gif|avif)(?=($|[?#]))/i.test(url)) return "image";
  if (/\.(mp4|webm|mov|ogg)(?=($|[?#]))/i.test(url)) return "video";
  if (/\.(mp3|wav|m4a|aac|flac)(?=($|[?#]))/i.test(url)) return "audio";
  return null;
}

function collectStringUrls(value: unknown, result: string[] = []) {
  if (typeof value === "string") {
    if (isUsableAssetUrl(value)) result.push(value.trim());
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringUrls(item, result));
    return result;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStringUrls(item, result));
  }

  return result;
}

function timestampFromNodeId(nodeId: string) {
  const match = nodeId.match(/_(\d{11,})_/);
  const timestamp = match ? Number.parseInt(match[1], 10) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getNodeAssetTimestamp(node: GraphNode) {
  const candidates = [
    node.data?.generationFinishedAt,
    node.data?.generationStartedAt,
    node.data?.batchReplacementFinishedAt,
    node.data?.batchReplacementStartedAt,
    timestampFromNodeId(node.id),
  ];
  return candidates.find((value): value is number => typeof value === "number" && value > 0) ?? 0;
}

export function collectCanvasAssets({
  nodeOutputs,
  nodes,
}: {
  nodeOutputs?: NodeOutputMap;
  nodes: GraphNode[];
}): CanvasAsset[] {
  const assets: CanvasAsset[] = [];
  const seen = new Set<string>();

  const addAsset = (node: GraphNode, kind: CanvasAssetKind, url: string, source: string) => {
    const normalizedUrl = url.trim();
    const key = `${kind}:${normalizedUrl}`;
    if (!isUsableAssetUrl(normalizedUrl) || seen.has(key)) return;
    seen.add(key);
    assets.push({
      createdAt: getNodeAssetTimestamp(node),
      id: `${node.id}:${kind}:${assets.length}`,
      kind,
      nodeId: node.id,
      nodeTitle: node.title,
      source,
      url: normalizedUrl,
    });
  };

  nodes.forEach((node) => {
    collectStringUrls(node.data?.imageUrls).forEach((url, index) =>
      addAsset(node, "image", url, `图片集 ${index + 1}`)
    );
    collectStringUrls(node.properties.imageUrls).forEach((url, index) =>
      addAsset(node, "image", url, `图片属性 ${index + 1}`)
    );

    const imageUrl = typeof node.data?.imageUrl === "string" ? node.data.imageUrl : node.properties.imageUrl;
    if (typeof imageUrl === "string") addAsset(node, "image", imageUrl, "图片");

    const videoUrl = typeof node.data?.videoUrl === "string" ? node.data.videoUrl : node.properties.videoUrl;
    if (typeof videoUrl === "string") addAsset(node, "video", videoUrl, "视频");

    const audioUrl = typeof node.data?.audioUrl === "string" ? node.data.audioUrl : node.properties.audioUrl;
    if (typeof audioUrl === "string") addAsset(node, "audio", audioUrl, "音频");

    const outputValues = nodeOutputs?.get(node.id);
    outputValues?.forEach((value, outputIndex) => {
      collectStringUrls(value).forEach((url) => {
        const kind = inferAssetKind(url);
        if (kind) addAsset(node, kind, url, `输出 ${outputIndex + 1}`);
      });
    });
  });

  return assets;
}
