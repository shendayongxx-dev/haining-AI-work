import type { Point } from '../../model';

const MINIMUM_POINT_DISTANCE_MM = 1.2;
const MINIMUM_PATH_LENGTH_MM = 8;
const MINIMUM_BOUNDS_AREA_MM2 = 4;

export type ShapeProcessingResult = {
  points: Point[];
  autoClosed: boolean;
  smoothed: boolean;
};

/** Infers a closed outline from a freehand stroke without requiring precise endpoint placement. */
export function prepareCustomShapeStroke(source: Point[]): ShapeProcessingResult {
  const deduplicated = removeNearDuplicatePoints(source, MINIMUM_POINT_DISTANCE_MM);
  const ring = removeRepeatedClosingPoint(deduplicated);
  if (!hasOutlineIntent(ring)) {
    return { points: deduplicated.map(copyPoint), autoClosed: false, smoothed: false };
  }

  let smoothed = ring.map(copyPoint);
  for (let pass = 0; pass < 2; pass += 1) smoothed = smoothClosedRing(smoothed);
  return {
    points: [...smoothed.map(copyPoint), copyPoint(smoothed[0])],
    autoClosed: !isExactlyClosed(source),
    smoothed: !samePoints(ring, smoothed),
  };
}

function hasOutlineIntent(points: Point[]) {
  if (points.length < 3) return false;
  const pathLength = points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const boundsArea = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  return pathLength >= MINIMUM_PATH_LENGTH_MM && boundsArea >= MINIMUM_BOUNDS_AREA_MM2;
}

function smoothClosedRing(points: Point[]) {
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return {
      x: round(previous.x * 0.2 + point.x * 0.6 + next.x * 0.2),
      y: round(previous.y * 0.2 + point.y * 0.6 + next.y * 0.2),
    };
  });
}

function removeNearDuplicatePoints(points: Point[], minimumDistance: number) {
  if (points.length === 0) return [];
  const output = [copyPoint(points[0])];
  for (const point of points.slice(1)) {
    if (distance(output.at(-1)!, point) >= minimumDistance) output.push(copyPoint(point));
  }
  return output;
}

function removeRepeatedClosingPoint(points: Point[]) {
  return points.length > 1 && isExactlyClosed(points) ? points.slice(0, -1).map(copyPoint) : points.map(copyPoint);
}

function isExactlyClosed(points: Point[]) {
  return points.length > 1 && distance(points[0], points.at(-1)!) < 0.001;
}

function samePoints(a: Point[], b: Point[]) {
  return a.length === b.length && a.every((point, index) => point.x === b[index].x && point.y === b[index].y);
}

function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
function copyPoint(point: Point): Point { return { x: point.x, y: point.y }; }
function round(value: number) { return Math.round(value * 1000) / 1000; }
