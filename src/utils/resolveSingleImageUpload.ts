export function resolveSingleImageUpload(files: ArrayLike<File> | null | undefined) {
  const file = files?.[0] ?? null;
  if (!file) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error("只能上传图片文件");
  }
  return file;
}
