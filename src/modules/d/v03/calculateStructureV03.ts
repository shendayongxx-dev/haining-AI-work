import carrierSpecJson from '../../../../data/CARRIER_SPEC_V1_2.json';
import weaveSpecJson from '../../../../data/WEAVE_SPEC_V1_2.json';
import type { PointMm, SurfacePattern } from '../types';
import type {
  CarrierId, ColorSegmentV03, CrossingV03, Direction, EngineeringWarningV03,
  StripV03, StructureSnapshotV03, StructureV03Input, VisibleSegmentV03, WeaveId, WeavingOperationV03,
} from './types';

type Rect = { type: 'rect'; x: number; y: number; width: number; height: number };
type Circle = { type: 'circle'; cx: number; cy: number; r: number };
type Ellipse = { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number };
type Polygon = { type: 'polygon'; pointsMm: number[][]; derivation?: unknown };
type Boundary = Circle | Ellipse | Polygon;
type CarrierSpec = {
  carrierId: CarrierId; rawBlankBoundary: Rect; boundary: Boundary; effectivePatternBoundary: Boundary;
  handleExclusion: { version?: string; xMin: number; xMax: number; yMin: number; yMax: number };
};
type WeaveSpec = {
  weaveId: WeaveId; craftRuleVersion: string; gridType: string; topLayerMatrix: string[][];
  stripWidthMm?: number; clearHoleMm?: number; pitchMm?: number;
};

const carrierSpec = carrierSpecJson as unknown as { carriers: CarrierSpec[] };
const weaveSpec = weaveSpecJson as unknown as { weaves: WeaveSpec[] };
const round = (value: number) => Math.round(value * 100) / 100;
const pad = (value: number) => String(value).padStart(3, '0');
const mmDistance = (a: PointMm, b: PointMm) => Math.hypot(a.x - b.x, a.y - b.y);

function carrierById(id: CarrierId) {
  const value = carrierSpec.carriers.find(entry => entry.carrierId === id);
  if (!value) throw new Error(`Unsupported carrierId: ${id}`);
  return value;
}

function weaveById(id: WeaveId) {
  const value = weaveSpec.weaves.find(entry => entry.weaveId === id);
  if (!value) throw new Error(`Unsupported weaveId: ${id}`);
  return value;
}

function pointInPolygon(point: PointMm, points: number[][]) {
  const onBoundary = points.some((a, index) => {
    const b = points[(index + 1) % points.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0 ? 0 : ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / lengthSquared;
    if (projection < -1e-6 || projection > 1 + 1e-6) return false;
    const nearestX = a[0] + Math.max(0, Math.min(1, projection)) * dx;
    const nearestY = a[1] + Math.max(0, Math.min(1, projection)) * dy;
    return Math.hypot(point.x - nearestX, point.y - nearestY) <= .01;
  });
  if (onBoundary) return true;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    const crosses = (a[1] > point.y) !== (b[1] > point.y)
      && point.x < (b[0] - a[0]) * (point.y - a[1]) / ((b[1] - a[1]) || Number.EPSILON) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInBoundary(point: PointMm, boundary: Boundary, tolerance = .01) {
  if (boundary.type === 'circle') return Math.hypot(point.x - boundary.cx, point.y - boundary.cy) <= boundary.r + tolerance;
  if (boundary.type === 'ellipse') {
    const dx = (point.x - boundary.cx) / boundary.rx;
    const dy = (point.y - boundary.cy) / boundary.ry;
    return dx * dx + dy * dy <= 1 + tolerance / Math.max(boundary.rx, boundary.ry);
  }
  return pointInPolygon(point, boundary.pointsMm);
}

function lineBoundaryCoordinates(direction: Direction, axisMm: number, boundary: Boundary): number[] {
  if (boundary.type === 'circle') {
    const offset = axisMm - (direction === 'warp' ? boundary.cx : boundary.cy);
    const half = Math.sqrt(Math.max(0, boundary.r * boundary.r - offset * offset));
    if (Math.abs(offset) > boundary.r) return [];
    const center = direction === 'warp' ? boundary.cy : boundary.cx;
    return half === 0 ? [center] : [center - half, center + half];
  }
  if (boundary.type === 'ellipse') {
    const normalized = direction === 'warp'
      ? (axisMm - boundary.cx) / boundary.rx
      : (axisMm - boundary.cy) / boundary.ry;
    if (Math.abs(normalized) > 1) return [];
    const half = (direction === 'warp' ? boundary.ry : boundary.rx) * Math.sqrt(Math.max(0, 1 - normalized * normalized));
    const center = direction === 'warp' ? boundary.cy : boundary.cx;
    return half === 0 ? [center] : [center - half, center + half];
  }
  const values: number[] = [];
  for (let index = 0; index < boundary.pointsMm.length; index += 1) {
    const a = boundary.pointsMm[index];
    const b = boundary.pointsMm[(index + 1) % boundary.pointsMm.length];
    const fixedA = direction === 'warp' ? a[0] : a[1];
    const fixedB = direction === 'warp' ? b[0] : b[1];
    if (Math.abs(fixedA - fixedB) < 1e-9) {
      if (Math.abs(axisMm - fixedA) < .01) values.push(direction === 'warp' ? a[1] : a[0], direction === 'warp' ? b[1] : b[0]);
      continue;
    }
    const ratio = (axisMm - fixedA) / (fixedB - fixedA);
    if (ratio >= 0 && ratio <= 1) values.push((direction === 'warp' ? a[1] : a[0]) + ratio * ((direction === 'warp' ? b[1] : b[0]) - (direction === 'warp' ? a[1] : a[0])));
  }
  return values;
}

function uniqueSorted(values: number[]) {
  return values.sort((a, b) => a - b).filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]) > .01);
}

function visibleIntervals(direction: Direction, axisMm: number, raw: Rect, boundary: Boundary) {
  const minimum = direction === 'warp' ? raw.y : raw.x;
  const maximum = minimum + (direction === 'warp' ? raw.height : raw.width);
  const cuts = uniqueSorted([minimum, maximum, ...lineBoundaryCoordinates(direction, axisMm, boundary).filter(value => value >= minimum - .01 && value <= maximum + .01)]);
  const intervals: { start: number; end: number }[] = [];
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const start = Math.max(minimum, cuts[index]);
    const end = Math.min(maximum, cuts[index + 1]);
    if (end - start <= .01) continue;
    const middle = (start + end) / 2;
    const point = direction === 'warp' ? { x: axisMm, y: middle } : { x: middle, y: axisMm };
    if (pointInBoundary(point, boundary)) intervals.push({ start, end });
  }
  return intervals;
}

function rotateScale(point: PointMm, pattern: SurfacePattern): PointMm {
  const center = { x: pattern.coordinateSpace.width / 2, y: 110 };
  const { scale, rotationDeg, offsetMm } = pattern.transform;
  const angle = rotationDeg * Math.PI / 180;
  const x = (point.x - center.x) * scale;
  const y = (point.y - center.y) * scale;
  return {
    x: center.x + x * Math.cos(angle) - y * Math.sin(angle) + offsetMm.x,
    y: center.y + x * Math.sin(angle) + y * Math.cos(angle) + offsetMm.y,
  };
}

function motifAt(pattern: SurfacePattern, point: PointMm) {
  const palette = new Map(pattern.palette.map(entry => [entry.paletteId, entry.color]));
  const element = [...pattern.elements].sort((a, b) => b.zIndex - a.zIndex)
    .find(entry => entry.kind === 'polygon' && pointInPolygon(point, entry.pointsMm.map(value => {
      const transformed = rotateScale(value, pattern);
      return [transformed.x, transformed.y];
    })));
  return element ? { color: palette.get(element.paletteId) ?? '#315F3A', paletteId: element.paletteId, sourceElementId: element.elementId, sourceInputId: element.sourceInputId } : null;
}

function colorSegments(direction: Direction, axisMm: number, startCoordinate: number, endCoordinate: number,
  rawStart: number, effective: Boundary, pattern: SurfacePattern, baseColor: string): ColorSegmentV03[] {
  const step = .5;
  const result: ColorSegmentV03[] = [];
  for (let coordinate = startCoordinate; coordinate < endCoordinate - 1e-9;) {
    const next = Math.min(endCoordinate, coordinate + step);
    const middle = (coordinate + next) / 2;
    const point = direction === 'warp' ? { x: axisMm, y: middle } : { x: middle, y: axisMm };
    const inEffective = pointInBoundary(point, effective);
    const motif = inEffective ? motifAt(pattern, point) : null;
    const value: Omit<ColorSegmentV03, 'stripOffsetStartMm' | 'stripOffsetEndMm'> = motif
      ? { scope: 'motif', color: motif.color, paletteId: motif.paletteId, sourceElementId: motif.sourceElementId, sourceInputId: motif.sourceInputId }
      : { scope: inEffective ? 'base' : 'outer-base', color: baseColor, paletteId: null, sourceElementId: null, sourceInputId: null };
    const offsetStart = coordinate - rawStart;
    const offsetEnd = next - rawStart;
    const previous = result.at(-1);
    if (previous && previous.scope === value.scope && previous.color === value.color && previous.sourceElementId === value.sourceElementId) {
      previous.stripOffsetEndMm = round(offsetEnd);
    } else {
      result.push({ stripOffsetStartMm: round(offsetStart), stripOffsetEndMm: round(offsetEnd), ...value });
    }
    coordinate = next;
  }
  return result;
}

function buildStrip(direction: Direction, order: number, axisMm: number, widthMm: number, pitchMm: number,
  raw: Rect, boundary: Boundary, effective: Boundary, pattern: SurfacePattern, baseColor: string): StripV03 {
  const stripId = `${direction === 'warp' ? 'V' : 'H'}${pad(order)}`;
  const rawStartCoordinate = direction === 'warp' ? raw.y : raw.x;
  const rawEndCoordinate = rawStartCoordinate + (direction === 'warp' ? raw.height : raw.width);
  const rawStart = direction === 'warp' ? { x: axisMm, y: rawStartCoordinate } : { x: rawStartCoordinate, y: axisMm };
  const rawEnd = direction === 'warp' ? { x: axisMm, y: rawEndCoordinate } : { x: rawEndCoordinate, y: axisMm };
  const visibleSegments: VisibleSegmentV03[] = visibleIntervals(direction, axisMm, raw, boundary).map((interval, index) => {
    const startMm = direction === 'warp' ? { x: axisMm, y: interval.start } : { x: interval.start, y: axisMm };
    const endMm = direction === 'warp' ? { x: axisMm, y: interval.end } : { x: interval.end, y: axisMm };
    return {
      segmentId: `${stripId}-S${String(index + 1).padStart(2, '0')}`,
      ordinal: index + 1,
      startMm: { x: round(startMm.x), y: round(startMm.y) },
      endMm: { x: round(endMm.x), y: round(endMm.y) },
      stripOffsetStartMm: round(interval.start - rawStartCoordinate),
      stripOffsetEndMm: round(interval.end - rawStartCoordinate),
      lengthMm: round(interval.end - interval.start),
      crossingIds: [],
      colorSegments: colorSegments(direction, axisMm, interval.start, interval.end, rawStartCoordinate, effective, pattern, baseColor),
    };
  });
  return {
    stripId, direction, order, axisMm: round(axisMm), widthMm, thicknessMm: .5, pitchMm,
    rawBlankSegment: { startMm: rawStart, endMm: rawEnd, lengthMm: round(mmDistance(rawStart, rawEnd)) },
    visibleSegments,
    stockLengthMm: null,
    rawBlankLengthMm: round(mmDistance(rawStart, rawEnd)),
    visibleLengthMm: round(visibleSegments.reduce((sum, segment) => sum + segment.lengthMm, 0)),
    setupAllowanceMm: null,
    trimWasteLengthMm: null,
  };
}

function segmentAt(strip: StripV03, point: PointMm) {
  const coordinate = strip.direction === 'warp' ? point.y : point.x;
  const rawStart = strip.direction === 'warp' ? strip.rawBlankSegment.startMm.y : strip.rawBlankSegment.startMm.x;
  const offset = coordinate - rawStart;
  return strip.visibleSegments.find((segment, index, all) => offset >= segment.stripOffsetStartMm - .01
    && (offset < segment.stripOffsetEndMm - .01 || (index === all.length - 1 && offset <= segment.stripOffsetEndMm + .01)));
}

function warningForHandle(input: StructureV03Input, carrier: CarrierSpec, crossings: CrossingV03[]): EngineeringWarningV03[] {
  if (input.carrierId !== 'FAN-ROUND-170-V1') return [];
  const zone = carrier.handleExclusion;
  const affected = crossings.filter(value => value.positionMm.x >= zone.xMin && value.positionMm.x <= zone.xMax
    && value.positionMm.y >= zone.yMin && value.positionMm.y <= zone.yMax).map(value => value.crossingId);
  return [{
    warningId: 'WARN-ROUND-HANDLE-REINFORCEMENT', code: 'HANDLE_REINFORCEMENT_REQUIRED', status: 'pending', severity: 'review',
    carrierId: input.carrierId, weaveId: input.weaveId, stripId: null, segmentId: null, crossingIds: affected,
    positionMm: { x: (zone.xMin + zone.xMax) / 2, y: (zone.yMin + zone.yMax) / 2 }, measurement: null,
    ruleSource: 'CARRIER-SPEC-v1.2.carriers[FAN-ROUND-170-V1].handleExclusion@ROUND-HANDLE-v1.1',
    message: '手柄区保留基础竹编，图样需避让且连接区域需人工复核加固。',
  }];
}

function edgeWarnings(input: StructureV03Input, strips: StripV03[], pitchMm: number): EngineeringWarningV03[] {
  const warnings: EngineeringWarningV03[] = [];
  for (const strip of strips) for (const segment of strip.visibleSegments) {
    if (segment.lengthMm < pitchMm * 2) warnings.push({
      warningId: `WARN-${segment.segmentId}-SHORT`, code: 'SHORT_VISIBLE_SEGMENT', status: 'pending', severity: 'review',
      carrierId: input.carrierId, weaveId: input.weaveId, stripId: strip.stripId, segmentId: segment.segmentId,
      crossingIds: segment.crossingIds, positionMm: segment.startMm,
      measurement: { measuredValue: segment.lengthMm, referenceValue: round(pitchMm * 2), operator: '<', unit: 'mm' },
      ruleSource: 'WEAVE-SPEC-v1.2.edgeAcceptanceRules.shortStrip', message: '可见段短于2倍节距，需人工检查加固。',
    });
  }
  if (input.weaveId === 'SQUARE-HOLE-1X1-V1') {
    const strip = strips.find(value => value.visibleSegments.length > 0) ?? null;
    const segment = strip?.visibleSegments[0] ?? null;
    warnings.push({
      warningId: 'WARN-OPEN-HALF-HOLE-EDGE', code: 'OPEN_HALF_HOLE_AT_EDGE', status: 'pending', severity: 'review',
      carrierId: input.carrierId, weaveId: input.weaveId, stripId: strip?.stripId ?? null, segmentId: segment?.segmentId ?? null,
      crossingIds: segment?.crossingIds ?? [], positionMm: segment?.startMm ?? null, measurement: null,
      ruleSource: 'WEAVE-SPEC-v1.2.edgeAcceptanceRules.squareHole', message: '开放网格边缘可能形成半孔，需人工检查收边固定。',
    });
  }
  if (input.carrierId === 'FAN-OCTAGON-170-V1') warnings.push({
    warningId: 'WARN-OCTAGON-CORNER', code: 'CORNER_REINFORCEMENT_REQUIRED', status: 'pending', severity: 'review',
    carrierId: input.carrierId, weaveId: input.weaveId, stripId: null, segmentId: null, crossingIds: [], positionMm: { x: 70, y: 25 }, measurement: null,
    ruleSource: 'WEAVE-SPEC-v1.2.edgeAcceptanceRules.corner', message: '八角转角一条宽度范围内的竹条需人工复核加固。',
  });
  return warnings;
}

export function calculateStructureV03(input: StructureV03Input): StructureSnapshotV03 {
  const carrier = carrierById(input.carrierId);
  const weave = weaveById(input.weaveId);
  const open = weave.gridType === 'orthogonal-open';
  const count = open ? 13 : 21;
  const widthMm = open ? 9 : 9;
  const pitchMm = open ? 15 : 9;
  const clearHoleMm = open ? 6 : 0;
  const raw = carrier.rawBlankBoundary;
  const firstWarp = raw.x + widthMm / 2;
  const firstWeft = raw.y + widthMm / 2;
  const warps = Array.from({ length: count }, (_, index) => buildStrip('warp', index + 1, firstWarp + index * pitchMm,
    widthMm, pitchMm, raw, carrier.boundary, carrier.effectivePatternBoundary, input.pattern, input.baseColor));
  const wefts = Array.from({ length: count }, (_, index) => buildStrip('weft', index + 1, firstWeft + index * pitchMm,
    widthMm, pitchMm, raw, carrier.boundary, carrier.effectivePatternBoundary, input.pattern, input.baseColor));
  const strips = [...warps, ...wefts];
  const crossings: CrossingV03[] = [];
  const weavingOrder: WeavingOperationV03[] = [];
  for (const weft of wefts) for (const warp of warps) {
    const positionMm = { x: warp.axisMm, y: weft.axisMm };
    const crossingId = `X-${warp.stripId}-${weft.stripId}`;
    const warpSegment = segmentAt(warp, positionMm) ?? null;
    const weftSegment = segmentAt(weft, positionMm) ?? null;
    const visible = Boolean(warpSegment && weftSegment && pointInBoundary(positionMm, carrier.boundary));
    if (visible) {
      warpSegment?.crossingIds.push(crossingId);
      weftSegment?.crossingIds.push(crossingId);
    }
    const matrixValue = weave.topLayerMatrix[weft.order % weave.topLayerMatrix.length === 0 ? weave.topLayerMatrix.length - 1 : (weft.order - 1) % weave.topLayerMatrix.length]
      [(warp.order - 1) % weave.topLayerMatrix[0].length];
    const topStripId = matrixValue === 'W' ? weft.stripId : warp.stripId;
    crossings.push({ crossingId, warpStripId: warp.stripId, warpSegmentId: visible ? warpSegment?.segmentId ?? null : null,
      weftStripId: weft.stripId, weftSegmentId: visible ? weftSegment?.segmentId ?? null : null, positionMm, topStripId, rawBlank: true,
      trimmedProduct: { visible } });
    weavingOrder.push({
      step: weft.order, operationId: `OP-${weft.stripId}-${String(warp.order).padStart(3, '0')}`,
      workingStripId: weft.stripId, workingDirection: 'weft', crossingSequence: warp.order, crossingId,
      referenceStripId: warp.stripId, action: topStripId === weft.stripId ? 'over' : 'under', positionMm,
      trimmedProduct: {
        visible,
        workingSegmentId: visible ? weftSegment?.segmentId ?? null : null,
        referenceSegmentId: visible ? warpSegment?.segmentId ?? null : null,
      },
    });
  }
  const warnings = [...warningForHandle(input, carrier, crossings), ...edgeWarnings(input, strips, pitchMm)];
  const sourceKey = {
    schemaVersion: '0.3' as const, structureGeneratorVersion: 'D-STRUCTURE-v0.3.1' as const,
    designId: input.designId, generatedFromRevision: input.designRevision, carrierId: input.carrierId,
    carrierSpecVersion: 'CARRIER-SPEC-v1.2' as const, weaveId: input.weaveId,
    weaveSpecVersion: 'WEAVE-SPEC-v1.2' as const, craftRuleVersion: weave.craftRuleVersion,
  };
  return {
    ...sourceKey, confirmedGenerationId: input.confirmedGenerationId, validationStatus: 'pending', physicalValidation: 'not-completed', sourceKey,
    sourcePattern: input.pattern, coordinateSpace: { widthMm: 210, heightMm: 297, origin: 'top-left', xAxis: 'right', yAxis: 'down' },
    carrierGeometry: { boundary: carrier.boundary, effectivePatternBoundary: carrier.effectivePatternBoundary, handleExclusion: carrier.handleExclusion },
    outerBaseWeaveZone: {
      operation: 'boundary-minus-effectivePatternBoundary', baseWeaveRequired: true,
      carrierBoundaryRef: { carrierId: input.carrierId, carrierSpecVersion: 'CARRIER-SPEC-v1.2', field: 'boundary' },
      effectivePatternBoundaryRef: { carrierId: input.carrierId, carrierSpecVersion: 'CARRIER-SPEC-v1.2', field: 'effectivePatternBoundary' },
      continuity: { preserveStripId: true, preserveOrder: true, preserveDirection: true, preservePitch: true,
        preserveWidth: true, preserveThickness: true, preserveCrossingPhase: true, preserveWeavingOrder: true },
    },
    grid: { warpCount: count, weftCount: count, pitchMm, stripWidthMm: widthMm, clearHoleMm },
    stages: {
      rawBlank: { boundary: raw, strips, crossings, weavingOrder },
      trimmedProduct: { boundary: carrier.boundary, effectivePatternBoundary: carrier.effectivePatternBoundary, strips,
        visibleCrossingIds: crossings.filter(value => value.trimmedProduct.visible).map(value => value.crossingId) },
    },
    engineeringWarnings: warnings,
    materialAccounting: { identityKey: 'stripId', countRule: 'count-each-stripId-once',
      lengthSourcePriority: ['stockLengthMm', 'verifiedAllowanceFormula'], fallbackStatus: 'pending',
      forbiddenLengthSources: ['rawBlankSegment.lengthMm', 'visibleLengthMm'] },
  };
}
