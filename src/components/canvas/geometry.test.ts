import { describe, expect, it } from "vitest";
import { GRID_SIZE, snapPointToGrid, snapToGrid } from "./geometry";

describe("grid snapping", () => {
  it("snaps scalar values to the nearest base grid line", () => {
    expect(snapToGrid(35)).toBe(24);
    expect(snapToGrid(37)).toBe(48);
    expect(snapToGrid(-13)).toBe(-24);
  });

  it("snaps points with the shared grid size", () => {
    expect(snapPointToGrid({ x: 61, y: 83 })).toEqual({ x: 72, y: 72 });
    expect(GRID_SIZE).toBe(24);
  });
});
