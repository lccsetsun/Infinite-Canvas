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

function normalizeGridShape(rowsOrGridSize: number, cols?: number) {
  const rows = Math.max(1, Math.floor(rowsOrGridSize));
  const normalizedCols = Math.max(1, Math.floor(cols ?? rowsOrGridSize));
  return { rows, cols: normalizedCols };
}

export function getGridCellCrop(size: ImageSize, rowsOrGridSize: number, cellIndex: number, cols?: number): GridCellCrop {
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const safeCellIndex = Math.min(Math.max(0, Math.floor(cellIndex)), rows * normalizedCols - 1);
  const row = Math.floor(safeCellIndex / normalizedCols);
  const col = safeCellIndex % normalizedCols;
  const x1 = Math.floor((size.width * col) / normalizedCols);
  const x2 = Math.floor((size.width * (col + 1)) / normalizedCols);
  const y1 = Math.floor((size.height * row) / rows);
  const y2 = Math.floor((size.height * (row + 1)) / rows);

  return {
    sx: x1,
    sy: y1,
    sw: Math.max(1, x2 - x1),
    sh: Math.max(1, y2 - y1),
    row,
    col,
  };
}

export function getGridChildNodePosition(source: { x: number; y: number }, rowsOrGridSize: number, cellIndex: number, cols?: number) {
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const row = Math.floor(Math.min(Math.max(0, Math.floor(cellIndex)), rows * normalizedCols - 1) / normalizedCols);
  return {
    x: Math.round(source.x + CHILD_NODE_X_OFFSET),
    y: Math.round(source.y + row * CHILD_NODE_Y_STEP),
  };
}

export function formatGridCellLabel(rowsOrGridSize: number, cellIndex: number, cols?: number) {
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const crop = getGridCellCrop({ width: normalizedCols, height: rows }, rows, cellIndex, normalizedCols);
  return `第 ${Math.min(Math.max(0, Math.floor(cellIndex)), rows * normalizedCols - 1) + 1} 格 (${crop.row + 1}行${crop.col + 1}列)`;
}

export async function cropImageGridCell(
  imageUrl: string,
  rowsOrGridSize: number,
  cellIndex: number,
  cols?: number
): Promise<{ dataUrl: string; crop: GridCellCrop }> {
  const image = await loadImage(imageUrl);
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const crop = getGridCellCrop(
    { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height },
    rows,
    cellIndex,
    normalizedCols
  );
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
