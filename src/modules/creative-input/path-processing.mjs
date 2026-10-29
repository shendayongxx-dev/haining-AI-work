export function processStroke(stroke, options = {}) {
  const minimumDistance = options.minimumDistance ?? 0.001;
  const smoothingFactor = options.smoothingFactor ?? 0.25;
  const simplifyTolerance = options.simplifyTolerance ?? 0.0015;

  const deduplicated = removeNearDuplicatePoints(stroke.points, minimumDistance);
  const smoothed = smoothPoints(deduplicated, smoothingFactor);
  const simplified = simplifyPoints(smoothed, simplifyTolerance);

  return {
    ...stroke,
    originalPoints: stroke.points.map((point) => ({ ...point })),
    points: simplified,
    processing: {
      removedDuplicatePoints: stroke.points.length - deduplicated.length,
      smoothed: smoothed.some((point, index) => !samePoint(point, deduplicated[index])),
      simplified: simplified.length < smoothed.length,
    },
  };
}

export function removeNearDuplicatePoints(points, minimumDistance) {
  if (points.length < 2) return points.map(copyPoint);
  const output = [copyPoint(points[0])];
  for (const point of points.slice(1)) {
    if (distance(output.at(-1), point) >= minimumDistance) output.push(copyPoint(point));
  }
  return output;
}

export function smoothPoints(points, factor = 0.25) {
  if (points.length < 3 || factor <= 0) return points.map(copyPoint);
  const output = [copyPoint(points[0])];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = output.at(-1);
    const current = points[index];
    output.push({
      ...current,
      x: previous.x * factor + current.x * (1 - factor),
      y: previous.y * factor + current.y * (1 - factor),
    });
  }
  output.push(copyPoint(points.at(-1)));
  return output;
}

export function simplifyPoints(points, tolerance = 0.0015) {
  if (points.length <= 2 || tolerance <= 0) return points.map(copyPoint);
  const simplified = ramerDouglasPeucker(points, tolerance);
  return simplified.map(copyPoint);
}

export function suggestClosure(stroke, tolerance = 0.02) {
  if (stroke.points.length < 3) return { suggested: false, distance: null };
  const gap = distance(stroke.points[0], stroke.points.at(-1));
  return { suggested: gap > 0 && gap <= tolerance, distance: gap };
}

export function closeStroke(stroke) {
  if (stroke.points.length < 3) throw new TypeError("A closed stroke needs at least three points");
  const first = stroke.points[0];
  const last = stroke.points.at(-1);
  const points = samePoint(first, last) ? stroke.points.map(copyPoint) : [...stroke.points.map(copyPoint), copyPoint(first)];
  return { ...stroke, closed: true, points };
}

function ramerDouglasPeucker(points, tolerance) {
  let maximumDistance = 0;
  let splitIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (currentDistance > maximumDistance) {
      maximumDistance = currentDistance;
      splitIndex = index;
    }
  }
  if (maximumDistance <= tolerance) return [points[0], points.at(-1)];
  const left = ramerDouglasPeucker(points.slice(0, splitIndex + 1), tolerance);
  const right = ramerDouglasPeucker(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return distance(point, lineStart);
  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  return numerator / Math.hypot(dx, dy);
}

function copyPoint(point) {
  return { ...point };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function samePoint(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}
