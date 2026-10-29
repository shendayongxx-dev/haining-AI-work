import type { Crossing, FanStructureInput, PointMm, Strip, StructureSnapshot, SurfacePattern } from './types';

const DEMO_LABEL = '演示数据，待 B 验证' as const;
const WIDTH_MM = 260;
const HEIGHT_MM = 150;
const APEX: PointMm = { x: 130, y: 0 };
const LEFT: PointMm = { x: 8, y: 145 };
const RIGHT: PointMm = { x: 252, y: 145 };

const round = (value: number) => Math.round(value * 100) / 100;
const pad = (value: number) => String(value).padStart(3, '0');

function rotateScale(point: PointMm, pattern: SurfacePattern): PointMm {
  const { scale, rotationDeg, translateMm } = pattern.transform;
  const angle = rotationDeg * Math.PI / 180;
  const cx = WIDTH_MM / 2;
  const cy = HEIGHT_MM / 2;
  const x = (point.x - cx) * scale;
  const y = (point.y - cy) * scale;
  return {
    x: cx + x * Math.cos(angle) - y * Math.sin(angle) + translateMm.x,
    y: cy + x * Math.sin(angle) + y * Math.cos(angle) + translateMm.y,
  };
}

function pointInPolygon(point: PointMm, polygon: PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function insideFan(point: PointMm): boolean {
  const side = (a: PointMm, b: PointMm, p: PointMm) =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return point.y >= 0 && point.y <= 145
    && side(APEX, LEFT, point) <= 0
    && side(RIGHT, APEX, point) <= 0;
}

function samplePattern(pattern: SurfacePattern, point: PointMm) {
  const palette = new Map(pattern.palette.map(entry => [entry.paletteId, entry.color]));
  const base = pattern.palette.find(entry => entry.role === 'base') ?? pattern.palette[0];
  const hit = [...pattern.elements]
    .sort((a, b) => b.zIndex - a.zIndex || a.elementId.localeCompare(b.elementId))
    .find(element => element.kind === 'polygon'
      && pointInPolygon(point, element.pointsMm.map(value => rotateScale(value, pattern))));
  const paletteId = hit?.paletteId ?? base?.paletteId ?? 'base';
  return { paletteId, color: palette.get(paletteId) ?? '#ead8b5', sourceElementId: hit?.elementId };
}

function buildStrip(direction: 'warp' | 'weft', index: number, axisMm: number, widthMm: number,
  spacingMm: number, pattern: SurfacePattern): Strip | null {
  const samples: { position: number; paletteId: string; color: string; sourceElementId?: string }[] = [];
  const limit = direction === 'warp' ? HEIGHT_MM : WIDTH_MM;
  for (let position = 0; position <= limit; position += spacingMm) {
    const point = direction === 'warp' ? { x: axisMm, y: position } : { x: position, y: axisMm };
    if (insideFan(point)) samples.push({ position, ...samplePattern(pattern, point) });
  }
  if (!samples.length) return null;
  const colorSegments: Strip['colorSegments'] = [];
  for (const sample of samples) {
    const last = colorSegments.at(-1);
    if (last && last.paletteId === sample.paletteId && last.sourceElementId === sample.sourceElementId) {
      last.toMm = round(sample.position + spacingMm / 2);
    } else {
      colorSegments.push({
        fromMm: round(Math.max(0, sample.position - spacingMm / 2)),
        toMm: round(sample.position + spacingMm / 2),
        paletteId: sample.paletteId,
        color: sample.color,
        sourceElementId: sample.sourceElementId,
      });
    }
  }
  const prefix = direction === 'warp' ? 'J' : 'W';
  return {
    id: `${prefix}-${pad(index + 1)}`,
    direction,
    index,
    axisMm: round(axisMm),
    widthMm,
    geometryLengthMm: round(samples.at(-1)!.position - samples[0].position),
    colorSegments,
  };
}

export function calculateFanStructure(input: FanStructureInput): StructureSnapshot {
  const count = Math.max(2, Math.round(input.parameters.density));
  const spacingMm = WIDTH_MM / (count - 1);
  const warps = Array.from({ length: count }, (_, index) =>
    buildStrip('warp', index, index * spacingMm, input.parameters.stripWidthMm, spacingMm, input.pattern))
    .filter((strip): strip is Strip => Boolean(strip));
  const wefts = Array.from({ length: count }, (_, index) =>
    buildStrip('weft', index, index * HEIGHT_MM / (count - 1), input.parameters.stripWidthMm,
      HEIGHT_MM / (count - 1), input.pattern))
    .filter((strip): strip is Strip => Boolean(strip));
  const crossings: Crossing[] = [];
  for (const warp of warps) for (const weft of wefts) {
    const positionMm = { x: warp.axisMm, y: weft.axisMm };
    if (!insideFan(positionMm)) continue;
    crossings.push({
      id: `X-${warp.id}-${weft.id}`,
      warpId: warp.id,
      weftId: weft.id,
      warpIndex: warp.index,
      weftIndex: weft.index,
      positionMm,
      top: (warp.index + weft.index) % 2 === 0 ? 'weft' : 'warp',
      ruleVerification: 'pending',
    });
  }
  return {
    schemaVersion: input.schemaVersion,
    designId: input.designId,
    designRevision: input.designRevision,
    generatedFromRevision: input.designRevision,
    confirmedGenerationId: input.confirmedGenerationId,
    status: { usage: 'demo', label: DEMO_LABEL },
    carrier: { type: 'fan', unit: 'mm', boundaryId: 'DEMO_FAN_BOUNDARY_V0.1', widthMm: WIDTH_MM, heightMm: HEIGHT_MM },
    activeArea: { type: 'polygon', pointsMm: [APEX, RIGHT, LEFT] },
    weave: { id: 'plain-demo', rule: 'over-under-1-1', verified: false },
    parameters: input.parameters,
    grid: { spacingMm: round(spacingMm), warpCount: warps.length, weftCount: wefts.length },
    strips: { list: [...warps, ...wefts] },
    interlace: { crossings },
    viewTransform: { mmToSvg: 2, originSvg: { x: 0, y: 0 }, xDirection: 'right', yDirection: 'down' },
    validation: { status: 'pending', pendingReason: '演示载体、竹条规格和编法规则尚待 B 提供依据并验证' },
  };
}
