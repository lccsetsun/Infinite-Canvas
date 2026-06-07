import type { GraphLink, GraphNode } from "../types";
import type { NodeOutputMap } from "../runtime/dataflow";

export type TextNodeReferenceKind = "image" | "video" | "audio" | "text" | "asset";

export interface TextNodeReferenceItem {
  id: string;
  kind: TextNodeReferenceKind;
  label: string;
  title: string;
  value: string;
}

function stringifyReferenceValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (!value) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function getUrlKind(value: string): TextNodeReferenceKind | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(normalized) || normalized.includes("/pic/")) return "image";
  if (/\.(mp4|mov|webm|m4v)(\?.*)?$/.test(normalized)) return "video";
  if (/\.(mp3|wav|m4a|aac|ogg)(\?.*)?$/.test(normalized)) return "audio";
  return null;
}

function inferReferenceFromNode(sourceNode: GraphNode, outputValue: unknown): TextNodeReferenceItem | null {
  const value =
    stringifyReferenceValue(outputValue) ||
    stringifyReferenceValue(sourceNode.data?.imageUrl) ||
    stringifyReferenceValue(sourceNode.properties.imageUrl) ||
    stringifyReferenceValue(sourceNode.data?.videoUrl) ||
    stringifyReferenceValue(sourceNode.properties.videoUrl) ||
    stringifyReferenceValue(sourceNode.data?.audioUrl) ||
    stringifyReferenceValue(sourceNode.properties.audioUrl) ||
    stringifyReferenceValue(sourceNode.data?.response) ||
    stringifyReferenceValue(sourceNode.properties.response) ||
    stringifyReferenceValue(sourceNode.properties.text);
  if (!value) return null;

  const urlKind = getUrlKind(value);
  const kind =
    sourceNode.type === "image_node"
      ? "image"
      : sourceNode.type === "video_node"
        ? "video"
        : sourceNode.type === "audio_node"
          ? "audio"
          : urlKind || "text";

  return {
    id: sourceNode.id,
    kind,
    label:
      kind === "image"
        ? "Image"
        : kind === "video"
          ? "Video"
          : kind === "audio"
            ? "Audio"
            : "Text",
    title: sourceNode.title,
    value,
  };
}

export function collectTextNodeReferences({
  links,
  nodeOutputs,
  nodes,
  textNodeId,
}: {
  links: GraphLink[];
  nodeOutputs: NodeOutputMap;
  nodes: GraphNode[];
  textNodeId: string;
}): TextNodeReferenceItem[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const references: TextNodeReferenceItem[] = [];

  links.forEach((link) => {
    if (link.toNodeId !== textNodeId) return;
    const sourceNode = nodeById.get(link.fromNodeId);
    if (!sourceNode) return;
    const outputValue = nodeOutputs.get(link.fromNodeId)?.get(link.fromOutputIndex);
    const reference = inferReferenceFromNode(sourceNode, outputValue);
    if (!reference) return;
    if (!references.some((item) => item.id === reference.id && item.value === reference.value)) {
      references.push(reference);
    }
  });

  return references;
}
