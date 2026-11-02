import type { StructureSnapshotV03 } from './types';
import { resolveWeaveSpec } from './weaveRegistry';

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
  const strips = snapshot.strips;
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
  const invisibleReferencesCleared = crossings.filter(crossing => !crossing.trimmedProduct.visible)
    .every(crossing => crossing.warpSegmentId === null && crossing.weftSegmentId === null);
  const operationReferencesConsistent = operations.every(operation => operation.trimmedProduct.visible
    ? operation.trimmedProduct.workingSegmentId !== null && operation.trimmedProduct.referenceSegmentId !== null
    : operation.trimmedProduct.workingSegmentId === null && operation.trimmedProduct.referenceSegmentId === null);
  const visibleCrossingSet = new Set(snapshot.stages.trimmedProduct.visibleCrossingIds);
  const visibleCrossingIdsExact = visibleCrossingSet.size === visible.length
    && visible.every(crossing => visibleCrossingSet.has(crossing.crossingId))
    && crossings.filter(crossing => !crossing.trimmedProduct.visible).every(crossing => !visibleCrossingSet.has(crossing.crossingId));
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
  const weave = resolveWeaveSpec(snapshot.weaveId);
  const weaveVersionExact = snapshot.weaveSpecVersion === weave.weaveSpecVersion;
  const gridParametersValid = snapshot.grid.warpCount >= 3 && snapshot.grid.weftCount >= 3
    && snapshot.grid.stripWidthMm > 0 && snapshot.grid.pitchMm >= snapshot.grid.stripWidthMm
    && Math.abs(snapshot.grid.clearHoleMm - (snapshot.grid.pitchMm - snapshot.grid.stripWidthMm)) < .01;
  const rawBoundary = snapshot.stages.rawBlank.boundary as { type?: string; width?: number; height?: number };
  const gridFitsRawBlank = rawBoundary.type === 'rect' && typeof rawBoundary.width === 'number' && typeof rawBoundary.height === 'number'
    && Math.abs((snapshot.grid.warpCount - 1) * snapshot.grid.pitchMm + snapshot.grid.stripWidthMm - rawBoundary.width) < .05
    && Math.abs((snapshot.grid.weftCount - 1) * snapshot.grid.pitchMm + snapshot.grid.stripWidthMm - rawBoundary.height) < .05;
  const matrixExact = crossings.every(crossing => {
    const warpIndex = Number(crossing.warpStripId.slice(1)) - 1;
    const weftIndex = Number(crossing.weftStripId.slice(1)) - 1;
    const expectedTop = weave.topLayerMatrix[weftIndex % weave.topLayerMatrix.length][warpIndex % weave.topLayerMatrix[0].length] === 'W'
      ? crossing.weftStripId : crossing.warpStripId;
    return crossing.topStripId === expectedTop;
  });
  const operationSequence = Array.from({ length: snapshot.grid.weftCount }, (_, index) => `H${String(index + 1).padStart(3, '0')}`).every(stripId => {
    const stripOperations = operations.filter(operation => operation.workingStripId === stripId);
    return stripOperations.length === snapshot.grid.warpCount
      && stripOperations.every((operation, index) => operation.step === Number(stripId.slice(1)) && operation.crossingSequence === index + 1);
  });
  const nullableMaterials = strips.every(strip => strip.stockLengthMm === null && strip.setupAllowanceMm === null && strip.trimWasteLengthMm === null);
  const boundary = snapshot.carrierGeometry.boundary as Shape;
  const boundaryEndpoints = strips.every(strip => strip.visibleSegments.every(segment => pointOnBoundary(segment.startMm, boundary) && pointOnBoundary(segment.endMm, boundary)));
  const sourceKeyFields = [
    'schemaVersion', 'structureGeneratorVersion', 'designId', 'designRevision', 'generatedFromRevision',
    'carrierId', 'carrierSpecVersion', 'weaveId', 'weaveSpecVersion', 'craftRuleVersion', 'patternPlacementKey',
  ] as const;
  const sourceKey = sourceKeyFields.every(field => snapshot[field] === snapshot.sourceKey[field]);
  const uniqueCanonicalStrips = new Set(strips.map(strip => strip.stripId)).size === strips.length;
  const rawStripIds = snapshot.stages.rawBlank.stripIds;
  const rawStageIndexExact = rawStripIds.length === strips.length
    && rawStripIds.every((stripId, index) => stripId === strips[index].stripId);
  const expectedVisibleStripIds = strips.filter(strip => strip.visibleSegments.length > 0).map(strip => strip.stripId);
  const trimmedStageIndexExact = snapshot.stages.trimmedProduct.visibleStripIds.length === expectedVisibleStripIds.length
    && snapshot.stages.trimmedProduct.visibleStripIds.every((stripId, index) => stripId === expectedVisibleStripIds[index]);
  const segmentOrdering = strips.every(strip => strip.visibleSegments.every((segment, index, all) => index === 0
    || segment.stripOffsetStartMm >= all[index - 1].stripOffsetStartMm));
  const palette = new Map(snapshot.sourcePattern.palette.map(entry => [entry.paletteId, entry.color]));
  const sourceElements = new Map(snapshot.sourcePattern.elements.map(entry => [entry.elementId, entry]));
  const paletteIds = snapshot.sourcePattern.palette.map(entry => entry.paletteId);
  const elementIds = snapshot.sourcePattern.elements.map(entry => entry.elementId);
  const paletteIdsUnique = new Set(paletteIds).size === paletteIds.length;
  const elementIdsUnique = new Set(elementIds).size === elementIds.length;
  const space = snapshot.sourcePattern.coordinateSpace;
  const coordinateSpaceExact = space.unit === 'mm' && space.width === 210 && space.height === 297
    && space.origin === 'topLeft' && space.xAxis === 'right' && space.yAxis === 'down';
  const transform = snapshot.sourcePattern.transform;
  const sourcePatternShape = Number.isFinite(transform.scale) && transform.scale > 0
    && Number.isFinite(transform.rotationDeg) && Number.isFinite(transform.offsetMm.x) && Number.isFinite(transform.offsetMm.y)
    && snapshot.sourcePattern.elements.every(element => palette.has(element.paletteId)
      && element.elementId.length > 0 && element.sourceInputId.length > 0 && Number.isFinite(element.zIndex)
      && (element.kind === 'polygon' ? element.pointsMm.length >= 3 : element.pointsMm.length >= 2)
      && element.pointsMm.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  const colorSourceSemantics = strips.every(strip => strip.visibleSegments.every(segment => segment.colorSegments.every(color => color.scope === 'motif'
    ? color.paletteId !== null && color.sourceElementId !== null && color.sourceInputId !== null
      && palette.get(color.paletteId) === color.color
      && sourceElements.get(color.sourceElementId)?.sourceInputId === color.sourceInputId
      && sourceElements.get(color.sourceElementId)?.paletteId === color.paletteId
    : color.paletteId === null && color.sourceElementId === null && color.sourceInputId === null)));
  const revisionCurrent = snapshot.designRevision === snapshot.generatedFromRevision;
  const placement = snapshot.patternPlacement;
  const expectedPlacementKey = [placement.scale, placement.rotationDeg, placement.offsetMm.x, placement.offsetMm.y,
    placement.pivotMm.x, placement.pivotMm.y].join(':');
  const patternPlacementValid = Number.isFinite(placement.scale) && placement.scale > 0
    && Number.isFinite(placement.rotationDeg) && Number.isFinite(placement.offsetMm.x) && Number.isFinite(placement.offsetMm.y)
    && Number.isFinite(placement.pivotMm.x) && Number.isFinite(placement.pivotMm.y)
    && snapshot.patternPlacementKey === expectedPlacementKey;
  const creativeSource = snapshot.confirmedGenerationId === snapshot.creativeSource.confirmedGenerationId
    && snapshot.creativeSource.resultType === 'surface_pattern'
    && snapshot.creativeSource.resultId === snapshot.sourcePattern.patternId
    && snapshot.creativeSource.generationRevision >= 1
    && snapshot.creativeSource.generatorVersion.length > 0
    && snapshot.creativeSource.inputVersionId.length > 0;
  const upstreamIssueDomain = snapshot.creativeSource.generationIssues.every(issue => issue.generatorVersion === snapshot.creativeSource.generatorVersion
    && ['info', 'warning', 'blocking'].includes(issue.severity));
  const checks: ValidationCheck[] = [
    { id: 'source-key-complete', pass: sourceKey, details: '完整来源键与快照顶层字段一致。' },
    { id: 'revision-current', pass: revisionCurrent, details: 'designRevision 与 generatedFromRevision 一致。' },
    { id: 'creative-source-complete', pass: creativeSource, details: 'C 确认生成、生成版本、适配器版本、输入版本和 patternId 可独立追溯。' },
    { id: 'upstream-generation-domain', pass: upstreamIssueDomain, details: 'C generationIssues 独立保存，且 issue.generatorVersion 与 creativeSource.generatorVersion 一致。' },
    { id: 'source-coordinate-space', pass: coordinateSpaceExact, details: 'C 图样坐标为 210×297 mm、topLeft、X向右、Y向下。' },
    { id: 'source-palette-ids-unique', pass: paletteIdsUnique, details: 'sourcePattern.paletteId 在图样内唯一。' },
    { id: 'source-element-ids-unique', pass: elementIdsUnique, details: 'sourcePattern.elementId 在图样内唯一。' },
    { id: 'source-pattern-shape', pass: sourcePatternShape, details: '元素类型、点列、色板引用、层级和变换结构有效。' },
    { id: 'pattern-placement', pass: patternPlacementValid, details: 'D 图样放置参数可复算，不修改 C 原始 sourcePattern。' },
    { id: 'canonical-strips-unique', pass: uniqueCanonicalStrips, details: '顶层 strips[] 是唯一完整竹条对象树，stripId 无重复。' },
    { id: 'raw-stage-strip-index', pass: rawStageIndexExact, details: 'rawBlank.stripIds 与顶层 strips[] 顺序及数量完全一致。' },
    { id: 'trimmed-stage-strip-index', pass: trimmedStageIndexExact, details: 'trimmedProduct.visibleStripIds 仅索引具有可见段的顶层竹条。' },
    { id: 'segment-offset-order', pass: segmentOrdering, details: '所有 visibleSegments[] 按 stripOffsetStartMm 升序排列。' },
    { id: 'color-source-semantics', pass: colorSourceSemantics, details: 'motif 来源字段必填，base/outer-base 来源字段统一为 null。' },
    { id: 'crossing-matrix-count', pass: crossings.length === expected, details: `${crossings.length}/${expected} 个毛坯交点。` },
    { id: 'weave-spec-version', pass: weaveVersionExact, details: '编法 ID 与规则版本一致，平编保持 D 候选身份。' },
    { id: 'grid-parameters-valid', pass: gridParametersValid, details: '经纬数量、竹条宽度、中心间距和净孔可复算。' },
    { id: 'grid-fits-raw-blank', pass: gridFitsRawBlank, details: '参数化网格从四个方向完整覆盖毛坯边界。' },
    { id: 'weave-matrix-exact', pass: matrixExact, details: `全部交点的 topStripId 与 ${snapshot.weaveId} 权威循环矩阵一致。` },
    { id: 'weaving-order-links', pass: Boolean(operationLinks), details: `${operations.length} 条操作均关联交点、工作条与挑压动作。` },
    { id: 'weaving-order-sequence', pass: operationSequence, details: '每根纬条的操作按经条顺序完整排列，可直接分组生成逐条编织步骤。' },
    { id: 'visible-segment-backlinks', pass: crossingBacklinks, details: `${visible.length} 个裁切后可见交点具有双向 segmentId/crossingId 引用。` },
    { id: 'invisible-segment-refs-cleared', pass: invisibleReferencesCleared, details: '全部 visible=false 交点的成品 segmentId 均为 null。' },
    { id: 'weaving-order-trimmed-refs', pass: operationReferencesConsistent, details: 'weavingOrder 的可见状态与两个成品段引用一致。' },
    { id: 'visible-crossing-ids-exact', pass: visibleCrossingIdsExact, details: 'visibleCrossingIds 与 crossings.visible=true 集合完全一致。' },
    { id: 'color-segment-coverage', pass: colorCoverage, details: '颜色段连续覆盖全部可见段，坐标为原竹条毛坯起点偏移。' },
    { id: 'boundary-clipping-endpoints', pass: boundaryEndpoints, details: '全部可见段端点位于载体边界，未发现整页直条残留。' },
    { id: 'unknown-materials-null', pass: nullableMaterials, details: '未确认备料长度、余量及裁切余量全部为 null。' },
    { id: 'risk-status-pending', pass: snapshot.engineeringWarnings.every(warning => warning.status === 'pending' && warning.severity === 'review'), details: `${snapshot.engineeringWarnings.length} 项风险均保持 review/pending。` },
  ];
  return { caseId: `${snapshot.carrierId}__${snapshot.weaveId}`, checkedAt: '2026-11-02', pass: checks.every(check => check.pass), checks };
}
