import type { Point } from '../../model';

const MINIMUM_POINT_DISTANCE_MM = 2;
const MINIMUM_PATH_LENGTH_MM = 8;
const MINIMUM_BOUNDS_AREA_MM2 = 4;
const LOCAL_LOOP_MAX_PATH_RATIO = 0.38;
const MAX_REPAIR_PASSES = 8;

export type ShapeProcessingResult = {
  points: Point[];
  autoClosed: boolean;
  smoothed: boolean;
  selfIntersectionRepaired: boolean;
};

/** Infers a closed outline from a freehand stroke without requiring precise endpoint placement. */
export function prepareCustomShapeStroke(source: Point[]): ShapeProcessingResult {
  const deduplicated = removeNearDuplicatePoints(source, MINIMUM_POINT_DISTANCE_MM);
  const ring = removeRepeatedClosingPoint(deduplicated);
  if (!hasOutlineIntent(ring)) {
    return { points: deduplicated.map(copyPoint), autoClosed: false, smoothed: false, selfIntersectionRepaired: false };
  }

  let smoothed = ring.map(copyPoint);
  for (let pass = 0; pass < 3; pass += 1) smoothed = smoothClosedRing(smoothed);
  const repaired = removeLocalSelfIntersectionLoops(smoothed);
  return {
    points: [...repaired.points.map(copyPoint), copyPoint(repaired.points[0])],
    autoClosed: !isExactlyClosed(source),
    smoothed: !samePoints(ring, repaired.points),
    selfIntersectionRepaired: repaired.repaired,
  };
}

/** Removes short hand-jitter loops while leaving large structural crossings for validation. */
function removeLocalSelfIntersectionLoops(source: Point[]) {
  let points = source.map(copyPoint);
  let repaired = false;
  for (let pass = 0; pass < MAX_REPAIR_PASSES; pass += 1) {
    const crossing = findSelfIntersection(points);
    if (!crossing) break;

    const { firstEdge, secondEdge, point } = crossing;
    const between = pathLength(points.slice(firstEdge + 1, secondEdge + 1))
      + distance(point, points[firstEdge + 1]) + distance(points[secondEdge], point);
    const total = closedPathLength(points);
    const complement = Math.max(0, total - between);
    const smallerLoop = Math.min(between, complement);
    if (total <= 0 || smallerLoop / total > LOCAL_LOOP_MAX_PATH_RATIO) break;

    const candidate = between <= complement
      ? [copyPoint(point), ...points.slice(secondEdge + 1).map(copyPoint), ...points.slice(0, firstEdge + 1).map(copyPoint)]
      : [copyPoint(point), ...points.slice(firstEdge + 1, secondEdge + 1).map(copyPoint)];
    const simplified = removeNearDuplicatePoints(candidate, MINIMUM_POINT_DISTANCE_MM * 0.5);
    if (simplified.length < 3) break;
    points = simplified;
    repaired = true;
  }
  return { points, repaired };
}

function findSelfIntersection(points: Point[]) {
  for (let firstEdge = 0; firstEdge < points.length; firstEdge += 1) {
    const firstNext = (firstEdge + 1) % points.length;
    for (let secondEdge = firstEdge + 1; secondEdge < points.length; secondEdge += 1) {
      const secondNext = (secondEdge + 1) % points.length;
      if (firstNext === secondEdge || secondNext === firstEdge) continue;
      const point = segmentIntersection(points[firstEdge], points[firstNext], points[secondEdge], points[secondNext]);
      if (point) return { firstEdge, secondEdge, point };
    }
  }
  return null;
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const abx = b.x - a.x; const aby = b.y - a.y;
  const cdx = d.x - c.x; const cdy = d.y - c.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) < 0.000001) return null;
  const acx = c.x - a.x; const acy = c.y - a.y;
  const t = (acx * cdy - acy * cdx) / denominator;
  const u = (acx * aby - acy * abx) / denominator;
  if (t <= 0.0001 || t >= 0.9999 || u <= 0.0001 || u >= 0.9999) return null;
  return { x: round(a.x + t * abx), y: round(a.y + t * aby) };
}

function closedPathLength(points: Point[]) {
  return points.reduce((total, point, index) => total + distance(point, points[(index + 1) % points.length]), 0);
}

function pathLength(points: Point[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
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
