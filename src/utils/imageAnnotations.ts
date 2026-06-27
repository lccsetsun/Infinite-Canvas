import type { ImageAnnotation } from "../types";

export type { ImageAnnotation };

export type ImageAnnotationPoint = { x: number; y: number };
export type ImageArrowEndpoint = "start" | "end";

const MIN_RECT_SIZE = 0.002;
const MIN_PEN_POINTS = 2;
const MIN_ARROW_LENGTH = 0.004;
const DEFAULT_TEXT_FONT_SIZE = 18;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeUnit(value: number) {
  return Number(clamp01(value).toFixed(6));
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
  color,
  fontSize = DEFAULT_TEXT_FONT_SIZE,
  id,
  point,
  text,
}: {
  color: string;
  fontSize?: number;
  id: string;
  point: ImageAnnotationPoint;
  text: string;
}): ImageAnnotation | null {
  const normalizedText = text.trim();
  if (!normalizedText) return null;
  return {
    id,
    type: "text",
    color,
    fontSize: Math.max(10, Math.min(64, Math.round(fontSize))),
    text: normalizedText,
    x: normalizeUnit(point.x),
    y: normalizeUnit(point.y),
  };
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
    } else if (
      point.x >= annotation.x &&
      point.x <= annotation.x + Math.max(0.08, annotation.text.length * 0.018) &&
      point.y >= annotation.y - 0.04 &&
      point.y <= annotation.y + 0.02
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
        return `<rect x="${annotation.x * width}" y="${annotation.y * height}" width="${annotation.width * width}" height="${annotation.height * height}" fill="none" stroke="${annotation.color}" stroke-width="${strokeWidth}" />`;
      }
      if (annotation.type === "pen") {
        const strokeWidth = annotation.strokeWidth;
        const d = annotation.points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x * width} ${point.y * height}`)
          .join(" ");
        return `<path d="${d}" fill="none" stroke="${annotation.color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}" />`;
      }
      if (annotation.type === "arrow") {
        const strokeWidth = annotation.strokeWidth;
        return `<line x1="${annotation.start.x * width}" y1="${annotation.start.y * height}" x2="${annotation.end.x * width}" y2="${annotation.end.y * height}" stroke="${annotation.color}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#annotation-arrow)" />`;
      }
      return `<text x="${annotation.x * width}" y="${annotation.y * height}" fill="${annotation.color}" font-size="${annotation.fontSize}" font-weight="700" font-family="system-ui, sans-serif">${escapeSvgText(annotation.text)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="annotation-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L8,3 z" fill="context-stroke"/></marker></defs>${body}</svg>`;
}

export function sanitizeImageAnnotations(value: unknown): ImageAnnotation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ImageAnnotation => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) return false;
    if (!isColor(record.color) || !isPositiveNumber(record.strokeWidth)) return false;
    if (record.type === "rect") {
      return (
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
        Array.isArray(record.points) &&
        record.points.length >= MIN_PEN_POINTS &&
        record.points.every(isPoint)
      );
    }
    if (record.type === "arrow") {
      return isPoint(record.start) && isPoint(record.end);
    }
    if (record.type === "text") {
      return (
        typeof record.text === "string" &&
        record.text.trim().length > 0 &&
        isPositiveNumber(record.fontSize) &&
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
