export type MediaNodeLoadingType = "image" | "video" | "audio";
export type MediaNodeLoadingOperation =
  | "generate"
  | "frame-analysis"
  | "video-prompt"
  | "batch-replacement"
  | "video-super-resolution";

export function isMediaNodeRunning({
  data,
  properties,
}: {
  data?: Record<string, unknown> | null;
  properties?: Record<string, unknown> | null;
}) {
  return data?.loading === true || data?.status === "loading" || properties?.status === "loading";
}

export function getMediaNodeLoadingLabel({
  isUploading,
  mediaType,
  operation = "generate",
}: {
  isUploading: boolean;
  mediaType: MediaNodeLoadingType;
  operation?: MediaNodeLoadingOperation;
}) {
  if (isUploading) return "上传中";
  if (operation === "frame-analysis") return "正在逐帧分析";
  if (operation === "video-prompt") return "正在反推提示词";
  if (operation === "batch-replacement") return "正在提交批量替换";
  if (operation === "video-super-resolution") return "正在视频超分";
  if (mediaType === "image") return "正在生成图片";
  if (mediaType === "video") return "正在生成视频";
  return "正在生成音频";
}
