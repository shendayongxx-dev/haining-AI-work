import type { Crossing, FanStructureInput, PointMm, RawBlankStrip, Strip, StructureSnapshot, SurfacePattern, WeavingStep } from './types';
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
  // 网格间距决定竹条排布，但图样颜色必须以更细的毫米步长采样，
  // 否则 9 mm 正式竹条会把边缘简化成大色块。
  const sampleStepMm = Math.min(1, spacingMm);
  const samplePositions = Array.from({ length: Math.ceil(limit / sampleStepMm) + 1 }, (_, sampleIndex) =>
    Math.min(limit, sampleIndex * sampleStepMm));
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
      last.toMm = round(Math.min(limit, sample.position + sampleStepMm / 2));
    } else {
      colorSegments.push({
        fromMm: round(Math.max(0, sample.position - sampleStepMm / 2)),
        toMm: round(Math.min(limit, sample.position + sampleStepMm / 2)),
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
  const rawBlank = B_V03_CARRIER_RULE.rawWeaveBlank.bboxMm;
  const warpSpacingMm = rawBlank.width / count;
  const weftSpacingMm = rawBlank.height / count;
  const warpAxis = (index: number) => rawBlank.x + warpSpacingMm * (index + .5);
  const weftAxis = (index: number) => rawBlank.y + weftSpacingMm * (index + .5);
  const warps = Array.from({ length: count }, (_, index) =>
    buildStrip('warp', index, warpAxis(index),
      input.parameters.stripWidthMm, weftSpacingMm, input.pattern, input.parameters.baseColor, centerMm, radiusMm));
  const wefts = Array.from({ length: count }, (_, index) =>
    buildStrip('weft', index, weftAxis(index),
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
  const stockLengthMm = B_V03_WEAVE_RULE.stripSpec.stockLengthMm;
  const rawBlankStrips: RawBlankStrip[] = [
    ...Array.from({ length: count }, (_, index) => ({
      id: `V${pad(index + 1)}`, direction: 'warp' as const, index, axisMm: round(warpAxis(index)),
      widthMm: input.parameters.stripWidthMm,
      startMm: { x: round(warpAxis(index)), y: rawBlank.y },
      endMm: { x: round(warpAxis(index)), y: rawBlank.y + rawBlank.height },
      geometryLengthMm: rawBlank.height, stockLengthMm,
    })),
    ...Array.from({ length: count }, (_, index) => ({
      id: `H${pad(index + 1)}`, direction: 'weft' as const, index, axisMm: round(weftAxis(index)),
      widthMm: input.parameters.stripWidthMm,
      startMm: { x: rawBlank.x, y: round(weftAxis(index)) },
      endMm: { x: rawBlank.x + rawBlank.width, y: round(weftAxis(index)) },
      geometryLengthMm: rawBlank.width, stockLengthMm,
    })),
  ];
  const weavingOrder: WeavingStep[] = wefts.map(weft => ({
    step: weft.index + 1,
    weftId: weft.id,
    crossings: crossings.filter(crossing => crossing.weftId === weft.id).map(crossing => ({
      crossingId: crossing.id,
      warpId: crossing.warpId,
      action: crossing.top === 'weft' ? 'over' : 'under',
    })),
  }));
  const visibleCrossingIds = crossings.filter(crossing => {
    const dx = crossing.positionMm.x - centerMm.x;
    const dy = crossing.positionMm.y - centerMm.y;
    return dx * dx + dy * dy <= radiusMm * radiusMm;
  }).map(crossing => crossing.id);
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
      conformance: 'b-v0.3-geometry',
      geometryStage: 'raw-blank-then-trim',
      ruleSources: [
        'docs/CRAFT_RULES.md', 'docs/FORMAL_CARRIER_SPEC.md',
        'data/CROSS_WEAVE_V1.json', 'data/FORMAL_CARRIER_ROUND_170.json',
      ],
      current: {
        warpCount: count,
        weftCount: count,
        stripWidthMm: input.parameters.stripWidthMm,
        thicknessMm: B_V03_WEAVE_RULE.stripSpec.thicknessMm,
        stockLengthMm,
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
        ...(Math.abs(input.parameters.stripWidthMm - B_V03_WEAVE_RULE.stripSpec.widthMm) > B_V03_WEAVE_RULE.stripSpec.widthToleranceMm ? [{
          code: 'STRIP_WIDTH_NONCONFORMING',
          message: `当前演示宽度 ${input.parameters.stripWidthMm} mm；B v0.3 要求 9±0.5 mm。`,
        }] : []),
      ],
    },
    parameters: input.parameters,
    grid: {
      warpSpacingMm: round(warpSpacingMm), weftSpacingMm: round(weftSpacingMm),
      warpCount: warps.length, weftCount: wefts.length,
    },
    strips: { list: [...warps, ...wefts] },
    interlace: { crossings },
    stages: {
      rawBlank: { bboxMm: rawBlank, strips: { list: rawBlankStrips }, interlace: { crossings }, weavingOrder },
      trimmedProduct: {
        boundaryId: input.carrier.boundaryId,
        activeArea: { type: 'circle', centerMm, radiusMm },
        strips: { list: [...warps, ...wefts] },
        visibleCrossingIds,
      },
    },
    viewTransform: { mmToSvg: 2, originSvg: { x: 0, y: 0 }, xDirection: 'right', yDirection: 'down' },
    validation: {
      source: 'd-initial',
      designId: input.designId,
      generatedFromRevision: input.designRevision,
      status: 'pending',
      pendingReason: '已按 B v0.3 建模 189×189 mm 毛坯、170 mm 裁剪及逐纬条穿织顺序；实际制作仍待试编验证',
    },
  };
}
