import type { StructureSnapshotV03 } from './types';

export type ValidationCheck = { id: string; pass: boolean; details: string };
export type ValidationReportV03 = { caseId: string; checkedAt: string; pass: boolean; checks: ValidationCheck[] };

type Shape = { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'polygon'; pointsMm: number[][] };

function pointOnBoundary(point: { x: number; y: number }, boundary: Shape) {
  if (boundary.type === 'circle') return Math.abs(Math.hypot(point.x - boundary.cx, point.y - boundary.cy) - boundary.r) < .08;
  if (boundary.type === 'ellipse') {
    const value = ((point.x - boundary.cx) / boundary.rx) ** 2 + ((point.y - boundary.cy) / boundary.ry) ** 2;
    return Math.abs(value - 1) < .003;
  }
  return boundary.pointsMm.some((a, index) => {
    const b = boundary.pointsMm[(index + 1) % boundary.pointsMm.length];
    const cross = Math.abs((point.x - a[0]) * (b[1] - a[1]) - (point.y - a[1]) * (b[0] - a[0]));
    const dot = (point.x - a[0]) * (b[0] - a[0]) + (point.y - a[1]) * (b[1] - a[1]);
    const squared = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    return cross / Math.sqrt(squared) < .08 && dot >= -.08 && dot <= squared + .08;
  });
}

export function validateStructureV03(snapshot: StructureSnapshotV03): ValidationReportV03 {
  const strips = snapshot.stages.rawBlank.strips;
  const crossings = snapshot.stages.rawBlank.crossings;
  const operations = snapshot.stages.rawBlank.weavingOrder;
  const stripMap = new Map(strips.map(strip => [strip.stripId, strip]));
  const expected = snapshot.grid.warpCount * snapshot.grid.weftCount;
  const visible = crossings.filter(crossing => crossing.trimmedProduct.visible);
  const crossingBacklinks = visible.every(crossing => {
    const warp = stripMap.get(crossing.warpStripId)?.visibleSegments.find(segment => segment.segmentId === crossing.warpSegmentId);
    const weft = stripMap.get(crossing.weftStripId)?.visibleSegments.find(segment => segment.segmentId === crossing.weftSegmentId);
    return Boolean(warp?.crossingIds.includes(crossing.crossingId) && weft?.crossingIds.includes(crossing.crossingId));
  });
  const colorCoverage = strips.every(strip => strip.visibleSegments.every(segment => {
    const parts = segment.colorSegments;
    if (!parts.length) return false;
    const continuous = parts.every((part, index) => index === 0 || Math.abs(part.stripOffsetStartMm - parts[index - 1].stripOffsetEndMm) < .02);
    return continuous && Math.abs(parts[0].stripOffsetStartMm - segment.stripOffsetStartMm) < .02
      && Math.abs(parts.at(-1)!.stripOffsetEndMm - segment.stripOffsetEndMm) < .02;
  }));
  const operationLinks = operations.length === crossings.length && operations.every(operation => {
    const crossing = crossings.find(value => value.crossingId === operation.crossingId);
    return crossing && crossing.weftStripId === operation.workingStripId && crossing.warpStripId === operation.referenceStripId
      && (operation.action === 'over') === (crossing.topStripId === operation.workingStripId);
  });
  const nullableMaterials = strips.every(strip => strip.stockLengthMm === null && strip.setupAllowanceMm === null && strip.trimWasteLengthMm === null);
  const boundary = snapshot.carrierGeometry.boundary as Shape;
  const boundaryEndpoints = strips.every(strip => strip.visibleSegments.every(segment => pointOnBoundary(segment.startMm, boundary) && pointOnBoundary(segment.endMm, boundary)));
  const sourceKey = snapshot.sourceKey.designId === snapshot.designId
    && snapshot.sourceKey.generatedFromRevision === snapshot.generatedFromRevision
    && snapshot.sourceKey.carrierId === snapshot.carrierId && snapshot.sourceKey.weaveId === snapshot.weaveId;
  const checks: ValidationCheck[] = [
    { id: 'source-key-complete', pass: sourceKey, details: '完整来源键与快照顶层字段一致。' },
    { id: 'crossing-matrix-count', pass: crossings.length === expected, details: `${crossings.length}/${expected} 个毛坯交点。` },
    { id: 'weaving-order-links', pass: Boolean(operationLinks), details: `${operations.length} 条操作均关联交点、工作条与挑压动作。` },
    { id: 'visible-segment-backlinks', pass: crossingBacklinks, details: `${visible.length} 个裁切后可见交点具有双向 segmentId/crossingId 引用。` },
    { id: 'color-segment-coverage', pass: colorCoverage, details: '颜色段连续覆盖全部可见段，坐标为原竹条毛坯起点偏移。' },
    { id: 'boundary-clipping-endpoints', pass: boundaryEndpoints, details: '全部可见段端点位于载体边界，未发现整页直条残留。' },
    { id: 'unknown-materials-null', pass: nullableMaterials, details: '未确认备料长度、余量及裁切余量全部为 null。' },
    { id: 'risk-status-pending', pass: snapshot.engineeringWarnings.every(warning => warning.status === 'pending' && warning.severity === 'review'), details: `${snapshot.engineeringWarnings.length} 项风险均保持 review/pending。` },
  ];
  return { caseId: `${snapshot.carrierId}__${snapshot.weaveId}`, checkedAt: '2026-11-01', pass: checks.every(check => check.pass), checks };
}
