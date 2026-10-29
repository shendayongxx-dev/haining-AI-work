export function validateGenerationResult(generation) {
  const errors = [];
  if (!generation || typeof generation !== "object") return [error("INVALID_GENERATION", "生成结果必须是对象。")];
  requiredString(generation.designId, "designId", errors);
  requiredString(generation.generationId, "generationId", errors);
  requiredString(generation.inputVersionId, "inputVersionId", errors);
  if (!Number.isInteger(generation.generationRevision) || generation.generationRevision < 1) {
    errors.push(error("INVALID_GENERATION_REVISION", "generationRevision 必须是正整数。", "generationRevision"));
  }
  if (generation.status === "failed") {
    if (generation.result !== undefined) errors.push(error("FAILED_RESULT_PRESENT", "失败记录不能包含可确认结果。", "result"));
    return errors;
  }
  if (generation.status !== "succeeded") errors.push(error("INVALID_STATUS", "status 必须是 succeeded 或 failed。", "status"));
  if (!generation.result) return [...errors, error("MISSING_RESULT", "成功记录必须包含 result。", "result")];

  errors.push(...validateCoordinateSpace(generation.result.coordinateSpace));
  if (generation.result.resultType === "surface_pattern") {
    errors.push(...validateSurfacePattern(generation.result));
  } else if (generation.result.resultType === "carrier_shape") {
    errors.push(...validateCarrierShapeResult(generation.result));
  } else {
    errors.push(error("INVALID_RESULT_TYPE", "resultType 必须是 surface_pattern 或 carrier_shape。", "result.resultType"));
  }
  return errors;
}

export function validateSurfacePattern(result) {
  const errors = [];
  requiredString(result.patternId, "result.patternId", errors);
  if (!Array.isArray(result.palette) || result.palette.length === 0) {
    errors.push(error("EMPTY_PALETTE", "surface_pattern 必须包含有限色板。", "result.palette"));
  }
  const paletteIds = new Set();
  for (const [index, color] of (result.palette ?? []).entries()) {
    if (!color.id || paletteIds.has(color.id)) errors.push(error("DUPLICATE_PALETTE_ID", "色板 ID 缺失或重复。", `result.palette[${index}].id`));
    paletteIds.add(color.id);
    if (!isCssHexColor(color.color)) errors.push(error("INVALID_COLOR", "首版色板颜色必须使用 #RRGGBB。", `result.palette[${index}].color`));
  }
  if (!Array.isArray(result.elements) || result.elements.length === 0) {
    errors.push(error("EMPTY_ELEMENTS", "surface_pattern 至少需要一个图样元素。", "result.elements"));
  }
  const elementIds = new Set();
  for (const [index, element] of (result.elements ?? []).entries()) {
    const path = `result.elements[${index}]`;
    if (!element.id || elementIds.has(element.id)) errors.push(error("DUPLICATE_ELEMENT_ID", "图样元素 ID 缺失或重复。", `${path}.id`));
    elementIds.add(element.id);
    if (!["polygon", "polyline"].includes(element.type)) errors.push(error("INVALID_ELEMENT_TYPE", "元素类型必须是 polygon 或 polyline。", `${path}.type`));
    if (!Array.isArray(element.pointsMm) || element.pointsMm.length < 2) errors.push(error("INVALID_POINTS", "元素至少需要两个毫米坐标点。", `${path}.pointsMm`));
    for (const [pointIndex, point] of (element.pointsMm ?? []).entries()) validatePoint(point, `${path}.pointsMm[${pointIndex}]`, errors);
    if (!paletteIds.has(element.paletteId)) errors.push(error("UNKNOWN_PALETTE_ID", "元素引用了不存在的 paletteId。", `${path}.paletteId`));
    if (element.type === "polygon" && !isClosedPoints(element.pointsMm)) errors.push(error("OPEN_POLYGON", "polygon 的首尾点必须闭合。", `${path}.pointsMm`));
    if (element.type === "polyline" && !(element.strokeWidthMm > 0)) errors.push(error("INVALID_STROKE_WIDTH", "polyline 必须包含正数 strokeWidthMm。", `${path}.strokeWidthMm`));
  }
  return errors;
}

export function validateCarrierShapeResult(result) {
  const errors = [];
  const components = result.shape?.components;
  if (!Array.isArray(components) || components.length === 0) {
    return [error("EMPTY_COMPONENTS", "carrier_shape 至少需要一个部件。", "result.shape.components")];
  }
  const ids = new Set();
  for (const [index, component] of components.entries()) {
    const path = `result.shape.components[${index}]`;
    if (!component.id || ids.has(component.id)) errors.push(error("DUPLICATE_COMPONENT_ID", "部件 ID 缺失或重复。", `${path}.id`));
    ids.add(component.id);
    if (!component.outerBoundary || !Array.isArray(component.outerBoundary.pointsMm)) errors.push(error("MISSING_OUTER_BOUNDARY", "部件必须包含外轮廓。", `${path}.outerBoundary`));
    for (const [pointIndex, point] of (component.outerBoundary?.pointsMm ?? []).entries()) validatePoint(point, `${path}.outerBoundary.pointsMm[${pointIndex}]`, errors);
    for (const [holeIndex, hole] of (component.holes ?? []).entries()) {
      if (!hole.closed || !isClosedPoints(hole.pointsMm)) errors.push(error("OPEN_HOLE", "孔洞路径必须闭合。", `${path}.holes[${holeIndex}]`));
    }
  }
  if (!["evenodd", "nonzero"].includes(result.shape.fillRule)) errors.push(error("INVALID_FILL_RULE", "fillRule 必须是 evenodd 或 nonzero。", "result.shape.fillRule"));
  return errors;
}

function validateCoordinateSpace(space) {
  const errors = [];
  if (space?.unit !== "mm") errors.push(error("INVALID_PUBLIC_UNIT", "公开生成结果必须使用 mm。", "result.coordinateSpace.unit"));
  if (!(space?.width > 0) || !(space?.height > 0)) errors.push(error("INVALID_COORDINATE_SIZE", "坐标空间宽高必须为正数。", "result.coordinateSpace"));
  if (space?.origin !== "topLeft" || space?.xAxis !== "right" || space?.yAxis !== "down") errors.push(error("INVALID_COORDINATE_AXES", "首版公共坐标必须为左上原点、X 向右、Y 向下。", "result.coordinateSpace"));
  return errors;
}

function validatePoint(point, path, errors) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) errors.push(error("INVALID_POINT", "坐标点必须包含有限数值 x/y。", path));
}

function requiredString(value, path, errors) {
  if (typeof value !== "string" || value.length === 0) errors.push(error("MISSING_REQUIRED_STRING", `${path} 必须是非空字符串。`, path));
}

function isClosedPoints(points) {
  if (!Array.isArray(points) || points.length < 4) return false;
  const first = points[0];
  const last = points.at(-1);
  return first.x === last.x && first.y === last.y;
}

function isCssHexColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color ?? "");
}

function error(code, message, path) {
  return { code, message, ...(path ? { path } : {}) };
}
