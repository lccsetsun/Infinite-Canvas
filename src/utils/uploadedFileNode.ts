import type { NodeClass } from "../types";
import type { UploadedAssetKind } from "../hooks/useWorkflowState";

export interface UploadedFileNodeResolution {
  nodeType: Extract<NodeClass, "image_node" | "video_node" | "audio_node">;
  assetKind: UploadedAssetKind;
  propKey: "imageUrl" | "videoUrl" | "audioUrl";
  assetUrl: string;
}

export function resolveUploadedFileNode(
  file: Pick<File, "name" | "type">,
  assetUrl: string
): UploadedFileNodeResolution {
  const mimeType = file.type.trim().toLowerCase();
  const extension = file.name.trim().toLowerCase().split(".").pop() || "";
  const imageExtensions = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
  const videoExtensions = new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"]);
  const audioExtensions = new Set(["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav", "webm"]);

  if (mimeType.startsWith("image/") || imageExtensions.has(extension)) {
    return { nodeType: "image_node", assetKind: "image", propKey: "imageUrl", assetUrl };
  }

  if (mimeType.startsWith("video/") || videoExtensions.has(extension)) {
    return { nodeType: "video_node", assetKind: "video", propKey: "videoUrl", assetUrl };
  }

  if (mimeType.startsWith("audio/") || audioExtensions.has(extension)) {
    return { nodeType: "audio_node", assetKind: "audio", propKey: "audioUrl", assetUrl };
  }

  throw new Error("仅支持上传图片、视频或音频文件");
}
