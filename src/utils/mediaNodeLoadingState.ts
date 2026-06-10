export type MediaNodeLoadingType = "image" | "video" | "audio";
export type MediaNodeLoadingOperation = "generate" | "frame-analysis";

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
  if (mediaType === "image") return "正在生成图片";
  if (mediaType === "video") return "正在生成视频";
  return "正在生成音频";
}
