import { sourceKeyValid } from './consume.mjs';
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const point = x => obj(x) && finite(x.x) && finite(x.y);
const assert = (ok,message) => {if(!ok)throw new Error(message);};
function shape(b) {
  if(!obj(b))return false;
  if(b.type==='circle')return finite(b.cx)&&finite(b.cy)&&finite(b.r)&&b.r>0;
  if(b.type==='ellipse')return finite(b.cx)&&finite(b.cy)&&finite(b.rx)&&finite(b.ry)&&b.rx>0&&b.ry>0;
  return b.type==='polygon'&&Array.isArray(b.pointsMm)&&b.pointsMm.length>=3&&b.pointsMm.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite));
}
/** Browser boundary only. Semantic failures are still returned by the independent E consumer. */
export function assertBrowserInput(d) {
  assert(obj(d)&&d.schemaVersion==='0.3'&&sourceKeyValid(d.sourceKey),'请上传带完整sourceKey的v0.3结构快照。');
  assert(['designId','structureGeneratorVersion','carrierId','weaveId'].every(k=>typeof d[k]==='string'&&d[k].length>0)&&Number.isInteger(d.generatedFromRevision)&&d.generatedFromRevision>=0,'快照顶层来源字段不完整。');
  assert(obj(d.coordinateSpace)&&d.coordinateSpace.widthMm===210&&d.coordinateSpace.heightMm===297,'本页仅支持210×297 mm坐标空间。');
  assert(obj(d.carrierGeometry)&&shape(d.carrierGeometry.boundary)&&shape(d.carrierGeometry.effectivePatternBoundary),'缺少可显示的圆、椭圆或多边形边界。');
  assert(obj(d.sourcePattern)&&Array.isArray(d.sourcePattern.elements)&&Array.isArray(d.sourcePattern.palette),'缺少图样上下文。');
  const raw=d.stages?.rawBlank, trimmed=d.stages?.trimmedProduct;
  assert(obj(raw)&&obj(trimmed)&&Array.isArray(d.strips)&&Array.isArray(raw.crossings)&&Array.isArray(raw.weavingOrder)&&Array.isArray(raw.stripIds)&&Array.isArray(trimmed.visibleStripIds)&&Array.isArray(trimmed.visibleCrossingIds),'毛坯/成品结构不完整。');
  assert(obj(raw.boundary)&&raw.boundary.type==='rect'&&['x','y','width','height'].every(k=>finite(raw.boundary[k]))&&raw.boundary.width>0&&raw.boundary.height>0,'缺少有效毛坯矩形边界。');
  assert(d.strips.length>0&&d.strips.length<=1000&&raw.crossings.length<=50000&&raw.weavingOrder.length<=50000,'结构为空或超过本地联调页显示上限。');
  for(const s of d.strips){
    assert(obj(s)&&typeof s.stripId==='string'&&['warp','weft'].includes(s.direction)&&finite(s.widthMm)&&s.widthMm>0&&finite(s.pitchMm)&&s.pitchMm>0&&obj(s.rawBlankSegment)&&point(s.rawBlankSegment.startMm)&&point(s.rawBlankSegment.endMm)&&Array.isArray(s.visibleSegments),'竹条坐标、规格或可见段无效。');
    for(const seg of s.visibleSegments){
      assert(obj(seg)&&typeof seg.segmentId==='string'&&point(seg.startMm)&&point(seg.endMm)&&finite(seg.stripOffsetStartMm)&&finite(seg.stripOffsetEndMm)&&Array.isArray(seg.crossingIds)&&Array.isArray(seg.colorSegments),'可见段结构无效。');
      assert(seg.colorSegments.every(c=>obj(c)&&finite(c.stripOffsetStartMm)&&finite(c.stripOffsetEndMm)&&typeof c.color==='string'),'颜色段结构无效。');
    }
  }
  assert(raw.crossings.every(c=>obj(c)&&typeof c.crossingId==='string'&&point(c.positionMm)&&obj(c.trimmedProduct)),'交点坐标无效。');
  assert(raw.weavingOrder.every(o=>obj(o)&&Number.isInteger(o.step)&&typeof o.operationId==='string'&&point(o.positionMm)&&obj(o.trimmedProduct)),'操作步骤结构无效。');
  assert(Array.isArray(d.engineeringWarnings)&&d.engineeringWarnings.every(w=>obj(w)&&typeof w.warningId==='string'&&typeof w.message==='string'&&(w.positionMm===null||point(w.positionMm))),'工程预警结构无效。');
  return d;
}
