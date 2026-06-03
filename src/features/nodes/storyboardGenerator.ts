import { GraphNode, StoryboardRow } from "../../types";

const ASPECT_TO_SIZE: Record<string, string> = {
  "1:1": "square_hd",
  "9:16": "portrait_16_9",
  "3:4": "portrait_4_3",
  "4:5": "portrait_4_3",
  "2:3": "portrait_4_3",
  "16:9": "landscape_16_9",
  "4:3": "landscape_4_3",
  "3:2": "landscape_4_3",
  "5:4": "landscape_4_3",
  "21:9": "landscape_16_9",
};

function aspectToSize(aspect?: string): string {
  if (!aspect) return "landscape_16_9";
  return ASPECT_TO_SIZE[aspect] || "landscape_16_9";
}

function generateMockImageUrl(prompt: string, aspect: string): string {
  const size = aspectToSize(aspect);
  const seed = encodeURIComponent(`${prompt}-${Date.now()}-${Math.random()}`);
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}&seed=${seed}`;
}

const VIDEO_SEEDS = [
  "https://assets.mixkit.co/videos/preview/mixkit-woman-walking-in-front-of-the-ocean-1227-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-aerial-shot-of-a-coastline-with-rocks-and-cliffs-32759-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-rusty-old-vintage-car-on-a-road-34570-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-curtains-blowing-in-the-wind-near-a-window-4433-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-abstract-flowing-teal-and-blue-gradient-background-40030-large.mp4",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function generateMockVideoUrl(prompt: string): string {
  const idx = Math.abs(hashString(prompt)) % VIDEO_SEEDS.length;
  return `${VIDEO_SEEDS[idx]}?prompt=${encodeURIComponent(prompt)}`;
}

export interface StoryboardGenContext {
  getNode: (nodeId: string) => GraphNode | undefined;
  onUpdateNodeData: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onUpdateNodeProperty: (nodeId: string, key: string, value: unknown) => void;
}

function readRows(node: GraphNode): StoryboardRow[] {
  return (node.data?.storyboard as StoryboardRow[]) || (node.properties.rows as StoryboardRow[]) || [];
}

function writeRows(ctx: StoryboardGenContext, nodeId: string, rows: StoryboardRow[]) {
  ctx.onUpdateNodeData(nodeId, { storyboard: rows });
  ctx.onUpdateNodeProperty(nodeId, "rows", rows);
}

function patchRows(
  ctx: StoryboardGenContext,
  nodeId: string,
  updater: (rows: StoryboardRow[]) => StoryboardRow[]
) {
  const node = ctx.getNode(nodeId);
  if (!node) return;
  const next = updater(readRows(node));
  writeRows(ctx, nodeId, next);
  return next;
}

export function generateStoryboardRow(
  nodeId: string,
  rowId: string,
  type: "image" | "video",
  ctx: StoryboardGenContext
) {
  const node = ctx.getNode(nodeId);
  if (!node) return;
  const row = readRows(node).find((r) => r.id === rowId);
  if (!row) return;

  patchRows(ctx, nodeId, (rows) =>
    rows.map((r) =>
      r.id === rowId ? { ...r, [`${type}Status`]: "loading", [`${type}Error`]: undefined } : r
    )
  );

  setTimeout(() => {
    const aspect = row.aspectRatio || (node.properties.aspectRatio as string) || "16:9";
    const url = type === "image" ? generateMockImageUrl(row.prompt || row.title, aspect) : generateMockVideoUrl(row.prompt || row.title);
    patchRows(ctx, nodeId, (rows) =>
      rows.map((r) =>
        r.id === rowId
          ? { ...r, [`${type}Url`]: url, [`${type}Status`]: "success" }
          : r
      )
    );
    if (type === "image") {
      ctx.onUpdateNodeProperty(nodeId, "firstImageUrl", url);
    }
  }, 500 + Math.random() * 700);
}

export function generateAllStoryboardRows(
  nodeId: string,
  type: "image" | "video",
  ctx: StoryboardGenContext
) {
  const node = ctx.getNode(nodeId);
  if (!node) return;
  const rows = readRows(node);
  rows.forEach((row, idx) => {
    setTimeout(() => generateStoryboardRow(nodeId, row.id, type, ctx), idx * 80);
  });
}
