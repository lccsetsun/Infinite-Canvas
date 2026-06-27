import { describe, expect, it } from "vitest";
import {
  createArrowAnnotation,
  createPenAnnotation,
  createRectAnnotation,
  createTextAnnotation,
  exportImageAnnotationsSvg,
  getNormalizedAnnotationPoint,
  hitTestImageAnnotation,
  moveImageAnnotation,
  resizeImageArrowAnnotation,
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
      ])
    ).toHaveLength(2);
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
      ],
      { width: 1000, height: 500 }
    );

    expect(svg).toContain("<svg");
    expect(svg).toContain("<marker");
    expect(svg).toContain("A&amp;B");
  });
});
