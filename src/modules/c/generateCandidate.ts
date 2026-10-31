import type { Candidate, Carrier, CarrierShape, GenerationIssue, InputChannel, Point, SurfacePattern } from '../../model';
import { clampToEffectivePatternBoundary, distanceFromFanCenter, FORMAL_FAN_CARRIER_V1, pointInHandleReserve } from '../../data/formalFanCarrier';
import { prepareCustomShapeStroke } from './shapeProcessing';

export type GenerationInput = {
  carrier: Carrier;
  channel: InputChannel;
  inputVersionId: string;
  generationRevision?: number;
  text?: string;
  file?: File | null;
  strokes?: Point[][];
};

const GENERATOR_VERSION = 'c-generator-v0.2';
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

function fanCandidate(input: GenerationInput, id: string, revision: number, pointsMm: Point[], sourceId: string, issues: GenerationIssue[]): Candidate {
  if (pointsMm.length < 2) issues.push(issue('GENERATION_FAILED', 'blocking', 'input', '没有可以转译的有效笔迹。'));
  const sourcePoints = pointsMm.length >= 2 ? pointsMm : demoTriangle();
  const fanRadius = FORMAL_FAN_CARRIER_V1.boundary.radiusMm;
  if (!shapeIntersectsCircle(sourcePoints, fanRadius)) {
    issues.push(issue('PATTERN_OUTSIDE_FAN', 'blocking', 'geometry', '图样完全位于正式扇面之外，请移入扇面后重试。'));
  }
  const clipped = sourcePoints.some(point => distanceFromFanCenter(point) > FORMAL_FAN_CARRIER_V1.effectivePatternBoundary.radiusMm);
  const points = clipped ? sourcePoints.map(clampToEffectivePatternBoundary) : sourcePoints;
  if (clipped) {
    issues.push(issue('PATTERN_CLIPPED_TO_EFFECTIVE_REGION', 'warning', 'geometry', '超出150 mm有效图样区域的点已收回到区域边界，请检查图样形状。'));
  }
  if (polylineIntersectsHandleReserve(points)) {
    issues.push(issue('HANDLE_RESERVE_OVERLAP', 'warning', 'geometry', '图样进入扇柄连接保留区；背景纹理可保留，关键主体应移动。'));
  }
  const result: SurfacePattern = {
    patternId: `${id}-pattern`, coordinateSpace: COORDINATE_SPACE,
    palette: [{ paletteId: 'green-01', color: GREEN }],
    elements: [{ elementId: `${id}-element-001`, sourceInputId: sourceId, kind: isClosed(points) ? 'polygon' : 'polyline', paletteId: 'green-01', zIndex: 1, pointsMm: points }],
    transform: { scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 } },
  };
  return envelope(input, id, revision, issues, result, 'surface_pattern');
}

function customCandidate(input: GenerationInput, id: string, revision: number, pointsMm: Point[], sourceId: string, issues: GenerationIssue[]): Candidate {
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
  return envelope(input, id, revision, issues, result, 'carrier_shape');
}

function envelope(input: GenerationInput, generationId: string, generationRevision: number, issues: GenerationIssue[], result: SurfacePattern | CarrierShape, resultType: Candidate['resultType']): Candidate {
  const points = resultType === 'surface_pattern'
    ? (result as SurfacePattern).elements[0].pointsMm
    : (result as CarrierShape).components[0].outerBoundary.pointsMm;
  // Temporary projection consumed only by A/D's current visual fixture.
  const visualPoints = points.map(point => ({ x: round(point.x / 210 * 260), y: round(point.y / 297 * 150) }));
  return {
    generationId, generationRevision, inputVersionId: input.inputVersionId,
    status: issues.some(item => item.code === 'GENERATION_FAILED') ? 'failed' : 'succeeded',
    resultType, generatorVersion: GENERATOR_VERSION, issues, result,
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
function shapeIntersectsCircle(points: Point[], radius: number) {
  if (points.some(point => distanceFromFanCenter(point) <= radius)) return true;
  const center = FORMAL_FAN_CARRIER_V1.boundary.centerMm;
  for (let index = 0; index < points.length - 1; index += 1) {
    if (distanceToSegment(center, points[index], points[index + 1]) <= radius) return true;
  }
  return isClosed(points) && pointInPolygon(center, points);
}
function polylineIntersectsHandleReserve(points: Point[]) {
  const zone = FORMAL_FAN_CARRIER_V1.handleReserve;
  if (points.some(pointInHandleReserve)) return true;
  const corners = [
    { x: zone.x, y: zone.y }, { x: zone.x + zone.width, y: zone.y },
    { x: zone.x + zone.width, y: zone.y + zone.height }, { x: zone.x, y: zone.y + zone.height },
  ];
  for (let index = 0; index < points.length - 1; index += 1) {
    for (let edge = 0; edge < corners.length; edge += 1) {
      if (segmentsIntersect(points[index], points[index + 1], corners[edge], corners[(edge + 1) % corners.length])) return true;
    }
  }
  return isClosed(points) && pointInPolygon(corners[0], points);
}
function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
function pointInPolygon(point: Point, points: Point[]) {
  const ring = isClosed(points) ? points.slice(0, -1) : points;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]; const b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function round(value: number) { return Math.round(value * 1000) / 1000; }
