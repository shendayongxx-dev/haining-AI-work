import type { Crossing, FanStructureInput, PointMm, Strip, StructureSnapshot, SurfacePattern } from './types';
import { B_V03_CARRIER_RULE, B_V03_WEAVE_RULE } from './craftRules';

const DEMO_LABEL = '圆扇结构演示，工艺 pending' as const;
const WIDTH_MM = 210;
const HEIGHT_MM = 297;

const round = (value: number) => Math.round(value * 100) / 100;
const pad = (value: number) => String(value).padStart(3, '0');

function rotateScale(point: PointMm, pattern: SurfacePattern, center: PointMm): PointMm {
  const { scale, rotationDeg, offsetMm } = pattern.transform;
  const angle = rotationDeg * Math.PI / 180;
  const cx = center.x;
  const cy = center.y;
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

function samplePattern(pattern: SurfacePattern, point: PointMm, baseColor: string, center: PointMm) {
  const palette = new Map(pattern.palette.map(entry => [entry.paletteId, entry.color]));
  const hit = [...pattern.elements]
    .sort((a, b) => b.zIndex - a.zIndex || a.elementId.localeCompare(b.elementId))
    .find(element => element.kind === 'polygon'
      && pointInPolygon(point, element.pointsMm.map(value => rotateScale(value, pattern, center))));
  if (!hit) return { paletteId: 'd-base', color: baseColor, sourceElementId: undefined, sourceInputId: undefined };
  return {
    paletteId: hit.paletteId,
    color: palette.get(hit.paletteId) ?? baseColor,
    sourceElementId: hit.elementId,
    sourceInputId: hit.sourceInputId,
  };
}

function buildStrip(direction: 'warp' | 'weft', index: number, axisMm: number, widthMm: number,
  spacingMm: number, pattern: SurfacePattern, baseColor: string, center: PointMm, radiusMm: number): Strip {
  const offset = axisMm - (direction === 'warp' ? center.x : center.y);
  const halfChord = Math.sqrt(Math.max(0, radiusMm * radiusMm - offset * offset));
  const startMm = direction === 'warp'
    ? { x: axisMm, y: center.y - halfChord }
    : { x: center.x - halfChord, y: axisMm };
  const endMm = direction === 'warp'
    ? { x: axisMm, y: center.y + halfChord }
    : { x: center.x + halfChord, y: axisMm };
  const limit = halfChord * 2;
  const samplePositions = Array.from({ length: Math.ceil(limit / spacingMm) + 1 }, (_, sampleIndex) =>
    Math.min(limit, sampleIndex * spacingMm));
  const samples = samplePositions.map(position => {
    const point = direction === 'warp'
      ? { x: axisMm, y: startMm.y + position }
      : { x: startMm.x + position, y: axisMm };
    return { position, ...samplePattern(pattern, point, baseColor, center) };
  });
  const colorSegments: Strip['colorSegments'] = [];
  for (const sample of samples) {
    const last = colorSegments.at(-1);
    if (last && last.paletteId === sample.paletteId && last.sourceElementId === sample.sourceElementId
      && last.sourceInputId === sample.sourceInputId) {
      last.toMm = round(Math.min(limit, sample.position + spacingMm / 2));
    } else {
      colorSegments.push({
        fromMm: round(Math.max(0, sample.position - spacingMm / 2)),
        toMm: round(Math.min(limit, sample.position + spacingMm / 2)),
        paletteId: sample.paletteId,
        color: sample.color,
        sourceElementId: sample.sourceElementId,
        sourceInputId: sample.sourceInputId,
      });
    }
  }
  const prefix = direction === 'warp' ? 'V' : 'H';
  return {
    id: `${prefix}${pad(index + 1)}`,
    direction,
    index,
    axisMm: round(axisMm),
    widthMm,
    startMm: { x: round(startMm.x), y: round(startMm.y) },
    endMm: { x: round(endMm.x), y: round(endMm.y) },
    geometryLengthMm: round(limit),
    colorSegments,
  };
}

export function calculateFanStructure(input: FanStructureInput): StructureSnapshot {
  const count = Math.max(2, Math.round(input.parameters.density));
  const { centerMm, radiusMm } = input.carrier;
  // CROSS-1X1-V1 联调采用圆内接正方形的 21×21 轴线，确保全部 441 个交点位于圆内。
  const gridHalfSpan = radiusMm / Math.sqrt(2);
  const warpSpacingMm = gridHalfSpan * 2 / (count - 1);
  const weftSpacingMm = warpSpacingMm;
  const warps = Array.from({ length: count }, (_, index) =>
    buildStrip('warp', index, centerMm.x - gridHalfSpan + index * warpSpacingMm,
      input.parameters.stripWidthMm, weftSpacingMm, input.pattern, input.parameters.baseColor, centerMm, radiusMm));
  const wefts = Array.from({ length: count }, (_, index) =>
    buildStrip('weft', index, centerMm.y - gridHalfSpan + index * weftSpacingMm,
      input.parameters.stripWidthMm, warpSpacingMm, input.pattern, input.parameters.baseColor, centerMm, radiusMm));
  const crossings: Crossing[] = [];
  for (const warp of warps) for (const weft of wefts) {
    const positionMm = { x: warp.axisMm, y: weft.axisMm };
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
    sourcePattern: {
      patternId: input.pattern.patternId,
      coordinateSpace: input.pattern.coordinateSpace,
      palette: input.pattern.palette,
      elements: input.pattern.elements,
      transform: input.pattern.transform,
      generationIssues: input.generationIssues,
    },
    status: { usage: 'demo', label: DEMO_LABEL },
    carrier: {
      type: 'fan', unit: 'mm', carrierId: input.carrier.id, boundaryId: input.carrier.boundaryId,
      effectivePatternBoundaryId: input.carrier.effectivePatternBoundaryId,
      widthMm: WIDTH_MM, heightMm: HEIGHT_MM, boundaryVerification: 'provided-by-b',
    },
    activeArea: { type: 'circle', centerMm, radiusMm },
    weave: { id: 'CROSS-1X1-V1', rule: 'over-under-1-1', verified: false },
    craftComparison: {
      status: 'pending',
      conformance: 'nonconforming-demo',
      geometryStage: 'trimmed-circle-demo',
      ruleSources: [
        'docs/CRAFT_RULES.md', 'docs/FORMAL_CARRIER_SPEC.md',
        'data/CROSS_WEAVE_V1.json', 'data/FORMAL_CARRIER_ROUND_170.json',
      ],
      current: {
        warpCount: count,
        weftCount: count,
        stripWidthMm: input.parameters.stripWidthMm,
        thicknessMm: null,
        stockLengthMm: null,
      },
      required: {
        warpCount: B_V03_WEAVE_RULE.warp.count,
        weftCount: B_V03_WEAVE_RULE.weft.count,
        stripWidthMm: B_V03_WEAVE_RULE.stripSpec.widthMm,
        stripWidthToleranceMm: B_V03_WEAVE_RULE.stripSpec.widthToleranceMm,
        thicknessMm: B_V03_WEAVE_RULE.stripSpec.thicknessMm,
        thicknessToleranceMm: B_V03_WEAVE_RULE.stripSpec.thicknessToleranceMm,
        stockLengthMm: B_V03_WEAVE_RULE.stripSpec.stockLengthMm,
        rawBlankBboxMm: B_V03_CARRIER_RULE.rawWeaveBlank.bboxMm,
      },
      differences: [
        ...(count === B_V03_WEAVE_RULE.warp.count && count === B_V03_WEAVE_RULE.weft.count ? [] : [{
          code: 'STRIP_COUNT_NONCONFORMING',
          message: `当前演示为 ${count} 经×${count} 纬；B v0.3 固定要求 21 经×21 纬。`,
        }]),
        {
          code: 'STRIP_WIDTH_NONCONFORMING',
          message: `当前演示宽度 ${input.parameters.stripWidthMm} mm；B v0.3 要求 9±0.5 mm。`,
        },
        { code: 'STRIP_THICKNESS_MISSING', message: '当前快照未采集厚度；B v0.3 要求 0.5±0.1 mm。' },
        { code: 'STOCK_LENGTH_MISSING', message: '当前快照未采集备料长度；B v0.3 要求 280–300 mm。' },
        {
          code: 'RAW_BLANK_NOT_MODELLED',
          message: '当前仅建模裁剪后的圆形演示结构，尚未建模 189×189 mm 毛坯及圆外交点。',
        },
      ],
    },
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
      pendingReason: '已读取 B 的正式圆扇边界与 CROSS-1X1-V1 标识；竹条参数和实际制作仍待完整规则及试编验证',
    },
  };
}
