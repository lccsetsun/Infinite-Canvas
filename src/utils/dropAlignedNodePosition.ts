export type DropAlignedPoint = {
  x: number;
  y: number;
};

export function getPointerAlignedNodePosition(point: DropAlignedPoint): DropAlignedPoint {
  return { x: point.x, y: point.y };
}
