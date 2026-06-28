import type { ImageAnnotation } from "../types";

export type { ImageAnnotation };

export type ImageAnnotationPoint = { x: number; y: number };
export type ImageAnnotationBoxSize = { width: number; height: number };
export type ImageArrowEndpoint = "start" | "end";
export type ImageRectResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type ImageArrowAnnotation = Extract<ImageAnnotation, { type: "arrow" }>;

const MIN_RECT_SIZE = 0.002;
const MIN_PEN_POINTS = 2;
const MIN_ARROW_LENGTH = 0.004;
const DEFAULT_TEXT_FONT_SIZE = 18;
const MAX_NUMBER_MARKER_VALUE = 999;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeUnit(value: number) {
  return Number(clamp01(value).toFixed(6));
}

function roundPathNumber(value: number) {
  return Number(value.toFixed(6));
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPoint(value: unknown): value is ImageAnnotationPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<ImageAnnotationPoint>;
  return typeof point.x === "number" && typeof point.y === "number";
}

function normalizePoint(point: ImageAnnotationPoint): ImageAnnotationPoint {
  return {
    x: normalizeUnit(point.x),
    y: normalizeUnit(point.y),
  };
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgPoint(point: ImageAnnotationPoint, size: { width: number; height: number }) {
  return `${point.x * size.width},${point.y * size.height}`;
}

function parseHexColor(color: string) {
  const value = color.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return {
    b: Number.parseInt(value.slice(4, 6), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    r: Number.parseInt(value.slice(0, 2), 16),
  };
}

export function getNumberAnnotationTextColor(color: string) {
  const rgb = parseHexColor(color);
  if (!rgb) return "#ffffff";
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function distanceToSegment(point: ImageAnnotationPoint, start: ImageAnnotationPoint, end: ImageAnnotationPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function getNormalizedAnnotationPoint(
  point: { clientX: number; clientY: number },
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">
): ImageAnnotationPoint {
  return {
    x: normalizeUnit((point.clientX - rect.left) / Math.max(1, rect.width)),
    y: normalizeUnit((point.clientY - rect.top) / Math.max(1, rect.height)),
  };
}

export function createRectAnnotation({
  color,
  end,
  id,
  start,
  strokeWidth,
}: {
  color: string;
  end: ImageAnnotationPoint;
  id: string;
  start: ImageAnnotationPoint;
  strokeWidth: number;
}): ImageAnnotation | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width < MIN_RECT_SIZE || height < MIN_RECT_SIZE) return null;
  return {
    id,
    type: "rect",
    color,
    strokeWidth,
    x: normalizeUnit(x),
    y: normalizeUnit(y),
    width: normalizeUnit(width),
    height: normalizeUnit(height),
  };
}

export function createPenAnnotation({
  color,
  id,
  points,
  strokeWidth,
}: {
  color: string;
  id: string;
  points: ImageAnnotationPoint[];
  strokeWidth: number;
}): ImageAnnotation | null {
  const normalizedPoints = points.map((point) => ({
    x: normalizeUnit(point.x),
    y: normalizeUnit(point.y),
  }));
  if (normalizedPoints.length < MIN_PEN_POINTS) return null;
  return {
    id,
    type: "pen",
    color,
    strokeWidth,
    points: normalizedPoints,
  };
}

export function createArrowAnnotation({
  color,
  end,
  id,
  start,
  strokeWidth,
}: {
  color: string;
  end: ImageAnnotationPoint;
  id: string;
  start: ImageAnnotationPoint;
  strokeWidth: number;
}): ImageAnnotation | null {
  if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_ARROW_LENGTH) return null;
  return {
    id,
    type: "arrow",
    color,
    strokeWidth,
    start: normalizePoint(start),
    end: normalizePoint(end),
  };
}

export function createTextAnnotation({
  boxSize,
  color,
  fontSize = DEFAULT_TEXT_FONT_SIZE,
  id,
  point,
  text,
}: {
  boxSize?: ImageAnnotationBoxSize;
  color: string;
  fontSize?: number;
  id: string;
  point: ImageAnnotationPoint;
  text: string;
}): ImageAnnotation | null {
  const normalizedText = text.trim();
  if (!normalizedText) return null;
  const normalizedBoxSize =
    boxSize && isPositiveNumber(boxSize.width) && isPositiveNumber(boxSize.height)
      ? {
          height: normalizeUnit(boxSize.height),
          width: normalizeUnit(boxSize.width),
        }
      : null;
  return {
    id,
    type: "text",
    color,
    fontSize: Math.max(10, Math.min(64, Math.round(fontSize))),
    text: normalizedText,
    ...(normalizedBoxSize ?? {}),
    x: normalizeUnit(point.x),
    y: normalizeUnit(point.y),
  };
}

export function createNumberAnnotation({
  color,
  id,
  number,
  point,
  strokeWidth,
}: {
  color: string;
  id: string;
  number: number;
  point: ImageAnnotationPoint;
  strokeWidth: number;
}): ImageAnnotation | null {
  if (!Number.isFinite(number) || number < 1) return null;
  return {
    id,
    type: "number",
    color,
    number: Math.min(MAX_NUMBER_MARKER_VALUE, Math.max(1, Math.round(number))),
    strokeWidth,
    x: normalizeUnit(point.x),
    y: normalizeUnit(point.y),
  };
}

export function getNextImageAnnotationNumber(annotations: ImageAnnotation[]) {
  const maxNumber = annotations.reduce((max, annotation) => {
    if (annotation.type !== "number") return max;
    return Math.max(max, annotation.number);
  }, 0);
  return Math.min(MAX_NUMBER_MARKER_VALUE, maxNumber + 1);
}

export function moveImageAnnotation(
  annotation: ImageAnnotation,
  delta: ImageAnnotationPoint
): ImageAnnotation {
  if (annotation.type === "rect") {
    return {
      ...annotation,
      x: normalizeUnit(Math.min(1 - annotation.width, Math.max(0, annotation.x + delta.x))),
      y: normalizeUnit(Math.min(1 - annotation.height, Math.max(0, annotation.y + delta.y))),
    };
  }
  if (annotation.type === "pen") {
    const minX = Math.min(...annotation.points.map((point) => point.x));
    const minY = Math.min(...annotation.points.map((point) => point.y));
    const maxX = Math.max(...annotation.points.map((point) => point.x));
    const maxY = Math.max(...annotation.points.map((point) => point.y));
    const safeDelta = {
      x: Math.min(1 - maxX, Math.max(-minX, delta.x)),
      y: Math.min(1 - maxY, Math.max(-minY, delta.y)),
    };
    return {
      ...annotation,
      points: annotation.points.map((point) => normalizePoint({ x: point.x + safeDelta.x, y: point.y + safeDelta.y })),
    };
  }
  if (annotation.type === "arrow") {
    const minX = Math.min(annotation.start.x, annotation.end.x);
    const minY = Math.min(annotation.start.y, annotation.end.y);
    const maxX = Math.max(annotation.start.x, annotation.end.x);
    const maxY = Math.max(annotation.start.y, annotation.end.y);
    const safeDelta = {
      x: Math.min(1 - maxX, Math.max(-minX, delta.x)),
      y: Math.min(1 - maxY, Math.max(-minY, delta.y)),
    };
    return {
      ...annotation,
      start: normalizePoint({ x: annotation.start.x + safeDelta.x, y: annotation.start.y + safeDelta.y }),
      end: normalizePoint({ x: annotation.end.x + safeDelta.x, y: annotation.end.y + safeDelta.y }),
    };
  }
  if (annotation.type === "number") {
    return {
      ...annotation,
      x: normalizeUnit(annotation.x + delta.x),
      y: normalizeUnit(annotation.y + delta.y),
    };
  }
  return {
    ...annotation,
    x: normalizeUnit(annotation.x + delta.x),
    y: normalizeUnit(annotation.y + delta.y),
  };
}

export function resizeImageArrowAnnotation(
  annotation: ImageAnnotation,
  endpoint: ImageArrowEndpoint,
  point: ImageAnnotationPoint
): ImageAnnotation {
  if (annotation.type !== "arrow") return annotation;
  const nextPoint = normalizePoint(point);
  const nextAnnotation = {
    ...annotation,
    [endpoint]: nextPoint,
  };
  if (
    Math.hypot(
      nextAnnotation.end.x - nextAnnotation.start.x,
      nextAnnotation.end.y - nextAnnotation.start.y
    ) < MIN_ARROW_LENGTH
  ) {
    return annotation;
  }
  return nextAnnotation;
}

export function resizeImageRectAnnotation(
  annotation: ImageAnnotation,
  handle: ImageRectResizeHandle,
  point: ImageAnnotationPoint
): ImageAnnotation {
  if (annotation.type !== "rect") return annotation;
  const nextPoint = normalizePoint(point);
  const right = annotation.x + annotation.width;
  const bottom = annotation.y + annotation.height;
  let nextLeft = annotation.x;
  let nextTop = annotation.y;
  let nextRight = right;
  let nextBottom = bottom;

  if (handle.includes("w")) {
    nextLeft = Math.min(right - MIN_RECT_SIZE, nextPoint.x);
  }
  if (handle.includes("e")) {
    nextRight = Math.max(annotation.x + MIN_RECT_SIZE, nextPoint.x);
  }
  if (handle.includes("n")) {
    nextTop = Math.min(bottom - MIN_RECT_SIZE, nextPoint.y);
  }
  if (handle.includes("s")) {
    nextBottom = Math.max(annotation.y + MIN_RECT_SIZE, nextPoint.y);
  }

  nextLeft = clamp01(nextLeft);
  nextTop = clamp01(nextTop);
  nextRight = clamp01(nextRight);
  nextBottom = clamp01(nextBottom);

  return {
    ...annotation,
    height: normalizeUnit(Math.max(MIN_RECT_SIZE, nextBottom - nextTop)),
    width: normalizeUnit(Math.max(MIN_RECT_SIZE, nextRight - nextLeft)),
    x: normalizeUnit(nextLeft),
    y: normalizeUnit(nextTop),
  };
}

export function getImageAnnotationArrowShape(
  annotation: ImageArrowAnnotation,
  size: { width: number; height: number }
) {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const startPx = {
    x: annotation.start.x * width,
    y: annotation.start.y * height,
  };
  const endPx = {
    x: annotation.end.x * width,
    y: annotation.end.y * height,
  };
  const dx = endPx.x - startPx.x;
  const dy = endPx.y - startPx.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) {
    return {
      headLengthPx: 0,
      headPoints: [annotation.end, annotation.end, annotation.end],
      headWidthPx: 0,
      shaftEnd: annotation.end,
      shaftStart: annotation.start,
    };
  }

  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;
  const strokeWidth = Math.max(1, annotation.strokeWidth);
  const headLengthPx = Math.round(Math.min(length * 0.32, Math.max(10, Math.min(22, strokeWidth * 4.25))));
  const headWidthPx = Math.round(Math.min(length * 0.28, Math.max(8, Math.min(18, strokeWidth * 3.25))));
  const basePx = {
    x: endPx.x - unitX * headLengthPx,
    y: endPx.y - unitY * headLengthPx,
  };
  const halfHeadWidth = headWidthPx / 2;
  const toUnitPoint = (point: ImageAnnotationPoint) =>
    normalizePoint({
      x: point.x / width,
      y: point.y / height,
    });

  return {
    headLengthPx,
    headPoints: [
      annotation.end,
      toUnitPoint({
        x: basePx.x + normalX * halfHeadWidth,
        y: basePx.y + normalY * halfHeadWidth,
      }),
      toUnitPoint({
        x: basePx.x - normalX * halfHeadWidth,
        y: basePx.y - normalY * halfHeadWidth,
      }),
    ],
    headWidthPx,
    shaftEnd: toUnitPoint(basePx),
    shaftStart: annotation.start,
  };
}

export function getImageAnnotationPenPath(points: ImageAnnotationPoint[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midPoint = {
      x: roundPathNumber((current.x + next.x) / 2),
      y: roundPathNumber((current.y + next.y) / 2),
    };
    commands.push(`Q ${current.x} ${current.y} ${midPoint.x} ${midPoint.y}`);
  }
  const lastPoint = points[points.length - 1];
  commands.push(`L ${lastPoint.x} ${lastPoint.y}`);
  return commands.join(" ");
}

export function getImageAnnotationRectEdges(
  rect: Pick<Extract<ImageAnnotation, { type: "rect" }>, "height" | "width" | "x" | "y">,
  strokeSize: { x: number; y: number }
) {
  const edgeWidth = Math.min(rect.width, Math.max(0, strokeSize.x));
  const edgeHeight = Math.min(rect.height, Math.max(0, strokeSize.y));

  return [
    { x: rect.x, y: rect.y, width: rect.width, height: edgeHeight },
    {
      x: rect.x + rect.width - edgeWidth,
      y: rect.y,
      width: edgeWidth,
      height: rect.height,
    },
    {
      x: rect.x,
      y: rect.y + rect.height - edgeHeight,
      width: rect.width,
      height: edgeHeight,
    },
    { x: rect.x, y: rect.y, width: edgeWidth, height: rect.height },
  ];
}

export function hitTestImageAnnotation(
  annotations: ImageAnnotation[],
  point: ImageAnnotationPoint
): string | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (annotation.type === "rect") {
      if (
        point.x >= annotation.x &&
        point.x <= annotation.x + annotation.width &&
        point.y >= annotation.y &&
        point.y <= annotation.y + annotation.height
      ) {
        return annotation.id;
      }
    } else if (annotation.type === "pen") {
      for (let pointIndex = 1; pointIndex < annotation.points.length; pointIndex += 1) {
        if (distanceToSegment(point, annotation.points[pointIndex - 1], annotation.points[pointIndex]) <= 0.018) {
          return annotation.id;
        }
      }
    } else if (annotation.type === "arrow") {
      if (distanceToSegment(point, annotation.start, annotation.end) <= 0.018) return annotation.id;
    } else if (annotation.type === "number") {
      if (Math.hypot(point.x - annotation.x, point.y - annotation.y) <= 0.04) return annotation.id;
    } else if (
      point.x >= annotation.x &&
      point.x <= annotation.x + Math.max(0.08, annotation.text.length * 0.018) &&
      point.y >= annotation.y - 0.04 &&
      point.y <= annotation.y + 0.045
    ) {
      return annotation.id;
    }
  }
  return null;
}

export function exportImageAnnotationsSvg(
  annotations: ImageAnnotation[],
  size: { width: number; height: number }
) {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const body = annotations
    .map((annotation) => {
      if (annotation.type === "rect") {
        const strokeWidth = annotation.strokeWidth;
        const edges = getImageAnnotationRectEdges(
          {
            x: annotation.x * width,
            y: annotation.y * height,
            width: annotation.width * width,
            height: annotation.height * height,
          },
          { x: strokeWidth, y: strokeWidth }
        );
        return `<g data-annotation-kind="rect">${edges.map((edge) => `<rect x="${edge.x}" y="${edge.y}" width="${edge.width}" height="${edge.height}" fill="${annotation.color}" />`).join("")}</g>`;
      }
      if (annotation.type === "pen") {
        const strokeWidth = annotation.strokeWidth;
        const d = getImageAnnotationPenPath(
          annotation.points.map((point) => ({
            x: point.x * width,
            y: point.y * height,
          }))
        );
        return `<g data-annotation-kind="pen"><path d="${d}" fill="none" stroke="rgba(15,23,42,0.32)" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth + 2.5}" /><path d="${d}" fill="none" stroke="${annotation.color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}" /></g>`;
      }
      if (annotation.type === "arrow") {
        const strokeWidth = annotation.strokeWidth;
        const arrowShape = getImageAnnotationArrowShape(annotation, { width, height });
        const headPoints = arrowShape.headPoints.map((point) => svgPoint(point, { width, height })).join(" ");
        return `<g data-annotation-kind="arrow"><line x1="${arrowShape.shaftStart.x * width}" y1="${arrowShape.shaftStart.y * height}" x2="${arrowShape.shaftEnd.x * width}" y2="${arrowShape.shaftEnd.y * height}" stroke="${annotation.color}" stroke-width="${strokeWidth}" stroke-linecap="round" /><polygon points="${headPoints}" fill="${annotation.color}" /></g>`;
      }
      if (annotation.type === "number") {
        const radius = Math.max(10, Math.min(16, 10 + String(annotation.number).length * 2));
        const x = annotation.x * width;
        const y = annotation.y * height;
        const textColor = getNumberAnnotationTextColor(annotation.color);
        return `<g data-annotation-kind="number"><circle cx="${x}" cy="${y + 1.5}" r="${radius}" fill="rgba(15,23,42,0.18)" /><circle cx="${x}" cy="${y}" r="${radius}" fill="${annotation.color}" /><text x="${x}" y="${y}" fill="${textColor}" font-size="${radius}" font-weight="700" font-family="Inter, system-ui, sans-serif" text-anchor="middle" dominant-baseline="central">${annotation.number}</text></g>`;
      }
      return `<text x="${annotation.x * width}" y="${annotation.y * height}" fill="${annotation.color}" font-size="${annotation.fontSize}" font-weight="700" font-family="system-ui, sans-serif">${escapeSvgText(annotation.text)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

export function sanitizeImageAnnotations(value: unknown): ImageAnnotation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ImageAnnotation => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) return false;
    if (!isColor(record.color)) return false;
    if (record.type === "rect") {
      return (
        isPositiveNumber(record.strokeWidth) &&
        isPositiveNumber(record.width) &&
        isPositiveNumber(record.height) &&
        typeof record.x === "number" &&
        typeof record.y === "number" &&
        record.x >= 0 &&
        record.y >= 0 &&
        record.x <= 1 &&
        record.y <= 1
      );
    }
    if (record.type === "pen") {
      return (
        isPositiveNumber(record.strokeWidth) &&
        Array.isArray(record.points) &&
        record.points.length >= MIN_PEN_POINTS &&
        record.points.every(isPoint)
      );
    }
    if (record.type === "arrow") {
      return isPositiveNumber(record.strokeWidth) && isPoint(record.start) && isPoint(record.end);
    }
    if (record.type === "number") {
      return (
        isPositiveNumber(record.strokeWidth) &&
        typeof record.number === "number" &&
        Number.isFinite(record.number) &&
        record.number >= 1 &&
        record.number <= MAX_NUMBER_MARKER_VALUE &&
        typeof record.x === "number" &&
        typeof record.y === "number" &&
        record.x >= 0 &&
        record.y >= 0 &&
        record.x <= 1 &&
        record.y <= 1
      );
    }
    if (record.type === "text") {
      const hasPersistedBoxSize = record.width !== undefined || record.height !== undefined;
      const validPersistedBoxSize =
        !hasPersistedBoxSize ||
        (isPositiveNumber(record.width) &&
          isPositiveNumber(record.height) &&
          record.width <= 1 &&
          record.height <= 1);
      return (
        typeof record.text === "string" &&
        record.text.trim().length > 0 &&
        isPositiveNumber(record.fontSize) &&
        validPersistedBoxSize &&
        typeof record.x === "number" &&
        typeof record.y === "number" &&
        record.x >= 0 &&
        record.y >= 0 &&
        record.x <= 1 &&
        record.y <= 1
      );
    }
    return false;
  });
}
