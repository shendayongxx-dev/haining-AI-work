/** E-side independent consumer. No dependency on D's validator or stored PASS reports. */
export const SOURCE_FIELDS = Object.freeze(['schemaVersion', 'structureGeneratorVersion', 'designId',
  'generatedFromRevision', 'carrierId', 'carrierSpecVersion', 'weaveId', 'weaveSpecVersion', 'craftRuleVersion']);
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = x => typeof x === 'number' && Number.isFinite(x);
const pt = x => obj(x) && num(x.x) && num(x.y);
const near = (a, b) => num(a) && num(b) && Math.abs(a - b) <= .010001;
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a, b) => pt(a) && pt(b) && near(a.x, b.x) && near(a.y, b.y);
const copy = x => structuredClone(x);
const canonical = x => JSON.stringify(x, (_k, v) => obj(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
export function sourceKeyValid(k) {
  return obj(k) && SOURCE_FIELDS.every(f => f === 'generatedFromRevision'
    ? Number.isInteger(k[f]) && k[f] >= 0 : typeof k[f] === 'string' && k[f].length > 0);
}
export function sameSource(a, b) {
  return sourceKeyValid(a) && sourceKeyValid(b) && SOURCE_FIELDS.every(f => a[f] === b[f]);
}
export function acceptV03Result(currentKey, incoming, previous = null) {
  return incoming && sameSource(currentKey, incoming.sourceKey) ? incoming : previous;
}

function shapeInside(p, b, tolerance = .01) {
  if (b.type === 'circle') return Math.hypot(p.x - b.cx, p.y - b.cy) <= b.r + tolerance;
  if (b.type === 'ellipse') {
    const dx = p.x - b.cx, dy = p.y - b.cy;
    const q = Math.hypot(dx / b.rx, dy / b.ry);
    // Radial distance in millimetres, not an unscaled implicit-equation tolerance.
    return q <= 1 || (q - 1) * Math.min(b.rx, b.ry) <= tolerance;
  }
  if (b.type === 'polygon') {
    let inside = false;
    const v = b.pointsMm;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const a = v[j], c = v[i], dx = c[0] - a[0], dy = c[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy) <= tolerance) return true;
      if ((a[1] > p.y) !== (c[1] > p.y) && p.x < (c[0] - a[0]) * (p.y - a[1]) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  throw new Error('Unsupported geometry');
}
function boundaryDistance(p, b) {
  if (b.type === 'circle') return Math.abs(Math.hypot(p.x - b.cx, p.y - b.cy) - b.r);
  if (b.type === 'ellipse') {
    const q = Math.hypot((p.x - b.cx) / b.rx, (p.y - b.cy) / b.ry);
    return len(p, { x: b.cx + (p.x - b.cx) / q, y: b.cy + (p.y - b.cy) / q });
  }
  return Math.min(...b.pointsMm.map((a, i) => {
    const c = b.pointsMm[(i + 1) % b.pointsMm.length], dx = c[0] - a[0], dy = c[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);
  }));
}

export function consumeV03(d, specs) {
  const errors = [], notes = [], checks = [];
  const issue = (code, path, message) => errors.push({ code, path, message });
  function check(id, run) {
    const start = errors.length;
    try { run(); } catch (e) { issue('MISSING_OR_INVALID_FIELD', id, String(e.message)); }
    checks.push({ id, pass: errors.length === start });
  }
  const require = (condition, code, path, message) => { if (!condition) issue(code, path, message); };
  const strips = d?.stages?.rawBlank?.strips ?? [], trimmed = d?.stages?.trimmedProduct?.strips ?? [];
  const crossings = d?.stages?.rawBlank?.crossings ?? [], ops = d?.stages?.rawBlank?.weavingOrder ?? [];
  const warnings = d?.engineeringWarnings ?? [];
  let carrier, weave;
  const stripMap = new Map(), segmentMap = new Map(), crossingMap = new Map();
  check('source-key-and-specifications', () => {
    require(d.schemaVersion === '0.3' && sourceKeyValid(d.sourceKey), 'SOURCE_KEY_INVALID', 'sourceKey', '来源键必须完整且类型正确。');
    for (const f of SOURCE_FIELDS) require(d.sourceKey?.[f] === d[f], 'SOURCE_KEY_MISMATCH', `sourceKey.${f}`, '来源键与顶层不一致。');
    require(d.carrierSpecVersion === specs.carrier.carrierSpecVersion && d.weaveSpecVersion === specs.weave.weaveSpecVersion,
      'SPEC_VERSION', 'sourceKey', '需使用与sourceKey一致的规则文件。');
    carrier = specs.carrier.carriers.find(x => x.carrierId === d.carrierId);
    weave = specs.weave.weaves.find(x => x.weaveId === d.weaveId);
    require(!!carrier && !!weave, 'SPEC_LOOKUP', 'carrierId/weaveId', '未找到载体或编法。');
    require(weave?.craftRuleVersion === d.craftRuleVersion, 'CRAFT_VERSION', 'craftRuleVersion', '工艺规则版本与编法规范不一致。');
    require(d.validationStatus === 'pending' && d.physicalValidation === 'not-completed', 'FALSE_CERTIFICATION', 'validationStatus', '本轮仅接收待验证结构。');
  });
  check('strip-identities-and-material-fields', () => {
    require(Array.isArray(strips) && Array.isArray(trimmed), 'ARRAY_EXPECTED', 'stages.*.strips', '应为竹条数组。');
    for (const [i, s] of strips.entries()) {
      require(!stripMap.has(s.stripId), 'DUPLICATE_STRIP', `rawBlank.strips[${i}]`, '竹条ID重复，不能静默去重。');
      stripMap.set(s.stripId, s);
      const prefix = s.direction === 'warp' ? 'V' : s.direction === 'weft' ? 'H' : '?';
      require(s.stripId === `${prefix}${String(s.order).padStart(3, '0')}` && Number.isInteger(s.order) && s.order > 0,
        'STRIP_ORDER', s.stripId, '编号/方向/顺序号不一致。');
      require(pt(s.rawBlankSegment.startMm) && pt(s.rawBlankSegment.endMm)
        && near(s.rawBlankSegment.lengthMm, len(s.rawBlankSegment.startMm, s.rawBlankSegment.endMm))
        && near(s.rawBlankLengthMm, s.rawBlankSegment.lengthMm), 'RAW_LENGTH', s.stripId, '毛坯端点及长度不一致。');
      require(num(s.widthMm) && s.widthMm > 0 && num(s.thicknessMm) && s.thicknessMm > 0 && num(s.pitchMm) && s.pitchMm > 0,
        'STRIP_SPEC', s.stripId, '缺少有效宽度、厚度或节距。');
      for (const f of ['stockLengthMm', 'setupAllowanceMm', 'trimWasteLengthMm'])
        require(s[f] === null || (num(s[f]) && s[f] >= 0), 'MATERIAL_UNKNOWN', `${s.stripId}.${f}`, '未知材料量必须显式null。');
      if (s.stockLengthMm !== null) require(s.stockLengthMm >= s.rawBlankLengthMm && near(s.setupAllowanceMm, s.stockLengthMm - s.rawBlankLengthMm),
        'SETUP_ACCOUNTING', s.stripId, '备料不足或余量记账不一致。');
      else require(s.setupAllowanceMm === null, 'UNKNOWN_SETUP', s.stripId, '未知备料时不能填0或推算准备余量。');
    }
    require(stripMap.size === d.grid.warpCount + d.grid.weftCount, 'GRID_COUNT', 'grid', '竹条总数与网格不一致。');
    require(strips.filter(s => s.direction === 'warp').length === d.grid.warpCount
      && strips.filter(s => s.direction === 'weft').length === d.grid.weftCount, 'GRID_DIRECTION_COUNT', 'grid', '经纬计数不一致。');
    require(trimmed.length === strips.length && new Set(trimmed.map(s => s.stripId)).size === stripMap.size,
      'STAGE_IDENTITIES', 'trimmedProduct.strips', '裁剪阶段不得新建或丢失材料身份。');
    for (const s of trimmed) require(stripMap.has(s.stripId) && canonical(s) === canonical(stripMap.get(s.stripId)),
      'STAGE_STRIP_MISMATCH', s.stripId, '本批两阶段的共享竹条记录应一致。');
  });
  check('segments-colors-and-boundary', () => {
    for (const s of strips) {
      let previous = -Infinity, total = 0;
      for (const [i, seg] of s.visibleSegments.entries()) {
        const p = `${s.stripId}/${seg.segmentId}`;
        require(!segmentMap.has(seg.segmentId), 'DUPLICATE_SEGMENT', p, '可见段ID重复。');
        segmentMap.set(seg.segmentId, { strip: s, segment: seg });
        require(seg.segmentId === `${s.stripId}-S${String(i + 1).padStart(2, '0')}` && seg.ordinal === i + 1,
          'SEGMENT_ORDER', p, '段ID及序号不一致。');
        require(num(seg.stripOffsetStartMm) && num(seg.stripOffsetEndMm) && seg.stripOffsetEndMm > seg.stripOffsetStartMm
          && seg.stripOffsetStartMm >= -.01 && seg.stripOffsetEndMm <= s.rawBlankLengthMm + .01
          && seg.stripOffsetStartMm >= previous - .01, 'SEGMENT_RANGE', p, '段越界、重叠或未排序。');
        previous = seg.stripOffsetEndMm; total += seg.lengthMm;
        require(near(seg.lengthMm, seg.stripOffsetEndMm - seg.stripOffsetStartMm) && near(seg.lengthMm, len(seg.startMm, seg.endMm)),
          'SEGMENT_LENGTH', p, '段端点、偏移及长度不一致。');
        const from = s.direction === 'warp' ? seg.startMm.y - s.rawBlankSegment.startMm.y : seg.startMm.x - s.rawBlankSegment.startMm.x;
        require(near(from, seg.stripOffsetStartMm), 'SEGMENT_ORIGIN', p, '段偏移必须从毛坯起点计算。');
        require(boundaryDistance(seg.startMm, carrier.boundary) <= .010001 && boundaryDistance(seg.endMm, carrier.boundary) <= .010001,
          'CLIPPING_ENDPOINT', p, '可见段端点超出规范求交容差。');
        let cursor = seg.stripOffsetStartMm;
        for (const color of seg.colorSegments) {
          require(near(color.stripOffsetStartMm, cursor) && color.stripOffsetEndMm > color.stripOffsetStartMm
            && color.stripOffsetEndMm <= seg.stripOffsetEndMm + .01 && ['motif', 'base', 'outer-base'].includes(color.scope),
            'COLOR_RANGE', p, '颜色段未按毛坯偏移连续覆盖可见段。');
          if (color.scope === 'motif') {
            const el = d.sourcePattern.elements.find(e => e.elementId === color.sourceElementId);
            require(el && el.sourceInputId === color.sourceInputId && d.sourcePattern.palette.some(x => x.paletteId === color.paletteId),
              'MOTIF_SOURCE', p, 'motif缺少有效元素、笔迹或色板来源。');
          } else require(color.sourceElementId === null, 'BASE_SOURCE', p, '基础编织不应伪装为用户元素。');
          cursor = color.stripOffsetEndMm;
        }
        require(near(cursor, seg.stripOffsetEndMm), 'COLOR_COVERAGE', p, '颜色段末端未完整覆盖。');
      }
      require(near(total, s.visibleLengthMm), 'VISIBLE_SUM', s.stripId, '总可见长度不等于各段之和。');
      if (s.trimWasteLengthMm !== null) require(near(s.trimWasteLengthMm, s.rawBlankLengthMm - s.visibleLengthMm), 'TRIM_ACCOUNTING', s.stripId, '裁切几何记账不一致。');
    }
  });
  check('crossings-bidirectional-links-and-matrix', () => {
    const pairs = new Set();
    for (const c of crossings) {
      const p = c.crossingId;
      require(!crossingMap.has(p), 'DUPLICATE_CROSSING', p, '交点ID重复。'); crossingMap.set(p, c);
      const pair = `${c.warpStripId}/${c.weftStripId}`;
      require(!pairs.has(pair), 'DUPLICATE_PAIR', p, '经纬配对重复。'); pairs.add(pair);
      const warp = stripMap.get(c.warpStripId), weft = stripMap.get(c.weftStripId);
      require(warp?.direction === 'warp' && weft?.direction === 'weft', 'CROSSING_REFERENCE', p, '经纬竹条引用无效。');
      if (!warp || !weft) continue;
      require(p === `X-${warp.stripId}-${weft.stripId}` && near(c.positionMm.x, warp.axisMm) && near(c.positionMm.y, weft.axisMm),
        'CROSSING_POSITION', p, '交点编号或毫米坐标不一致。');
      const expectedTop = weave.topLayerMatrix[(weft.order - 1) % weave.topLayerMatrix.length][(warp.order - 1) % weave.topLayerMatrix[0].length] === 'W' ? weft.stripId : warp.stripId;
      require(c.topStripId === expectedTop, 'WEAVE_MATRIX', p, '上下关系不符合绑定编法矩阵。');
      require(c.rawBlank === true, 'RAW_CROSSING_LOST', p, '毛坯操作不得删除。');
      // A boundary point alone is insufficient: a zero-length tangent strip is absent
      // from the trimmed product. Both participating strips need nonzero segments.
      const containingSegment = strip => {
        const offset = strip.direction === 'warp' ? c.positionMm.y - strip.rawBlankSegment.startMm.y
          : c.positionMm.x - strip.rawBlankSegment.startMm.x;
        for (let i = strip.visibleSegments.length - 1; i >= 0; i--) {
          const seg = strip.visibleSegments[i];
          if (seg.lengthMm > .01 && offset >= seg.stripOffsetStartMm - .01
            && (offset < seg.stripOffsetEndMm - .01 || (i === strip.visibleSegments.length - 1 && offset <= seg.stripOffsetEndMm + .01))) return seg;
        }
        return null;
      };
      const warpPart = containingSegment(warp), weftPart = containingSegment(weft);
      const expectedVisible = shapeInside(c.positionMm, carrier.boundary) && !!warpPart && !!weftPart;
      require(c.trimmedProduct.visible === expectedVisible, 'CROSSING_VISIBILITY', p, '交点可见标记与闭合边界及非零成品段不符。');
      if (c.trimmedProduct.visible) require(c.warpSegmentId === warpPart?.segmentId && c.weftSegmentId === weftPart?.segmentId,
        'CROSSING_SEGMENT_MEMBERSHIP', p, '交点段引用不符合半开区间及最后端点归属。');
      for (const [sid, owner] of [[c.warpSegmentId, warp], [c.weftSegmentId, weft]]) {
        if (c.trimmedProduct.visible) {
          const found = segmentMap.get(sid);
          require(found?.strip.stripId === owner.stripId && found.segment.crossingIds.includes(p), 'SEGMENT_BACKLINK', p, '可见交点缺少对应段的反向引用。');
          if (found) {
            const a = found.segment.startMm, b = found.segment.endMm;
            require(Math.abs(len(a, c.positionMm) + len(c.positionMm, b) - len(a, b)) <= .020001, 'CROSSING_OFF_SEGMENT', p, '交点不在声明的可见段上。');
          }
        } else require(sid === null, 'INVISIBLE_SEGMENT_REFERENCE', p, '成品不可见交点段ID应为null。');
      }
    }
    require(crossingMap.size === d.grid.warpCount * d.grid.weftCount, 'CROSSING_COUNT', 'rawBlank.crossings', '毛坯交点不完整。');
    for (const {strip, segment} of segmentMap.values()) {
      require(new Set(segment.crossingIds).size === segment.crossingIds.length, 'SEGMENT_CROSSING_DUPLICATE', segment.segmentId, '段内交点重复。');
      for (const id of segment.crossingIds) {
        const c = crossingMap.get(id);
        require(c && c.trimmedProduct.visible && (strip.direction === 'warp' ? c.warpSegmentId : c.weftSegmentId) === segment.segmentId,
          'SEGMENT_FORWARD_LINK', segment.segmentId, '段引用了错误、不可见或不存在的交点。');
      }
    }
    const declared = d.stages.trimmedProduct.visibleCrossingIds;
    const actual = crossings.filter(c => c.trimmedProduct.visible).map(c => c.crossingId);
    require(new Set(declared).size === declared.length && declared.length === actual.length && actual.every(id => declared.includes(id)),
      'VISIBLE_CROSSING_SET', 'trimmedProduct.visibleCrossingIds', '可见交点索引不一致。');
  });
  check('weaving-steps-consumption', () => {
    const operations = new Set(), covered = new Set();
    for (const [i, op] of ops.entries()) {
      const c = crossingMap.get(op.crossingId), w = stripMap.get(op.workingStripId), r = stripMap.get(op.referenceStripId);
      require(!operations.has(op.operationId) && !covered.has(op.crossingId), 'OP_DUPLICATE', op.operationId, '操作或交点重复消费。');
      operations.add(op.operationId); covered.add(op.crossingId);
      require(c && w?.direction === 'weft' && r?.direction === 'warp' && op.workingDirection === 'weft'
        && c.weftStripId === op.workingStripId && c.warpStripId === op.referenceStripId, 'OP_REFERENCE', op.operationId, '工作条、参考条或交点不一致。');
      if (!c || !w || !r) continue;
      require(op.step === w.order && op.crossingSequence === r.order
        && op.step === Math.floor(i / d.grid.warpCount) + 1 && op.crossingSequence === i % d.grid.warpCount + 1,
        'OP_SEQUENCE', op.operationId, '工作条投放或同一步内交点顺序不完整。');
      require(['over', 'under'].includes(op.action) && c.topStripId === (op.action === 'over' ? w.stripId : r.stripId),
        'OP_ACTION', op.operationId, '挑压动作与topStripId冲突。');
      require(samePoint(op.positionMm, c.positionMm) && op.trimmedProduct.visible === c.trimmedProduct.visible
        && op.trimmedProduct.workingSegmentId === c.weftSegmentId && op.trimmedProduct.referenceSegmentId === c.warpSegmentId,
        'OP_SEGMENT_REFERENCE', op.operationId, '操作的成品位置或段关联不一致。');
    }
    require(covered.size === crossings.length && crossings.every(c => covered.has(c.crossingId)), 'OP_COVERAGE', 'weavingOrder', '所有毛坯交点均须保留操作。');
  });
  check('engineering-warning-consumption', () => {
    const ids = new Set();
    for (const w of warnings) {
      require(!ids.has(w.warningId), 'WARNING_DUPLICATE', w.warningId, '预警ID重复。'); ids.add(w.warningId);
      require(w.status === 'pending' && w.severity === 'review' && w.carrierId === d.carrierId && w.weaveId === d.weaveId,
        'WARNING_STATE', w.warningId, '预警须保持review/pending并指向当前载体编法。');
      for (const f of ['stripId', 'segmentId', 'crossingIds', 'positionMm', 'measurement'])
        require(Object.hasOwn(w, f), 'WARNING_NULL_FIELD', `${w.warningId}.${f}`, '不适用字段须显式null。');
      require(w.stripId === null || stripMap.has(w.stripId), 'WARNING_STRIP', w.warningId, '竹条定位不存在。');
      require(w.segmentId === null || (segmentMap.has(w.segmentId) && segmentMap.get(w.segmentId).strip.stripId === w.stripId), 'WARNING_SEGMENT', w.warningId, '段定位与竹条不符。');
      require(w.crossingIds === null || (Array.isArray(w.crossingIds) && w.crossingIds.every(id => crossingMap.has(id))), 'WARNING_CROSSINGS', w.warningId, '交点定位不存在。');
      require(w.positionMm === null || pt(w.positionMm), 'WARNING_POSITION', w.warningId, '位置无效。');
      require(typeof w.ruleSource === 'string' && w.ruleSource.length > 0, 'WARNING_RULE', w.warningId, '缺规则来源。');
      if (w.measurement !== null) {
        const m = w.measurement, operators = {'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'=':(a,b)=>near(a,b)};
        require(num(m.measuredValue) && num(m.referenceValue) && ['mm','count','ratio'].includes(m.unit)
          && operators[m.operator]?.(m.measuredValue, m.referenceValue), 'WARNING_MEASUREMENT', w.warningId, '阈值预警无法复算。');
        if (w.code === 'SHORT_VISIBLE_SEGMENT' && segmentMap.has(w.segmentId)) {
          const found = segmentMap.get(w.segmentId);
          require(near(m.measuredValue, found.segment.lengthMm) && near(m.referenceValue, 2 * found.strip.pitchMm), 'WARNING_LENGTH', w.warningId, '短段测量与结构不一致。');
        }
      }
    }
  });
  check('outer-base-and-accounting-contract', () => {
    const zone = d.outerBaseWeaveZone;
    for (const f of ['preserveStripId','preserveOrder','preserveDirection','preservePitch','preserveWidth','preserveThickness','preserveCrossingPhase','preserveWeavingOrder'])
      require(zone.continuity[f] === true, 'OUTER_CONTINUITY', f, '外侧基础编织不得重置身份或循环。');
    require(zone.baseWeaveRequired === true && zone.operation === 'boundary-minus-effectivePatternBoundary', 'OUTER_BASE', 'outerBaseWeaveZone', '外侧基础编织定义缺失。');
    require(d.materialAccounting.identityKey === 'stripId' && d.materialAccounting.countRule === 'count-each-stripId-once'
      && d.materialAccounting.fallbackStatus === 'pending'
      && d.materialAccounting.forbiddenLengthSources.includes('rawBlankSegment.lengthMm')
      && d.materialAccounting.forbiddenLengthSources.includes('visibleLengthMm'), 'ACCOUNTING_CONTRACT', 'materialAccounting', '不能用几何长度替代备料。');
  });
  const missingStock = strips.filter(s => s.stockLengthMm === null).map(s => s.stripId);
  if (missingStock.length) notes.push({ code: 'STOCK_PENDING', message: `${missingStock.length}根备料长度未知；总备料量保持null，不回退几何长度。` });
  notes.push({ code: 'B_REVIEW_AND_PHYSICAL_PENDING', message: 'B规则re-review及实物试编不在本次结构消费测试的认证范围。' });
  const group = new Map();
  for (const op of ops) { if (!group.has(op.step)) group.set(op.step, []); group.get(op.step).push(copy(op)); }
  return {
    sourceKey: copy(d?.sourceKey ?? null), structuralConsumptionPassed: errors.length === 0,
    validationStatus: 'pending', physicalValidation: 'not-completed', formalExportAllowed: false,
    checks, errors, notes,
    materials: { sourceKey: copy(d?.sourceKey ?? null), status: 'pending', stripCount: stripMap.size,
      totalStockLengthMm: missingStock.length || errors.length ? null : strips.reduce((n,s)=>n+s.stockLengthMm,0),
      missingStockStripIds: missingStock },
    tutorialPreview: { sourceKey: copy(d?.sourceKey ?? null), status: 'pending', usage: 'structure-preview-only',
      steps: [...group].map(([step, operations]) => ({step, workingStripId: operations[0].workingStripId, operations})) },
    counts: { strips: strips.length, segments: segmentMap.size, crossings: crossings.length,
      visibleCrossings: crossings.filter(c=>c.trimmedProduct.visible).length, operations: ops.length,
      tutorialGroups: group.size, engineeringWarnings: warnings.length },
  };
}
