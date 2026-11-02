export type MmPoint = { x: number; y: number };
export type FixedPatternTransform = {
  scale: number;
  rotationDeg: number;
  pivotMm: MmPoint;
  offsetMm: MmPoint;
};
export function applyPatternTransform(point: MmPoint, transform: FixedPatternTransform): MmPoint;
