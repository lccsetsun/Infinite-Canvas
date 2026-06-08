export type CropRatioPreset = "original" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropSize {
  width: number;
  height: number;
}

export interface NaturalCropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const CROP_PADDING_RATIO = 1 / 30;

export const CROP_RATIO_OPTIONS: Array<{ value: CropRatioPreset; label: string }> = [
  { value: "original", label: "原图比例" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

export function getCropAspectRatio(
  preset: CropRatioPreset,
  naturalSize: CropSize | null | undefined
) {
  if (preset === "original") {
    if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
      return naturalSize.width / naturalSize.height;
    }
    return 1;
  }

  const [width, height] = preset.split(":").map((value) => Number.parseFloat(value));
  return width / height;
}

export function getInitialCropRect(bounds: CropSize, aspectRatio: number): CropRect {
  const maxWidth = Math.max(1, bounds.width * (1 - CROP_PADDING_RATIO * 2));
  const maxHeight = Math.max(1, bounds.height * (1 - CROP_PADDING_RATIO * 2));
  const boundedRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  let width = maxWidth;
  let height = width / boundedRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * boundedRatio;
  }

  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  return {
    x: Math.round((bounds.width - roundedWidth) / 2),
    y: Math.round((bounds.height - roundedHeight) / 2),
    width: roundedWidth,
    height: roundedHeight,
  };
}

export function clampCropRect(rect: CropRect, bounds: CropSize, minSize = 48): CropRect {
  const width = Math.min(Math.max(rect.width, minSize), bounds.width);
  const height = Math.min(Math.max(rect.height, minSize), bounds.height);
  return {
    x: Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - width)),
    y: Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - height)),
    width,
    height,
  };
}

export function getCroppedImageDimensions(
  crop: CropRect,
  displaySize: CropSize,
  naturalSize: CropSize
): NaturalCropRect {
  const scaleX = naturalSize.width / displaySize.width;
  const scaleY = naturalSize.height / displaySize.height;
  const sx = Math.round(crop.x * scaleX);
  const sy = Math.round(crop.y * scaleY);
  const sw = Math.max(1, Math.round(crop.width * scaleX));
  const sh = Math.max(1, Math.round(crop.height * scaleY));
  return {
    sx: Math.min(Math.max(0, sx), Math.max(0, naturalSize.width - 1)),
    sy: Math.min(Math.max(0, sy), Math.max(0, naturalSize.height - 1)),
    sw: Math.min(sw, naturalSize.width - sx),
    sh: Math.min(sh, naturalSize.height - sy),
  };
}

export function buildCropAssetProxyUrl(imageUrl: string) {
  return `/api/download-asset?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent("crop-source.png")}`;
}

export function canProxyCropSource(imageUrl: string) {
  return imageUrl.startsWith("http://") || imageUrl.startsWith("https://");
}

export async function cropImageRegion(
  imageUrl: string,
  crop: CropRect,
  displaySize: CropSize,
  naturalSize?: CropSize | null
): Promise<{ dataUrl: string; crop: NaturalCropRect }> {
  const image = await loadImage(imageUrl);
  return cropLoadedImageElement(image, crop, displaySize, naturalSize);
}

export async function cropImageRegionViaAssetProxy(
  imageUrl: string,
  crop: CropRect,
  displaySize: CropSize,
  naturalSize?: CropSize | null
): Promise<{ dataUrl: string; crop: NaturalCropRect }> {
  if (!canProxyCropSource(imageUrl)) {
    throw new Error("图片受跨域限制，无法裁剪");
  }

  const response = await fetch(buildCropAssetProxyUrl(imageUrl));
  if (!response.ok) {
    throw new Error("图片代理下载失败，无法裁剪");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(objectUrl);
    return cropLoadedImageElement(image, crop, displaySize, naturalSize);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function cropLoadedImageElement(
  image: HTMLImageElement,
  crop: CropRect,
  displaySize: CropSize,
  naturalSize?: CropSize | null
): { dataUrl: string; crop: NaturalCropRect } {
  const sourceSize = naturalSize ?? {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
  const naturalCrop = getCroppedImageDimensions(crop, displaySize, sourceSize);
  const canvas = document.createElement("canvas");
  canvas.width = naturalCrop.sw;
  canvas.height = naturalCrop.sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建图片裁剪画布");
  }
  ctx.drawImage(
    image,
    naturalCrop.sx,
    naturalCrop.sy,
    naturalCrop.sw,
    naturalCrop.sh,
    0,
    0,
    naturalCrop.sw,
    naturalCrop.sh
  );
  try {
    return { dataUrl: canvas.toDataURL("image/png"), crop: naturalCrop };
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      throw new Error("图片受跨域限制，无法裁剪");
    }
    throw error;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，无法裁剪"));
    image.src = src;
  });
}
