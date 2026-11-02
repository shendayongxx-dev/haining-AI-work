import type { Point } from '../../model';
import type { CustomStructureInput, CustomStructureResult } from '../d/customTypes';
import type { CraftIssue } from './craftTypes';
import { resolveWeaveSpec } from '../d/v03/weaveRegistry';
const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=.02; // mm geometry tolerance, not craft threshold
const finitePoint=(p:Point)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function selfIntersects(points:Point[]){
  const on=(a:Point,b:Point,p:Point)=>Math.abs(cross(a,b,p))<1e-5&&p.x>=Math.min(a.x,b.x)-1e-5&&p.x<=Math.max(a.x,b.x)+1e-5&&p.y>=Math.min(a.y,b.y)-1e-5&&p.y<=Math.max(a.y,b.y)+1e-5;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    if(j===i+1||(i===0&&j===points.length-1))continue;
    const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
    if((cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return true;
  }
  return false;
}
function intervals(points:Point[],axis:number,vertical:boolean){
  const hits:number[]=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],aa=vertical?a.x:a.y,bb=vertical?b.x:b.y;
    if((aa<=axis&&bb>axis)||(bb<=axis&&aa>axis))hits.push((vertical?a.y:a.x)+(axis-aa)/(bb-aa)*((vertical?b.y:b.x)-(vertical?a.y:a.x)));
  }
  hits.sort((a,b)=>a-b);const result:[number,number][]=[];
  for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>1e-5)result.push([hits[i],hits[i+1]]);
  return result;
}
export function checkCustomStructure(input:CustomStructureInput,result:CustomStructureResult){
  const issues:CraftIssue[]=[],evaluatedRuleIds=['E-CUSTOM-SOURCE','E-CUSTOM-BOUNDARY','E-CUSTOM-STRIPS','E-CUSTOM-CROSSINGS'];
  const add=(code:string,path:string,reason:string,status:'failed'|'pending'='failed',positionMm?:Point)=>issues.push({
    id:`E-CUSTOM-${code}-${path}`,ruleId:`E-CUSTOM-${code}`,domain:['SHORT_SEGMENT','WIDTH_PITCH'].includes(code)?'craft':'structure',status,title:status==='failed'?'自定义结构需要修正':'自定义结构待复核',
    reason,suggestion:code==='SHORT_SEGMENT'?'可尝试调整轮廓以减少边缘短段，再重新检查；是否需要加固由 B 依据试编记录确认。':code==='WIDTH_PITCH'?'可尝试减小竹条宽度或减少条数后重新检查；调整后仍需 B 确认工艺适用性。':status==='failed'?'返回编辑修正轮廓或参数，再重新检查。':'请 D 核对结构能力范围，并由 B 确认当前形状和参数适用的工艺。',
    location:{path,...(positionMm?{positionMm}:{}),...(path.match(/^[VH]\d+-S\d+$/)?{stripId:path,segmentId:path}:{})},
    evidence:{reference:code==='SHORT_SEGMENT'?'data/WEAVE_SPEC_V1_2.json#edgeAcceptanceRules.shortStrip':'docs/handoffs/D_CUSTOM_SHAPE_STRUCTURE_DELIVERY.md',verification:'engineering-only'}} satisfies CraftIssue);
  if(result.status==='blocked'){
    add(result.code,'shape',result.message,['HOLES_UNSUPPORTED','MULTIPLE_COMPONENTS_UNSUPPORTED'].includes(result.code)?'pending':'failed');
    return {status:issues.some(x=>x.status==='failed')?'failed' as const:'pending' as const,issues,evaluatedRuleIds};
  }
  const d=result.snapshot;
  if(d.designId!==input.designId || d.designRevision!==input.designRevision || d.generatedFromRevision!==input.designRevision
    || d.confirmedGenerationId!==input.confirmedGenerationId || d.shapeId!==input.shape.shapeId
    || d.weave.id!==input.weaveId || Object.keys(input.parameters).some(k=>d.parameters[k as keyof typeof d.parameters]!==input.parameters[k as keyof typeof input.parameters]))add('SOURCE','source','结构快照与当前形状、参数、编法或设计版本不一致。');
  const s=d.coordinateSpace;
  if(s.unit!=='mm'||s.width!==210||s.height!==297||s.origin!=='topLeft'||s.xAxis!=='right'||s.yAxis!=='down')add('COORDINATES','coordinateSpace','需要 210×297 mm、左上原点的坐标空间。');
  if(input.shape.components.length!==1||input.shape.components[0].holes.length){
    add('UNSUPPORTED_TOPOLOGY','shape','带孔或多连通形状不能使用当前单轮廓结构结果。','pending');
    return{status:issues.some(x=>x.status==='failed')?'failed' as const:'pending' as const,issues,evaluatedRuleIds};
  }
  const raw=input.shape.components[0].outerBoundary;
  if(!raw.closed||raw.pointsMm.length<4||!raw.pointsMm.every(finitePoint)
    ||!near(raw.pointsMm[0].x,raw.pointsMm.at(-1)!.x)||!near(raw.pointsMm[0].y,raw.pointsMm.at(-1)!.y)){
    add('BOUNDARY','shape','输入轮廓必须闭合且包含有效点。');return{status:'failed' as const,issues,evaluatedRuleIds};
  }
  const points=raw.pointsMm.slice(0,-1),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  const area=Math.abs(points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%points.length].y-points[(i+1)%points.length].x*p.y,0))/2;
  if(area<1e-5||selfIntersects(points)){
    add('TOPOLOGY','shape','轮廓自交或面积为零，不能作为有效结构检查。');return{status:'failed' as const,issues,evaluatedRuleIds};
  }
  const scale=input.parameters.shapeScale,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const expected=points.map(p=>({x:cx+(p.x-cx)*scale,y:cy+(p.y-cy)*scale}));
  if(!Number.isFinite(scale)||scale<=0||d.boundary.length!==expected.length||!d.boundary.every((p,i)=>finitePoint(p)&&near(p.x,expected[i].x)&&near(p.y,expected[i].y)))add('BOUNDARY','boundary','缩放后轮廓与当前输入不一致。');
  if(expected.some(p=>p.x<0||p.x>210||p.y<0||p.y>297))add('PAGE_BOUNDS','boundary','当前缩放使轮廓超出页面坐标范围。');
  const count=Math.round(input.parameters.density),width=input.parameters.stripWidthMm;
  if(!Number.isInteger(input.parameters.density)||count<2||count>100||!Number.isFinite(width)||width<=0){
    add('PARAMETERS','parameters','数量需为 2～100 的整数，宽度需为正数；100 为本地检查计算上限。');return{status:'failed' as const,issues,evaluatedRuleIds};
  }
  const xmin=Math.min(...expected.map(p=>p.x)),xmax=Math.max(...expected.map(p=>p.x)),ymin=Math.min(...expected.map(p=>p.y)),ymax=Math.max(...expected.map(p=>p.y));
  const expectedSegments=new Map<string,{start:Point;end:Point;direction:'warp'|'weft';axis:number;axisIndex:number;segmentIndex:number;pitch:number}>();
  for(const direction of ['warp','weft'] as const){
    const vertical=direction==='warp',lo=vertical?xmin:ymin,hi=vertical?xmax:ymax,pitch=(hi-lo)/count;
    for(let i=0;i<count;i++){
      const axis=Math.round((lo+(hi-lo)*(i+.5)/count)*1e4)/1e4;
      intervals(expected,axis,vertical).forEach(([a,b],j)=>expectedSegments.set(`${vertical?'V':'H'}${String(i+1).padStart(3,'0')}-S${String(j+1).padStart(2,'0')}`,
        {start:vertical?{x:axis,y:a}:{x:a,y:axis},end:vertical?{x:axis,y:b}:{x:b,y:axis},direction,axis,axisIndex:i,segmentIndex:j,pitch}));
    }
    if(pitch<width)add('WIDTH_PITCH',direction,'竹条宽度大于该方向中心间距；重叠结构需要 B 确认适用性。','pending');
  }
  const strips=new Map(d.strips.list.map(strip=>[strip.id,strip]));
  if(strips.size!==d.strips.list.length||strips.size!==expectedSegments.size)add('STRIP_IDS','strips','竹条段重复、缺失或多出。');
  for(const strip of d.strips.list){
    const e=expectedSegments.get(strip.id);
    if(!e||strip.direction!==e.direction||strip.axisIndex!==e.axisIndex||strip.segmentIndex!==e.segmentIndex||!near(strip.axisMm,e.axis)
      ||!near(strip.widthMm,width)||!near(strip.startMm.x,e.start.x)||!near(strip.startMm.y,e.start.y)||!near(strip.endMm.x,e.end.x)||!near(strip.endMm.y,e.end.y)
      ||!near(strip.geometryLengthMm,Math.hypot(e.end.x-e.start.x,e.end.y-e.start.y)))add('STRIP_GEOMETRY',strip.id,'竹条段编号、方向、裁切端点或长度与轮廓求交不一致。','failed',strip.startMm);
    if(e && strip.geometryLengthMm<2*e.pitch)add('SHORT_SEGMENT',strip.id,'可见段短于两倍中心间距，需复核边缘加固；该工程阈值仍待实物验证。','pending',strip.startMm);
  }
  const matrix=resolveWeaveSpec(input.weaveId).topLayerMatrix;
  if(d.weave.rule!==resolveWeaveSpec(input.weaveId).craftRuleVersion)add('WEAVE_VERSION','weave.rule','编法规则版本与当前规则表不一致。');
  const crossings=new Map(d.interlace.crossings.map(c=>[c.id,c]));
  if(crossings.size!==d.interlace.crossings.length)add('CROSSING_IDS','interlace','交点编号重复。');
  let expectedCrossings=0;
  for(const [warpId,w] of expectedSegments)if(w.direction==='warp')for(const [weftId,h] of expectedSegments)if(h.direction==='weft'
    &&h.axis>=w.start.y-1e-5&&h.axis<=w.end.y+1e-5&&w.axis>=h.start.x-1e-5&&w.axis<=h.end.x+1e-5){
    expectedCrossings++;const id=`X-${warpId}-${weftId}`,c=crossings.get(id),top=matrix[h.axisIndex%matrix.length][w.axisIndex%matrix[0].length]==='W'?'weft':'warp';
    if(!c||c.warpStripId!==warpId||c.weftStripId!==weftId||!near(c.positionMm.x,w.axis)||!near(c.positionMm.y,h.axis)||c.top!==top)
      add('CROSSING',id,'交点引用、位置或挑压关系不符合当前轮廓及编法矩阵。','failed',{x:w.axis,y:h.axis});
  }
  if(expectedCrossings!==crossings.size)add('CROSSING_COUNT','interlace','交点数量不完整或包含轮廓外交点。');
  return{status:issues.some(x=>x.status==='failed')?'failed' as const:'passed' as const,issues,evaluatedRuleIds};
}
