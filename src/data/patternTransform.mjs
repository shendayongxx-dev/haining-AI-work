/** A4 coordinates have x right and y down; positive angles appear clockwise. */
export function applyPatternTransform(point, transform) {
  const theta = transform.rotationDeg * Math.PI / 180;
  const x = (point.x - transform.pivotMm.x) * transform.scale;
  const y = (point.y - transform.pivotMm.y) * transform.scale;
  return {
    x: transform.pivotMm.x + x * Math.cos(theta) - y * Math.sin(theta) + transform.offsetMm.x,
    y: transform.pivotMm.y + x * Math.sin(theta) + y * Math.cos(theta) + transform.offsetMm.y,
  };
}
