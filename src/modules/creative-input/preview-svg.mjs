export function renderGenerationPreviewSvg(generation, options = {}) {
  if (generation.status !== "succeeded" || !generation.result) throw new TypeError("Only successful generations can be previewed");
  const result = generation.result;
  const { width, height } = result.coordinateSpace;
  const body = result.resultType === "surface_pattern"
    ? renderPattern(result, options)
    : renderShape(result, options);
  const issueMarkers = renderIssueMarkers(generation.issues ?? []);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${number(width)} ${number(height)}" role="img" aria-label="${escapeAttribute(options.label ?? "生成结果预览")}">`,
    `<rect width="100%" height="100%" fill="${escapeAttribute(options.background ?? "#f7f2e8")}"/>`,
    body,
    issueMarkers,
    `</svg>`,
  ].filter(Boolean).join("");
}

function renderPattern(result, options) {
  const palette = new Map(result.palette.map((entry) => [entry.id, entry.color]));
  const boundary = options.boundaryPointsMm?.length
    ? `<polygon points="${points(options.boundaryPointsMm)}" fill="none" stroke="#9f8a68" stroke-width="0.6"/>`
    : "";
  const elements = [...result.elements]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((element) => {
      const color = escapeAttribute(palette.get(element.paletteId) ?? "#000000");
      const transform = svgTransform(result.transform);
      if (element.type === "polygon") return `<polygon data-element-id="${escapeAttribute(element.id)}" points="${points(element.pointsMm)}" fill="${color}" transform="${transform}"/>`;
      return `<polyline data-element-id="${escapeAttribute(element.id)}" points="${points(element.pointsMm)}" fill="none" stroke="${color}" stroke-width="${number(element.strokeWidthMm)}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}"/>`;
    }).join("");
  return `${boundary}${elements}`;
}

function renderShape(result) {
  return result.shape.components.map((component) => {
    const outer = component.outerBoundary.closed
      ? closedPath(component.outerBoundary.pointsMm)
      : openPath(component.outerBoundary.pointsMm);
    const pathParts = [outer, ...component.holes.map((hole) => closedPath(hole.pointsMm))];
    const fill = component.outerBoundary.closed ? "#d9c08c" : "none";
    return `<path data-component-id="${escapeAttribute(component.id)}" d="${pathParts.join(" ")}" fill="${fill}" stroke="#5d472c" stroke-width="0.8" fill-rule="${escapeAttribute(result.shape.fillRule)}"/>`;
  }).join("");
}

function renderIssueMarkers(issues) {
  return issues.filter((entry) => entry.location?.unit === "mm").map((entry) => {
    const color = entry.severity === "blocking" ? "#c62828" : "#e28a00";
    return `<circle data-issue-code="${escapeAttribute(entry.code)}" cx="${number(entry.location.x)}" cy="${number(entry.location.y)}" r="2.5" fill="${color}"/>`;
  }).join("");
}

function closedPath(pathPoints) {
  if (!pathPoints.length) return "";
  const [first, ...rest] = pathPoints;
  return `M ${number(first.x)} ${number(first.y)} ${rest.map((point) => `L ${number(point.x)} ${number(point.y)}`).join(" ")} Z`;
}

function openPath(pathPoints) {
  if (!pathPoints.length) return "";
  const [first, ...rest] = pathPoints;
  return `M ${number(first.x)} ${number(first.y)} ${rest.map((point) => `L ${number(point.x)} ${number(point.y)}`).join(" ")}`;
}

function svgTransform(transform) {
  const scale = number(transform?.scale ?? 1);
  const rotation = number(transform?.rotationDeg ?? 0);
  const x = number(transform?.offsetMm?.x ?? 0);
  const y = number(transform?.offsetMm?.y ?? 0);
  return `translate(${x} ${y}) rotate(${rotation}) scale(${scale})`;
}

function points(values) {
  return values.map((point) => `${number(point.x)},${number(point.y)}`).join(" ");
}

function number(value) {
  if (!Number.isFinite(value)) throw new TypeError("SVG coordinates must be finite numbers");
  return String(Math.round(value * 1000) / 1000);
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
