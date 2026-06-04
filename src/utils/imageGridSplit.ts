export interface ImageSize {
  width: number;
  height: number;
}

export interface GridCellCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  row: number;
  col: number;
}

const CHILD_NODE_X_OFFSET = 380;
const CHILD_NODE_Y_STEP = 130;

export function getGridCellCrop(size: ImageSize, gridSize: number, cellIndex: number): GridCellCrop {
  const safeGridSize = Math.max(1, Math.floor(gridSize));
  const safeCellIndex = Math.min(Math.max(0, Math.floor(cellIndex)), safeGridSize * safeGridSize - 1);
  const row = Math.floor(safeCellIndex / safeGridSize);
  const col = safeCellIndex % safeGridSize;
  const x1 = Math.floor((size.width * col) / safeGridSize);
  const x2 = Math.floor((size.width * (col + 1)) / safeGridSize);
  const y1 = Math.floor((size.height * row) / safeGridSize);
  const y2 = Math.floor((size.height * (row + 1)) / safeGridSize);

  return {
    sx: x1,
    sy: y1,
    sw: Math.max(1, x2 - x1),
    sh: Math.max(1, y2 - y1),
    row,
    col,
  };
}

export function getGridChildNodePosition(source: { x: number; y: number }, gridSize: number, cellIndex: number) {
  const safeGridSize = Math.max(1, Math.floor(gridSize));
  const row = Math.floor(Math.min(Math.max(0, Math.floor(cellIndex)), safeGridSize * safeGridSize - 1) / safeGridSize);
  return {
    x: Math.round(source.x + CHILD_NODE_X_OFFSET),
    y: Math.round(source.y + row * CHILD_NODE_Y_STEP),
  };
}

export async function cropImageGridCell(imageUrl: string, gridSize: number, cellIndex: number): Promise<{ dataUrl: string; crop: GridCellCrop }> {
  const image = await loadImage(imageUrl);
  const crop = getGridCellCrop({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }, gridSize, cellIndex);
  const canvas = document.createElement("canvas");
  canvas.width = crop.sw;
  canvas.height = crop.sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建图片切分画布");
  }
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
  return { dataUrl: canvas.toDataURL("image/png"), crop };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，无法切分"));
    image.src = src;
  });
}
