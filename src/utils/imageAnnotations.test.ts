import { describe, expect, it } from "vitest";
import {
  createArrowAnnotation,
  createNumberAnnotation,
  createPenAnnotation,
  createRectAnnotation,
  createTextAnnotation,
  exportImageAnnotationsSvg,
  getImageAnnotationPenPath,
  getImageAnnotationArrowShape,
  getNormalizedAnnotationPoint,
  getNextImageAnnotationNumber,
  getNumberAnnotationTextColor,
  hitTestImageAnnotation,
  moveImageAnnotation,
  resizeImageArrowAnnotation,
  resizeImageRectAnnotation,
  sanitizeImageAnnotations,
} from "./imageAnnotations";

describe("imageAnnotations", () => {
  it("normalizes client points into the image box", () => {
    expect(
      getNormalizedAnnotationPoint(
        { clientX: 150, clientY: 240 },
        { left: 100, top: 200, width: 200, height: 100 }
      )
    ).toEqual({ x: 0.25, y: 0.4 });
  });

  it("clamps normalized points to the image bounds", () => {
    expect(
      getNormalizedAnnotationPoint(
        { clientX: 20, clientY: 500 },
        { left: 100, top: 200, width: 200, height: 100 }
      )
    ).toEqual({ x: 0, y: 1 });
  });

  it("creates normalized rectangles from any drag direction", () => {
    expect(
      createRectAnnotation({
        color: "#ff4d4f",
        id: "mark-1",
        start: { x: 0.8, y: 0.7 },
        end: { x: 0.2, y: 0.3 },
        strokeWidth: 4,
      })
    ).toEqual({
      id: "mark-1",
      type: "rect",
      color: "#ff4d4f",
      strokeWidth: 4,
      x: 0.2,
      y: 0.3,
      width: 0.6,
      height: 0.4,
    });
  });

  it("ignores tiny rectangles and one-point pen marks", () => {
    expect(
      createRectAnnotation({
        color: "#ff4d4f",
        id: "mark-2",
        start: { x: 0.1, y: 0.1 },
        end: { x: 0.1005, y: 0.2 },
        strokeWidth: 4,
      })
    ).toBeNull();
    expect(
      createPenAnnotation({
        color: "#ff4d4f",
        id: "mark-3",
        points: [{ x: 0.1, y: 0.1 }],
        strokeWidth: 4,
      })
    ).toBeNull();
  });

  it("keeps only valid persisted annotation items", () => {
    expect(
      sanitizeImageAnnotations([
        {
          id: "rect-1",
          type: "rect",
          color: "#ff4d4f",
          strokeWidth: 4,
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.4,
        },
        { id: "bad", type: "rect", color: "", strokeWidth: 0, x: -1 },
        {
          id: "pen-1",
          type: "pen",
          color: "#3b82f6",
          strokeWidth: 2,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          id: "text-1",
          type: "text",
          color: "#ff4d4f",
          fontSize: 14,
          text: "ABC123",
          x: 0.4,
          y: 0.5,
        },
      ])
    ).toHaveLength(3);
  });

  it("creates arrow and text annotations for review comments", () => {
    expect(
      createArrowAnnotation({
        color: "#22c55e",
        id: "arrow-1",
        start: { x: 0.2, y: 0.3 },
        end: { x: 0.8, y: 0.7 },
        strokeWidth: 4,
      })
    ).toMatchObject({
      id: "arrow-1",
      type: "arrow",
      color: "#22c55e",
      strokeWidth: 4,
      start: { x: 0.2, y: 0.3 },
      end: { x: 0.8, y: 0.7 },
    });

    expect(
      createTextAnnotation({
        color: "#ff4d4f",
        fontSize: 18,
        id: "text-1",
        point: { x: 0.4, y: 0.5 },
        text: "需要修改",
      })
    ).toMatchObject({
      id: "text-1",
      type: "text",
      color: "#ff4d4f",
      fontSize: 18,
      text: "需要修改",
      x: 0.4,
      y: 0.5,
    });
  });

  it("persists resized text annotation boxes for multiline comments", () => {
    const annotation = (createTextAnnotation as (input: {
      boxSize?: { width: number; height: number };
      color: string;
      fontSize?: number;
      id: string;
      point: { x: number; y: number };
      text: string;
    }) => ReturnType<typeof createTextAnnotation>)({
      boxSize: { width: 0.42, height: 0.18 },
      color: "#ff4d4f",
      fontSize: 14,
      id: "text-box-1",
      point: { x: 0.3, y: 0.4 },
      text: "第一行\n第二行\n第三行",
    });

    expect(annotation).toMatchObject({
      id: "text-box-1",
      type: "text",
      width: 0.42,
      height: 0.18,
    });
    expect(sanitizeImageAnnotations([annotation])).toHaveLength(1);
  });

  it("creates numbered markers and advances the next marker number", () => {
    expect(
      createNumberAnnotation({
        color: "#ff4d4f",
        id: "number-1",
        number: 1,
        point: { x: 0.35, y: 0.45 },
        strokeWidth: 4,
      })
    ).toEqual({
      id: "number-1",
      type: "number",
      color: "#ff4d4f",
      number: 1,
      strokeWidth: 4,
      x: 0.35,
      y: 0.45,
    });

    expect(
      getNextImageAnnotationNumber([
        {
          id: "number-1",
          type: "number",
          color: "#ff4d4f",
          number: 1,
          strokeWidth: 4,
          x: 0.2,
          y: 0.2,
        },
        {
          id: "number-4",
          type: "number",
          color: "#22c55e",
          number: 4,
          strokeWidth: 4,
          x: 0.4,
          y: 0.4,
        },
      ])
    ).toBe(5);
  });

  it("builds a smoothed pen path instead of a jagged polyline", () => {
    const path = getImageAnnotationPenPath([
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.3 },
      { x: 0.4, y: 0.2 },
      { x: 0.6, y: 0.5 },
    ]);

    expect(path).toContain("Q");
    expect(path).toBe("M 0.1 0.1 Q 0.2 0.3 0.3 0.25 Q 0.4 0.2 0.5 0.35 L 0.6 0.5");
  });

  it("uses readable text colors for numbered marker badges", () => {
    expect(getNumberAnnotationTextColor("#ff4d4f")).toBe("#ffffff");
    expect(getNumberAnnotationTextColor("#facc15")).toBe("#111827");
    expect(getNumberAnnotationTextColor("#ffffff")).toBe("#111827");
  });

  it("moves annotations without leaving the image bounds", () => {
    const moved = moveImageAnnotation(
      {
        id: "rect-1",
        type: "rect",
        color: "#ff4d4f",
        strokeWidth: 4,
        x: 0.8,
        y: 0.8,
        width: 0.15,
        height: 0.1,
      },
      { x: 0.2, y: 0.3 }
    );

    expect(moved).toMatchObject({ x: 0.85, y: 0.9 });
  });

  it("resizes arrow endpoints while keeping the arrow inside the image", () => {
    const arrow = {
      id: "arrow-1",
      type: "arrow" as const,
      color: "#ff4d4f",
      strokeWidth: 4,
      start: { x: 0.2, y: 0.3 },
      end: { x: 0.8, y: 0.7 },
    };

    expect(resizeImageArrowAnnotation(arrow, "end", { x: 1.2, y: -0.2 })).toMatchObject({
      end: { x: 1, y: 0 },
      start: { x: 0.2, y: 0.3 },
    });
    expect(resizeImageArrowAnnotation(arrow, "start", { x: 0.4, y: 0.5 })).toMatchObject({
      start: { x: 0.4, y: 0.5 },
      end: { x: 0.8, y: 0.7 },
    });
  });

  it("resizes rectangle handles while keeping the rectangle valid", () => {
    const rect = {
      id: "rect-1",
      type: "rect" as const,
      color: "#ff4d4f",
      strokeWidth: 4,
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.2,
    };

    expect(resizeImageRectAnnotation(rect, "se", { x: 0.8, y: 0.7 })).toMatchObject({
      x: 0.2,
      y: 0.3,
      width: 0.6,
      height: 0.4,
    });
    expect(resizeImageRectAnnotation(rect, "nw", { x: -0.1, y: 0.1 })).toMatchObject({
      x: 0,
      y: 0.1,
      width: 0.6,
      height: 0.4,
    });
    expect(resizeImageRectAnnotation(rect, "w", { x: 0.9, y: 0.4 })).toMatchObject({
      x: 0.598,
      width: 0.002,
    });
  });

  it("computes compact arrow geometry from the rendered image size", () => {
    const shape = getImageAnnotationArrowShape(
      {
        id: "arrow-1",
        type: "arrow",
        color: "#ff4d4f",
        strokeWidth: 4,
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.8, y: 0.7 },
      },
      { width: 1000, height: 500 }
    );

    expect(shape.shaftStart).toEqual({ x: 0.1, y: 0.2 });
    expect(shape.headLengthPx).toBe(17);
    expect(shape.headWidthPx).toBe(13);
    expect(shape.headPoints).toHaveLength(3);
    expect(shape.headPoints[0]).toEqual({ x: 0.8, y: 0.7 });
    expect(shape.shaftEnd.x).toBeLessThan(0.8);
    expect(shape.shaftEnd.y).toBeLessThan(0.7);
  });

  it("hit tests review annotation objects from topmost to oldest", () => {
    const id = hitTestImageAnnotation(
      [
        {
          id: "rect-1",
          type: "rect",
          color: "#ff4d4f",
          strokeWidth: 4,
          x: 0.1,
          y: 0.1,
          width: 0.2,
          height: 0.2,
        },
        {
          id: "text-1",
          type: "text",
          color: "#22c55e",
          fontSize: 18,
          text: "OK",
          x: 0.12,
          y: 0.12,
        },
      ],
      { x: 0.13, y: 0.13 }
    );

    expect(id).toBe("text-1");
  });

  it("exports annotations as scalable svg overlay content", () => {
    const svg = exportImageAnnotationsSvg(
      [
        {
          id: "arrow-1",
          type: "arrow",
          color: "#22c55e",
          strokeWidth: 4,
          start: { x: 0.1, y: 0.2 },
          end: { x: 0.8, y: 0.7 },
        },
        {
          id: "text-1",
          type: "text",
          color: "#ff4d4f",
          fontSize: 18,
          text: "A&B",
          x: 0.4,
          y: 0.5,
        },
        {
          id: "rect-1",
          type: "rect",
          color: "#ff4d4f",
          strokeWidth: 4,
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.4,
        },
        {
          id: "number-1",
          type: "number",
          color: "#111827",
          number: 1,
          strokeWidth: 4,
          x: 0.2,
          y: 0.2,
        },
        {
          id: "pen-1",
          type: "pen",
          color: "#3b82f6",
          strokeWidth: 4,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.3 },
            { x: 0.4, y: 0.2 },
          ],
        },
      ],
      { width: 1000, height: 500 }
    );

    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<marker");
    expect(svg).toContain('data-annotation-kind="arrow"');
    expect(svg).toContain("<polygon");
    expect(svg).toContain("A&amp;B");
    expect(svg).toContain('data-annotation-kind="rect"');
    expect(svg).toContain('<rect x="100" y="100" width="300" height="4" fill="#ff4d4f" />');
    expect(svg).toContain('<rect x="396" y="100" width="4" height="200" fill="#ff4d4f" />');
    expect(svg).toContain('<rect x="100" y="296" width="300" height="4" fill="#ff4d4f" />');
    expect(svg).toContain('<rect x="100" y="100" width="4" height="200" fill="#ff4d4f" />');
    expect(svg).toContain('data-annotation-kind="number"');
    expect(svg).toContain('data-annotation-kind="pen"');
    expect(svg).toContain('stroke="rgba(15,23,42,0.32)"');
    expect(svg).toContain(" Q ");
    expect(svg).not.toContain('stroke="rgba(255,255,255');
    expect(svg).toContain('r="12"');
    expect(svg).toContain(">1</text>");
  });
});
