export type MediaNodeLoadingType = "image" | "video" | "audio";

export function getMediaNodeLoadingLabel({
  isUploading,
  mediaType,
}: {
  isUploading: boolean;
  mediaType: MediaNodeLoadingType;
}) {
  if (isUploading) return "上传中";
  if (mediaType === "image") return "正在生成图片";
  if (mediaType === "video") return "正在生成视频";
  return "正在生成音频";
}
