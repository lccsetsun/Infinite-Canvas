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

export interface GridCellReplacementDrawPlan {
  canvas: ImageSize;
  cell: GridCellCrop;
  replacementSource: {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
  };
}

export interface GridSplitChildNodeInitialPropsInput {
  cellIndex: number;
  crop: Pick<GridCellCrop, "sw" | "sh">;
  dataUrl: string;
  gridCols: number;
  gridRows: number;
  sourceTitle: string;
}

const CHILD_NODE_X_OFFSET = 380;
const CHILD_NODE_Y_STEP = 130;
const MEDIA_NODE_FOOTPRINT_WIDTH = 540;
const MEDIA_NODE_FOOTPRINT_HEIGHT = 540;

function normalizeGridShape(rowsOrGridSize: number, cols?: number) {
  const rows = Math.max(1, Math.floor(rowsOrGridSize));
  const normalizedCols = Math.max(1, Math.floor(cols ?? rowsOrGridSize));
  return { rows, cols: normalizedCols };
}

function fitGridChildPreviewSize(size: Pick<GridCellCrop, "sw" | "sh">) {
  const width = Math.max(1, Math.floor(size.sw));
  const height = Math.max(1, Math.floor(size.sh));
  const scale = Math.min(MEDIA_NODE_FOOTPRINT_WIDTH / width, MEDIA_NODE_FOOTPRINT_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getGridCellCrop(
  size: ImageSize,
  rowsOrGridSize: number,
  cellIndex: number,
  cols?: number
): GridCellCrop {
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

export function getGridChildNodePosition(
  source: { x: number; y: number },
  rowsOrGridSize: number,
  cellIndex: number,
  cols?: number
) {
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const row = Math.floor(
    Math.min(Math.max(0, Math.floor(cellIndex)), rows * normalizedCols - 1) / normalizedCols
  );
  return {
    x: Math.round(source.x + CHILD_NODE_X_OFFSET),
    y: Math.round(source.y + row * CHILD_NODE_Y_STEP),
  };
}

export function formatGridCellLabel(rowsOrGridSize: number, cellIndex: number, cols?: number) {
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const crop = getGridCellCrop(
    { width: normalizedCols, height: rows },
    rows,
    cellIndex,
    normalizedCols
  );
  return `第 ${Math.min(Math.max(0, Math.floor(cellIndex)), rows * normalizedCols - 1) + 1} 格 (${crop.row + 1}行${crop.col + 1}列)`;
}

export function buildGridSplitChildNodeInitialProps({
  cellIndex,
  crop,
  dataUrl,
  gridCols,
  gridRows,
  sourceTitle,
}: GridSplitChildNodeInitialPropsInput): Record<string, unknown> {
  const displayIndex = Math.max(0, Math.floor(cellIndex)) + 1;
  const displaySize = fitGridChildPreviewSize(crop);
  return {
    __nodeTitle: `宫格切分 ${gridRows}x${gridCols} #${displayIndex}`,
    __nodeData: {
      activeImageIndex: 0,
      imageUrl: dataUrl,
      imageUrls: [dataUrl],
      imageNaturalWidth: crop.sw,
      imageNaturalHeight: crop.sh,
      imageDisplayWidth: displaySize.width,
      imageDisplayHeight: displaySize.height,
      status: "success",
    },
    imageUrl: dataUrl,
    imageUrls: [dataUrl],
    imageNaturalWidth: crop.sw,
    imageNaturalHeight: crop.sh,
    imageDisplayWidth: displaySize.width,
    imageDisplayHeight: displaySize.height,
    text: `来自 ${sourceTitle} 的 ${gridRows}x${gridCols} 第 ${displayIndex} 格 (${crop.sw}x${crop.sh})`,
    status: "success",
  };
}

export function getGridCellReplacementDrawPlan(
  sourceSize: ImageSize,
  replacementSize: ImageSize,
  rowsOrGridSize: number,
  cellIndex: number,
  cols?: number
): GridCellReplacementDrawPlan {
  const { rows, cols: normalizedCols } = normalizeGridShape(rowsOrGridSize, cols);
  const canvas = {
    width: Math.max(1, Math.floor(sourceSize.width)),
    height: Math.max(1, Math.floor(sourceSize.height)),
  };
  const replacement = {
    width: Math.max(1, Math.floor(replacementSize.width)),
    height: Math.max(1, Math.floor(replacementSize.height)),
  };
  const cell = getGridCellCrop(canvas, rows, cellIndex, normalizedCols);
  const cellRatio = cell.sw / cell.sh;
  const replacementRatio = replacement.width / replacement.height;
  let sw = replacement.width;
  let sh = replacement.height;
  let sx = 0;
  let sy = 0;

  if (replacementRatio > cellRatio) {
    sw = Math.max(1, Math.round(replacement.height * cellRatio));
    sx = Math.max(0, Math.round((replacement.width - sw) / 2));
  } else if (replacementRatio < cellRatio) {
    sh = Math.max(1, Math.round(replacement.width / cellRatio));
    sy = Math.max(0, Math.round((replacement.height - sh) / 2));
  }

  return {
    canvas,
    cell,
    replacementSource: { sx, sy, sw, sh },
  };
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

export async function replaceImageGridCell(
  imageUrl: string,
  replacementUrl: string,
  rowsOrGridSize: number,
  cellIndex: number,
  cols?: number
): Promise<{ dataUrl: string; crop: GridCellCrop }> {
  const [image, replacement] = await Promise.all([loadImage(imageUrl), loadImage(replacementUrl)]);
  const plan = getGridCellReplacementDrawPlan(
    { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height },
    {
      width: replacement.naturalWidth || replacement.width,
      height: replacement.naturalHeight || replacement.height,
    },
    rowsOrGridSize,
    cellIndex,
    cols
  );
  const canvas = document.createElement("canvas");
  canvas.width = plan.canvas.width;
  canvas.height = plan.canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建图片切片替换画布");
  }
  ctx.drawImage(image, 0, 0, plan.canvas.width, plan.canvas.height);
  ctx.drawImage(
    replacement,
    plan.replacementSource.sx,
    plan.replacementSource.sy,
    plan.replacementSource.sw,
    plan.replacementSource.sh,
    plan.cell.sx,
    plan.cell.sy,
    plan.cell.sw,
    plan.cell.sh
  );
  return { dataUrl: canvas.toDataURL("image/png"), crop: plan.cell };
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
