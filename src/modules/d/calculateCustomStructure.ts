import type { Candidate, CarrierShape, Point } from '../../model';
import type { CustomCrossing, CustomStrip, CustomStructureInput, CustomStructureResult } from './customTypes';

const EPSILON = 1e-7;
const roundMm = (value: number) => Math.round(value * 10000) / 10000;
const samePoint = (a: Point, b: Point) => Math.abs(a.x-b.x)<EPSILON && Math.abs(a.y-b.y)<EPSILON;
const orientation = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function onSegment(a: Point,b: Point,p: Point){return Math.abs(orientation(a,b,p))<EPSILON&&p.x>=Math.min(a.x,b.x)-EPSILON&&p.x<=Math.max(a.x,b.x)+EPSILON&&p.y>=Math.min(a.y,b.y)-EPSILON&&p.y<=Math.max(a.y,b.y)+EPSILON;}
function segmentsIntersect(a: Point,b: Point,c: Point,d: Point){const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);if(((o1>EPSILON&&o2<-EPSILON)||(o1<-EPSILON&&o2>EPSILON))&&((o3>EPSILON&&o4<-EPSILON)||(o3<-EPSILON&&o4>EPSILON)))return true;return(Math.abs(o1)<EPSILON&&onSegment(a,b,c))||(Math.abs(o2)<EPSILON&&onSegment(a,b,d))||(Math.abs(o3)<EPSILON&&onSegment(c,d,a))||(Math.abs(o4)<EPSILON&&onSegment(c,d,b));}
function isSelfIntersecting(points: Point[]){for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i+1||(i===0&&j===points.length-1))continue;if(segmentsIntersect(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return true;}return false;}
function polygonArea(points: Point[]){return Math.abs(points.reduce((sum,p,i)=>{const n=points[(i+1)%points.length];return sum+p.x*n.y-n.x*p.y;},0)/2);}
function lineIntervals(points: Point[],axis: number,vertical: boolean){const values:number[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],aa=vertical?a.x:a.y,bb=vertical?b.x:b.y;if((aa<=axis&&bb>axis)||(bb<=axis&&aa>axis)){const t=(axis-aa)/(bb-aa);values.push((vertical?a.y:a.x)+t*((vertical?b.y:b.x)-(vertical?a.y:a.x)));}}values.sort((a,b)=>a-b);const result:[number,number][]=[];for(let i=0;i+1<values.length;i+=2)if(values[i+1]-values[i]>EPSILON)result.push([values[i],values[i+1]]);return result;}
const insideSegment=(value:number,start:number,end:number)=>value>=Math.min(start,end)-EPSILON&&value<=Math.max(start,end)+EPSILON;

export function adaptConfirmedCustomCandidate(candidate: Candidate,options: Omit<CustomStructureInput,'schemaVersion'|'confirmedGenerationId'|'shape'|'generationIssues'|'weaveId'>):CustomStructureInput{
  if(candidate.status!=='succeeded'||candidate.resultType!=='carrier_shape')throw new Error('CUSTOM_SHAPE_NOT_CONFIRMED');
  if(candidate.issues.some(issue=>issue.severity==='blocking'))throw new Error('CUSTOM_SHAPE_HAS_BLOCKING_ISSUE');
  return{schemaVersion:'0.2',confirmedGenerationId:candidate.generationId,shape:candidate.result as CarrierShape,generationIssues:candidate.issues,weaveId:'CROSS-1X1-V1',...options};
}

export function calculateCustomStructure(input:CustomStructureInput):CustomStructureResult{
  const{shape,parameters}=input,space=shape.coordinateSpace;
  if(space.unit!=='mm'||space.width!==210||space.height!==297||space.origin!=='topLeft'||space.xAxis!=='right'||space.yAxis!=='down')return{status:'blocked',code:'UNSUPPORTED_COORDINATE_SPACE',message:'仅支持 210×297 mm、左上原点的坐标空间。'};
  if(shape.components.length!==1)return{status:'blocked',code:'MULTIPLE_COMPONENTS_UNSUPPORTED',message:'首版仅支持单个连通的自定义轮廓。'};
  const component=shape.components[0];
  if(component.holes.length)return{status:'blocked',code:'HOLES_UNSUPPORTED',message:'首版尚不支持孔洞，未生成伪结构。'};
  const raw=component.outerBoundary.pointsMm;
  if(!component.outerBoundary.closed||raw.length<4||!samePoint(raw[0],raw[raw.length-1]))return{status:'blocked',code:'OPEN_BOUNDARY',message:'轮廓未闭合，不能进入结构计算。'};
  const points=raw.slice(0,-1);
  if(points.length<3||polygonArea(points)<EPSILON)return{status:'blocked',code:'INVALID_BOUNDARY',message:'轮廓面积为零或点位无效。'};
  if(isSelfIntersecting(points))return{status:'blocked',code:'SELF_INTERSECTION',message:'轮廓存在自交，不能生成可核对的竹条结构。'};
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2,scale=parameters.shapeScale;
  const boundary=points.map(p=>({x:roundMm(centerX+(p.x-centerX)*scale),y:roundMm(centerY+(p.y-centerY)*scale)}));
  const scaledMinX=Math.min(...boundary.map(p=>p.x)),scaledMaxX=Math.max(...boundary.map(p=>p.x)),scaledMinY=Math.min(...boundary.map(p=>p.y)),scaledMaxY=Math.max(...boundary.map(p=>p.y));
  if(scaledMaxX-scaledMinX<=parameters.stripWidthMm||scaledMaxY-scaledMinY<=parameters.stripWidthMm)return{status:'blocked',code:'SHAPE_TOO_NARROW_FOR_STRIP',message:'轮廓尺寸小于竹条宽度，未生成伪结构。'};
  const density=Math.max(2,Math.round(parameters.density)),strips:CustomStrip[]=[];
  for(let i=0;i<density;i++){const x=roundMm(scaledMinX+(scaledMaxX-scaledMinX)*(i+.5)/density);lineIntervals(boundary,x,true).forEach(([start,end],segmentIndex)=>strips.push({id:`V${String(i+1).padStart(3,'0')}-S${String(segmentIndex+1).padStart(2,'0')}`,direction:'warp',axisIndex:i,segmentIndex,axisMm:x,widthMm:parameters.stripWidthMm,color:parameters.warpColor,startMm:{x,y:roundMm(start)},endMm:{x,y:roundMm(end)},geometryLengthMm:roundMm(end-start)}));}
  for(let i=0;i<density;i++){const y=roundMm(scaledMinY+(scaledMaxY-scaledMinY)*(i+.5)/density);lineIntervals(boundary,y,false).forEach(([start,end],segmentIndex)=>strips.push({id:`H${String(i+1).padStart(3,'0')}-S${String(segmentIndex+1).padStart(2,'0')}`,direction:'weft',axisIndex:i,segmentIndex,axisMm:y,widthMm:parameters.stripWidthMm,color:parameters.weftColor,startMm:{x:roundMm(start),y},endMm:{x:roundMm(end),y},geometryLengthMm:roundMm(end-start)}));}
  const warps=strips.filter(s=>s.direction==='warp'),wefts=strips.filter(s=>s.direction==='weft'),crossings:CustomCrossing[]=[];
  for(const warp of warps)for(const weft of wefts)if(insideSegment(weft.axisMm,warp.startMm.y,warp.endMm.y)&&insideSegment(warp.axisMm,weft.startMm.x,weft.endMm.x))crossings.push({id:`X-${warp.id}-${weft.id}`,warpStripId:warp.id,weftStripId:weft.id,positionMm:{x:warp.axisMm,y:weft.axisMm},top:(warp.axisIndex+weft.axisIndex)%2===0?'weft':'warp'});
  return{status:'ok',snapshot:{schemaVersion:'0.2',designId:input.designId,designRevision:input.designRevision,generatedFromRevision:input.designRevision,confirmedGenerationId:input.confirmedGenerationId,shapeId:shape.shapeId,coordinateSpace:space,boundary,weave:{id:input.weaveId,rule:'over-under-1-1'},parameters,strips:{list:strips},interlace:{crossings},craft:{status:'pending',pendingReason:'自定义形状的最小窄颈、残段和边缘收边规则待 B 组验证。'}}};
}
