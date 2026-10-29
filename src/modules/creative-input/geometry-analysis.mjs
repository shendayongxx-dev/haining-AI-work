export function findSelfIntersections(points) {
  const ring = withoutRepeatedClosingPoint(points);
  if (ring.length < 4) return [];
  const intersections = [];

  for (let first = 0; first < ring.length; first += 1) {
    const a = ring[first];
    const b = ring[(first + 1) % ring.length];
    for (let second = first + 1; second < ring.length; second += 1) {
      if (segmentsAreAdjacent(first, second, ring.length)) continue;
      const c = ring[second];
      const d = ring[(second + 1) % ring.length];
      const point = lineIntersection(a, b, c, d);
      if (point && pointOnSegment(point, a, b) && pointOnSegment(point, c, d)) {
        intersections.push({
          firstSegmentIndex: first,
          secondSegmentIndex: second,
          point: roundPoint(point),
        });
      }
    }
  }
  return intersections;
}

export function findDuplicateConsecutivePoints(points) {
  const duplicates = [];
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].x === points[index - 1].x && points[index].y === points[index - 1].y) {
      duplicates.push({ index, point: { ...points[index] } });
    }
  }
  return duplicates;
}

function lineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) <= Number.EPSILON) return null;
  const firstDeterminant = a.x * b.y - a.y * b.x;
  const secondDeterminant = c.x * d.y - c.y * d.x;
  return {
    x: (firstDeterminant * (c.x - d.x) - (a.x - b.x) * secondDeterminant) / denominator,
    y: (firstDeterminant * (c.y - d.y) - (a.y - b.y) * secondDeterminant) / denominator,
  };
}

function pointOnSegment(point, a, b) {
  const epsilon = 1e-9;
  return (
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

function segmentsAreAdjacent(first, second, count) {
  return first === second || (first + 1) % count === second || (second + 1) % count === first;
}

function withoutRepeatedClosingPoint(points) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points.at(-1);
  return first.x === last.x && first.y === last.y ? points.slice(0, -1) : points;
}

function roundPoint(point) {
  return {
    x: Math.round(point.x * 1000) / 1000,
    y: Math.round(point.y * 1000) / 1000,
  };
}
