import type { Candidate, Carrier, CarrierShape, GenerationIssue, InputChannel, Point, SurfacePattern } from '../../model';
import { FORMAL_FAN_CARRIER_V1 } from '../../data/formalFanCarrier';
import type { CarrierRef } from '../../model';
import { resolveFixedFan } from '../../data/fixedFanRegistry';
import { geometryContainedByBoundary, geometryIntersectsBoundary, rectangleBoundary } from '../../data/fixedFanGeometry';
import type { Boundary } from '../../data/fixedFanGeometry';
import { prepareCustomShapeStroke } from './shapeProcessing';

type GenerationInputBase = {
  channel: InputChannel;
  inputVersionId: string;
  generationRevision?: number;
  text?: string;
  file?: File | null;
  strokes?: Point[][];
};
export type GenerationInput = GenerationInputBase & (
  | { carrier: 'fan'; carrierRef: CarrierRef }
  | { carrier: 'custom'; carrierRef: null }
);

const GENERATOR_VERSION = 'c-generator-v0.3-fan-integration';
const COORDINATE_SPACE = FORMAL_FAN_CARRIER_V1.coordinateSpace;
const GREEN = '#315F3A';

/** Direct drawing is real translation. Text/image use an honest demo adapter until A injects the model service. */
export async function generateCandidate(input: GenerationInput): Promise<Candidate> {
  assertInput(input);
  const generationId = crypto.randomUUID();
  const source = sourceGeometry(input);
  const revision = input.generationRevision ?? 1;
  return input.carrier === 'fan'
    ? fanCandidate(input, generationId, revision, source.pointsMm, source.sourceInputId, source.issues)
    : customCandidate(input, generationId, revision, source.pointsMm, source.sourceInputId, source.issues);
}

export function canConfirmCandidate(candidate: Candidate): boolean {
  return candidate.status === 'succeeded' && !candidate.issues.some(issue => issue.severity === 'blocking');
}

function sourceGeometry(input: GenerationInput) {
  if (input.channel === 'drawing') {
    const stroke = input.strokes?.at(-1) ?? [];
    const prepared = input.carrier === 'custom' ? prepareCustomShapeStroke(stroke) : null;
    return {
      pointsMm: (prepared?.points ?? stroke).map(point => ({ x: round(point.x), y: round(point.y) })),
      sourceInputId: `drawing-${input.inputVersionId}`,
      issues: prepared?.autoClosed || prepared?.smoothed
        ? [issue('OUTLINE_AUTO_REFINED', 'info', 'geometry', '已根据绘制内容自动闭合并平滑轮廓。')]
        : [] as GenerationIssue[],
    };
  }
  if (input.channel === 'text') {
    const recognizedTriangle = input.carrier === 'fan' && /三角|triangle/i.test(input.text ?? '');
    return {
      pointsMm: input.carrier === 'fan' ? demoTriangle() : demoLeaf(),
      sourceInputId: `text-${input.inputVersionId}`,
      issues: recognizedTriangle ? [] : [issue('MODEL_ADAPTER_PENDING', 'warning', 'translation', '当前文字通道使用结构化演示转译；接入真实模型服务后应重新生成。')],
    };
  }
  return {
    pointsMm: input.carrier === 'fan' ? demoTriangle() : demoLeaf(),
    sourceInputId: `reference-image-${input.inputVersionId}`,
    issues: [issue('MODEL_ADAPTER_PENDING', 'warning', 'translation', '参考图已完成格式检查，但尚缺 assetRef 读取和视觉模型服务；本结果仅验证候选接口。')],
  };
}

function fanCandidate(input: GenerationInput & {carrier:'fan';carrierRef:CarrierRef}, id: string, revision: number, pointsMm: Point[], sourceId: string, issues: GenerationIssue[]): Candidate {
  if (pointsMm.length < 2) issues.push(issue('GENERATION_FAILED', 'blocking', 'input', '没有可以转译的有效笔迹。'));
  const sourcePoints = pointsMm.length >= 2 ? pointsMm : demoTriangle();
  const carrier = resolveFixedFan(input.carrierRef);
  const closed = isClosed(sourcePoints);
  if (!geometryIntersectsBoundary(sourcePoints,closed,carrier.boundary as Boundary)) {
    issues.push(issue('PATTERN_OUTSIDE_CARRIER', 'blocking', 'geometry', '图样完全位于当前扇面之外，请移入扇面后重试。'));
  }
  if (!geometryContainedByBoundary(sourcePoints,carrier.effectivePatternBoundary as Boundary)) {
    issues.push(issue('PATTERN_CROSSES_EFFECTIVE_BOUNDARY', 'warning', 'geometry', '部分图样超出有效区域，成品预览将按载体边界裁切。'));
  }
  const zone=carrier.handleExclusion;
  if (geometryIntersectsBoundary(sourcePoints,closed,rectangleBoundary(zone.xMin,zone.yMin,zone.xMax,zone.yMax))) {
    issues.push(issue('HANDLE_RESERVE_OVERLAP', 'warning', 'geometry', '图样进入扇柄连接保留区；背景纹理可保留，关键主体应移动。'));
  }
  const result: SurfacePattern = {
    patternId: `${id}-pattern`, coordinateSpace: COORDINATE_SPACE,
    palette: [{ paletteId: 'green-01', color: GREEN }],
    elements: [{ elementId: `${id}-element-001`, sourceInputId: sourceId, kind: closed ? 'polygon' : 'polyline', paletteId: 'green-01', zIndex: 1, pointsMm: sourcePoints }],
    transform: { scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 } },
  };
  return { ...envelope(input, id, revision, issues, result), carrierRef: input.carrierRef, resultType: 'surface_pattern', result };
}

function customCandidate(input: GenerationInput & {carrier:'custom';carrierRef:null}, id: string, revision: number, pointsMm: Point[], sourceId: string, issues: GenerationIssue[]): Candidate {
  const points = pointsMm.length >= 2 ? pointsMm : demoLeaf();
  const closed = isClosed(points);
  if (!closed) issues.push(issue('OPEN_BOUNDARY', 'blocking', 'geometry', '自定义形状外轮廓未闭合，请连接起点和终点。'));
  if (closed && Math.abs(signedArea(points)) < 0.001) issues.push(issue('NON_POSITIVE_AREA', 'blocking', 'geometry', '自定义形状没有形成有效面积。'));
  if (closed && hasSelfIntersection(points)) issues.push(issue('SELF_INTERSECTION', 'blocking', 'geometry', '自定义形状存在自交，请修改交叉区域。'));
  const result: CarrierShape = {
    shapeId: `${id}-shape`, coordinateSpace: COORDINATE_SPACE, fillRule: 'evenodd',
    components: [{ componentId: `${id}-component-001`, outerBoundary: { closed, pointsMm: points }, holes: [] }],
  };
  void sourceId;
  return { ...envelope(input, id, revision, issues, result), carrierRef: null, resultType: 'carrier_shape', result };
}

function envelope(input: GenerationInput, generationId: string, generationRevision: number, issues: GenerationIssue[], result: SurfacePattern | CarrierShape) {
  const points = 'patternId' in result ? result.elements[0].pointsMm : result.components[0].outerBoundary.pointsMm;
  // Temporary projection consumed only by A/D's current visual fixture.
  const visualPoints = points.map(point => ({ x: round(point.x / 210 * 260), y: round(point.y / 297 * 150) }));
  return {
    generationId, generationRevision, inputVersionId: input.inputVersionId,
    status: (issues.some(item => item.code === 'GENERATION_FAILED') ? 'failed' : 'succeeded') as Candidate['status'],
    generatorVersion: GENERATOR_VERSION, issues,
    label: label(input), pointsMm: visualPoints, color: GREEN,
  };
}

function assertInput(input: GenerationInput) {
  if (!input.inputVersionId) throw new Error('inputVersionId 不能为空。');
  if (input.channel === 'drawing' && !input.strokes?.length) throw new Error('请先完成绘制。');
  if (input.channel === 'text' && !input.text?.trim()) throw new Error('请输入创意描述。');
  if (input.channel === 'referenceImage') {
    if (!input.file) throw new Error('请选择参考图。');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.file.type)) throw new Error('仅支持 PNG、JPEG 或 WebP。');
  }
}

function label(input: GenerationInput) {
  if (input.channel === 'drawing') return input.carrier === 'fan' ? '直接绘制表面图样候选' : '直接绘制载体形状候选';
  if (input.channel === 'text') return input.carrier === 'fan' ? '文字描述表面图样候选' : '文字描述载体形状候选';
  return input.carrier === 'fan' ? '参考图表面图样候选（接口演示）' : '参考图载体形状候选（接口演示）';
}

function demoTriangle(): Point[] { return [{ x: 105, y: 65 }, { x: 70, y: 145 }, { x: 140, y: 145 }, { x: 105, y: 65 }]; }
function demoLeaf(): Point[] { return [{ x: 24, y: 148.5 }, { x: 66, y: 62 }, { x: 144, y: 66 }, { x: 186, y: 148.5 }, { x: 144, y: 231 }, { x: 66, y: 235 }, { x: 24, y: 148.5 }]; }
function issue(code: string, severity: GenerationIssue['severity'], stage: GenerationIssue['stage'], message: string): GenerationIssue {
  return { id: `issue-${code.toLowerCase()}`, code, severity, stage, message, generatorVersion: GENERATOR_VERSION };
}
function isClosed(points: Point[]) { const first = points[0]; const last = points.at(-1); return points.length >= 4 && !!last && Math.hypot(first.x - last.x, first.y - last.y) <= 2; }
function signedArea(points: Point[]) { const ring = isClosed(points) ? points.slice(0, -1) : points; return ring.reduce((sum, point, i) => { const next = ring[(i + 1) % ring.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2; }
function hasSelfIntersection(points: Point[]) {
  const ring = isClosed(points) ? points.slice(0, -1) : points;
  for (let a = 0; a < ring.length; a += 1) for (let b = a + 1; b < ring.length; b += 1) {
    const an = (a + 1) % ring.length; const bn = (b + 1) % ring.length;
    if (a === b || an === b || bn === a) continue;
    if (segmentsIntersect(ring[a], ring[an], ring[b], ring[bn])) return true;
  }
  return false;
}
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) { const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0; }
function round(value: number) { return Math.round(value * 1000) / 1000; }
