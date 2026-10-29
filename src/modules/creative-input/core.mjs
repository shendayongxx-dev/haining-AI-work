import { findSelfIntersections } from "./geometry-analysis.mjs";

/**
 * Framework-independent core for C group's creative-input translation.
 *
 * Public generation geometry is expressed in millimetres. Raw drawing input
 * may be normalized or pixel-based. This module does not infer weaving rules,
 * strips, interlacing, materials, or craft feasibility.
 */

const SUPPORTED_INPUT_UNITS = new Set(["normalized", "px"]);
export const C_CORE_VERSION = "c-core-v0.1";

export function translateDrawing(request) {
  assertRequest(request);

  const generationRevision = request.generationRevision;
  const generationId = request.generationId;
  const pointsByStroke = request.input.strokes.map((stroke) => ({
    ...stroke,
    pointsMm: stroke.points.map((point) =>
      drawingPointToMm(point, request.input.drawingSpace, request.carrier.coordinateSpace),
    ),
  }));

  if (request.carrier.type === "fan") {
    return createSurfacePatternResult({
      request,
      generationId,
      generationRevision,
      pointsByStroke,
    });
  }

  return createCarrierShapeResult({
    request,
    generationId,
    generationRevision,
    generatorVersion: C_CORE_VERSION,
    pointsByStroke,
  });
}

export function canConfirmGeneration(generation) {
  return (
    generation.status === "succeeded" &&
    !generation.issues.some((issue) => issue.severity === "blocking")
  );
}

export function validateCarrierShape(shape) {
  const issues = [];

  for (const component of shape.components) {
    const boundary = component.outerBoundary;

    if (!boundary.closed) {
      issues.push(
        issue("OPEN_BOUNDARY", "blocking", component.id, "外轮廓未闭合，请连接高亮端点后重新生成。"),
      );
      continue;
    }

    const intersections = findSelfIntersections(boundary.pointsMm);
    if (intersections.length > 0) {
      issues.push(
        issue("SELF_INTERSECTION", "blocking", component.id, "外轮廓存在自交，请修改交叉区域。", {
          location: { ...intersections[0].point, unit: "mm" },
          details: { intersections },
        }),
      );
    }

    if (Math.abs(signedArea(boundary.pointsMm)) <= Number.EPSILON) {
      issues.push(
        issue("NON_POSITIVE_AREA", "blocking", component.id, "外轮廓没有形成有效面积。"),
      );
    }

    if (component.holes.length > 0) {
      issues.push(
        issue("HAS_HOLES", "warning", component.id, "形状包含孔洞，当前工艺状态需后续验证。"),
      );
    }
  }

  if (shape.components.length > 1) {
    issues.push(
      issue("MULTIPLE_COMPONENTS", "warning", undefined, "形状包含多个不相连部件，当前工艺状态需后续验证。"),
    );
  }

  return issues;
}

export function drawingPointToMm(point, drawingSpace, coordinateSpace) {
  if (!SUPPORTED_INPUT_UNITS.has(drawingSpace.unit)) {
    throw new TypeError(`Unsupported drawing unit: ${drawingSpace.unit}`);
  }

  const normalizedX = drawingSpace.unit === "normalized" ? point.x : point.x / drawingSpace.width;
  const normalizedY = drawingSpace.unit === "normalized" ? point.y : point.y / drawingSpace.height;

  return {
    x: round(normalizedX * coordinateSpace.width),
    y: round(normalizedY * coordinateSpace.height),
  };
}

export function signedArea(points) {
  const ring = withoutRepeatedClosingPoint(points);
  if (ring.length < 3) return 0;

  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

export function hasSelfIntersection(points) {
  return findSelfIntersections(points).length > 0;
}

function createSurfacePatternResult({ request, generationId, generationRevision, pointsByStroke }) {
  const palette = createPalette(pointsByStroke);
  const paletteByColor = new Map(palette.map((entry) => [entry.color.toLowerCase(), entry.id]));
  const issues = [];

  const elements = pointsByStroke
    .filter((stroke) => {
      if (stroke.pointsMm.length >= 2) return true;
      issues.push(issue("DRAWING_STROKE_TOO_SHORT", "warning", stroke.id, "笔画点数不足，已忽略。"));
      return false;
    })
    .map((stroke, index) => {
      const closed = isClosedStroke(stroke);
      return {
        id: `${generationId}-element-${String(index + 1).padStart(3, "0")}`,
        sourceStrokeId: stroke.id,
        type: closed ? "polygon" : "polyline",
        pointsMm: stroke.pointsMm,
        ...(closed ? {} : { strokeWidthMm: drawingWidthToMm(stroke.width, request) }),
        paletteId: paletteByColor.get(stroke.color.toLowerCase()),
        zIndex: index + 1,
      };
    });

  if (elements.length === 0) {
    issues.push(issue("GENERATION_FAILED", "blocking", undefined, "没有可生成的有效笔画。"));
  }

  return {
    designId: request.designId,
    generationId,
    generationRevision,
    generatorVersion: C_CORE_VERSION,
    inputVersionId: request.inputVersionId,
    status: elements.length === 0 ? "failed" : "succeeded",
    result: elements.length
      ? {
          resultType: "surface_pattern",
          patternId: `${generationId}-pattern`,
          coordinateSpace: request.carrier.coordinateSpace,
          palette,
          elements,
          transform: {
            scale: 1,
            rotationDeg: 0,
            offsetMm: { x: 0, y: 0 },
          },
        }
      : undefined,
    issues,
  };
}

function createCarrierShapeResult({ request, generationId, generationRevision, pointsByStroke }) {
  const components = pointsByStroke.map((stroke, index) => ({
    id: `${generationId}-component-${String(index + 1).padStart(3, "0")}`,
    sourceStrokeId: stroke.id,
    outerBoundary: {
      closed: isClosedStroke(stroke),
      pointsMm: stroke.pointsMm,
    },
    holes: [],
  }));

  const shape = {
    components,
    fillRule: "evenodd",
  };
  const issues = components.length
    ? validateCarrierShape(shape)
    : [issue("GENERATION_FAILED", "blocking", undefined, "没有可生成的有效形状。")];

  return {
    designId: request.designId,
    generationId,
    generationRevision,
    inputVersionId: request.inputVersionId,
    status: components.length ? "succeeded" : "failed",
    result: components.length
      ? {
          resultType: "carrier_shape",
          coordinateSpace: request.carrier.coordinateSpace,
          shape,
        }
      : undefined,
    issues,
  };
}

function assertRequest(request) {
  if (!request?.designId || !request?.generationId || !request?.inputVersionId) {
    throw new TypeError("designId, generationId and inputVersionId are required");
  }
  if (!Number.isInteger(request.generationRevision) || request.generationRevision < 1) {
    throw new TypeError("generationRevision must be a positive integer");
  }
  if (!["fan", "custom"].includes(request.carrier?.type)) {
    throw new TypeError("carrier.type must be fan or custom");
  }
  if (request.input?.channel !== "drawing") {
    throw new TypeError("This vertical slice currently supports drawing input only");
  }
  if (!Array.isArray(request.input.strokes)) {
    throw new TypeError("input.strokes must be an array");
  }
  if (request.carrier.coordinateSpace?.unit !== "mm") {
    throw new TypeError("Public generation coordinates must use mm");
  }
}

function createPalette(strokes) {
  const uniqueColors = [...new Set(strokes.map((stroke) => stroke.color.toLowerCase()))];
  return uniqueColors.map((color, index) => ({
    id: index === 0 ? "primary" : `color-${String(index + 1).padStart(2, "0")}`,
    color,
    role: "pattern",
  }));
}

function isClosedStroke(stroke) {
  if (stroke.closed === true) return true;
  if (stroke.pointsMm.length < 3) return false;
  const first = stroke.pointsMm[0];
  const last = stroke.pointsMm.at(-1);
  return first.x === last.x && first.y === last.y;
}

function drawingWidthToMm(width, request) {
  const drawingSpace = request.input.drawingSpace;
  if (drawingSpace.unit === "normalized") {
    return round(width * Math.min(request.carrier.coordinateSpace.width, request.carrier.coordinateSpace.height));
  }
  const ratio = request.carrier.coordinateSpace.width / drawingSpace.width;
  return round(width * ratio);
}

function issue(code, severity, targetId, message, extras = {}) {
  return {
    id: `issue-${code.toLowerCase()}${targetId ? `-${targetId}` : ""}`,
    code,
    severity,
    stage: code === "GENERATION_FAILED" ? "translation" : "geometry",
    message,
    ...(targetId ? { targetId } : {}),
    ...extras,
    source: { module: "C", generatorVersion: C_CORE_VERSION },
  };
}

function withoutRepeatedClosingPoint(points) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points.at(-1);
  return first.x === last.x && first.y === last.y ? points.slice(0, -1) : points;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
