import type { Crossing, FanStructureInput, PointMm, Strip, StructureSnapshot, SurfacePattern } from './types';

const DEMO_LABEL = '演示数据，待 B 验证' as const;
const WIDTH_MM = 210;
const HEIGHT_MM = 297;
const ACTIVE_AREA: PointMm[] = [
  { x: 0, y: 0 }, { x: WIDTH_MM, y: 0 },
  { x: WIDTH_MM, y: HEIGHT_MM }, { x: 0, y: HEIGHT_MM },
];

const round = (value: number) => Math.round(value * 100) / 100;
const pad = (value: number) => String(value).padStart(3, '0');

function rotateScale(point: PointMm, pattern: SurfacePattern): PointMm {
  const { scale, rotationDeg, offsetMm } = pattern.transform;
  const angle = rotationDeg * Math.PI / 180;
  const cx = WIDTH_MM / 2;
  const cy = HEIGHT_MM / 2;
  const x = (point.x - cx) * scale;
  const y = (point.y - cy) * scale;
  return {
    x: cx + x * Math.cos(angle) - y * Math.sin(angle) + offsetMm.x,
    y: cy + x * Math.sin(angle) + y * Math.cos(angle) + offsetMm.y,
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
  return point.x >= 0 && point.x <= WIDTH_MM && point.y >= 0 && point.y <= HEIGHT_MM;
}

function samplePattern(pattern: SurfacePattern, point: PointMm, baseColor: string) {
  const palette = new Map(pattern.palette.map(entry => [entry.paletteId, entry.color]));
  const hit = [...pattern.elements]
    .sort((a, b) => b.zIndex - a.zIndex || a.elementId.localeCompare(b.elementId))
    .find(element => element.kind === 'polygon'
      && pointInPolygon(point, element.pointsMm.map(value => rotateScale(value, pattern))));
  if (!hit) return { paletteId: 'd-base', color: baseColor, sourceElementId: undefined };
  return { paletteId: hit.paletteId, color: palette.get(hit.paletteId) ?? baseColor, sourceElementId: hit.elementId };
}

function buildStrip(direction: 'warp' | 'weft', index: number, axisMm: number, widthMm: number,
  spacingMm: number, pattern: SurfacePattern, baseColor: string): Strip | null {
  const samples: { position: number; paletteId: string; color: string; sourceElementId?: string }[] = [];
  const limit = direction === 'warp' ? HEIGHT_MM : WIDTH_MM;
  for (let position = 0; position <= limit; position += spacingMm) {
    const point = direction === 'warp' ? { x: axisMm, y: position } : { x: position, y: axisMm };
    if (insideFan(point)) samples.push({ position, ...samplePattern(pattern, point, baseColor) });
  }
  if (!samples.length) return null;
  const colorSegments: Strip['colorSegments'] = [];
  for (const sample of samples) {
    const last = colorSegments.at(-1);
    if (last && last.paletteId === sample.paletteId && last.sourceElementId === sample.sourceElementId) {
      last.toMm = round(Math.min(limit, sample.position + spacingMm / 2));
    } else {
      colorSegments.push({
        fromMm: round(Math.max(0, sample.position - spacingMm / 2)),
        toMm: round(Math.min(limit, sample.position + spacingMm / 2)),
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
  const warpSpacingMm = WIDTH_MM / (count - 1);
  const weftSpacingMm = HEIGHT_MM / (count - 1);
  const warps = Array.from({ length: count }, (_, index) =>
    buildStrip('warp', index, index * warpSpacingMm, input.parameters.stripWidthMm,
      weftSpacingMm, input.pattern, input.parameters.baseColor))
    .filter((strip): strip is Strip => Boolean(strip));
  const wefts = Array.from({ length: count }, (_, index) =>
    buildStrip('weft', index, index * weftSpacingMm, input.parameters.stripWidthMm,
      warpSpacingMm, input.pattern, input.parameters.baseColor))
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
    carrier: {
      type: 'fan', unit: 'mm', boundaryId: 'A4-PAGE-DEMO', widthMm: WIDTH_MM,
      heightMm: HEIGHT_MM, boundaryVerification: 'pending',
    },
    activeArea: { type: 'polygon', pointsMm: ACTIVE_AREA },
    weave: { id: 'plain-demo', rule: 'over-under-1-1', verified: false },
    parameters: input.parameters,
    grid: {
      warpSpacingMm: round(warpSpacingMm), weftSpacingMm: round(weftSpacingMm),
      warpCount: warps.length, weftCount: wefts.length,
    },
    strips: { list: [...warps, ...wefts] },
    interlace: { crossings },
    viewTransform: { mmToSvg: 2, originSvg: { x: 0, y: 0 }, xDirection: 'right', yDirection: 'down' },
    validation: {
      source: 'd-initial',
      designId: input.designId,
      generatedFromRevision: input.designRevision,
      status: 'pending',
      pendingReason: '当前仅使用 A4 页面演示包络；正式扇面边界、竹条规格和编法规则尚待 B 验证',
    },
  };
}
