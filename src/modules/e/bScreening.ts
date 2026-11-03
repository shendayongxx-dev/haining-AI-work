import carriers from '../../../data/CARRIER_SPEC_V1_2.json';
import {B_RULES} from './craftRules';
import type {CraftInput,CraftIssue} from './craftTypes';
const tolerance=carriers.geometryTolerance.intersectionToleranceMm;
function geometryEqual(a:unknown,b:unknown):boolean{
  if(typeof b==='number')return typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
  if(Array.isArray(b))return Array.isArray(a)&&a.length===b.length&&b.every((x,i)=>geometryEqual(a[i],x));
  if(b&&typeof b==='object')return !!a&&typeof a==='object'&&Object.entries(b).filter(([k])=>k!=='derivation').every(([k,v])=>geometryEqual((a as Record<string,unknown>)[k],v));
  return a===b;
}
export function screenBContext(input:CraftInput):CraftIssue[]{
  const issues:CraftIssue[]=[];
  const add=(ruleId:string,reason:string,suggestion:string,status:'failed'|'pending',path:string)=>issues.push({
    id:`B13-${ruleId}-${path}`,ruleId,domain:ruleId==='UNSUPPORTED_WEAVE'?'craft':status==='failed'?'structure':'evidence',status,title:status==='failed'?'当前设计需要修改':'还需补充制作依据',reason,suggestion,
    location:{path},evidence:{reference:`data/b-craft-v1.5/01_工艺检查规则与适用范围.md#${ruleId}`,verification:status==='failed'?'engineering-only':'missing'}});
  const weaveId=input.kind==='fixed-fan'?input.snapshot.weaveId:input.input.weaveId;
  if(weaveId&&!B_RULES.scope.weaveIds.includes(weaveId))add('UNSUPPORTED_WEAVE','当前编法尚无制作检查规则。','返回编辑选择十字编、人字编或四角孔编；平编目前仅供预览。','failed','weaveId');
  if(input.kind==='custom'){
    // Do not invent an effective area, raw blank or handle declaration absent from D v0.2.
    add('CUSTOM_CONTEXT_COMPLETE','当前自定义 D v0.2 快照未提供正式有效图样区、毛坯边界和连接结构声明。','请 A/D 对齐这些上下文字段；不要把外轮廓直接当有效区或毛坯。','pending','customContext');
    add('CUSTOM_HANDLE_CONTEXT','尚未明确当前形状有无手柄／连接结构。','请 A/C/D 明确无手柄，或提供柄口、禁入和加固区域。','pending','handleContext');
    return issues;
  }
  const d=input.snapshot,authority=carriers.carriers.find(c=>c.carrierId===d.carrierId);
  if(!d.carrierId||!d.carrierSpecVersion){add('INPUT_REQUIRED_FIELDS','缺少载体 ID 或规范版本。','请补齐载体来源字段。','pending','carrierId');return issues;}
  if(!authority||d.carrierSpecVersion!==carriers.carrierSpecVersion){
    add('FIXED_CARRIER_ID_MATCH','当前载体与设计记录不一致。','请返回载体选择页，重新选择已开放的扇面。','failed','carrierId');return issues;
  }
  for(const [field,reference] of [['boundary',authority.boundary],['effectivePatternBoundary',authority.effectivePatternBoundary],['handleExclusion',authority.handleExclusion]] as const){
    const value=d.carrierGeometry?.[field];
    if(value===undefined||value===null)add('INPUT_REQUIRED_FIELDS',`缺少 ${field}。`,'请 D 提供该载体的完整权威几何字段。','pending',`carrierGeometry.${field}`);
    else if(!geometryEqual(value,reference))add('BOUNDARY_GEOMETRY_MATCH',`${field} 与 B 权威 JSON 不一致（几何容差 ${tolerance} mm）。`,'恢复 B 正式边界、有效区及手柄区；不可按预览图片重新描摹。','failed',`carrierGeometry.${field}`);
  }
  const raw=d.stages?.rawBlank?.boundary as {type?:string;x:number;y:number;width:number;height:number}|undefined;
  if(!raw)add('INPUT_REQUIRED_FIELDS','缺少毛坯边界。','请 D 补齐毛坯边界后重新检查。','pending','stages.rawBlank.boundary');
  else {
    const b=authority.boundary as {type:'circle';cx:number;cy:number;r:number}|{type:'ellipse';cx:number;cy:number;rx:number;ry:number}|{type:'polygon';pointsMm:number[][]};
    const bounds=b.type==='circle'?[b.cx-b.r,b.cy-b.r,b.cx+b.r,b.cy+b.r]:b.type==='ellipse'?[b.cx-b.rx,b.cy-b.ry,b.cx+b.rx,b.cy+b.ry]:[
      Math.min(...b.pointsMm.map(p=>p[0])),Math.min(...b.pointsMm.map(p=>p[1])),Math.max(...b.pointsMm.map(p=>p[0])),Math.max(...b.pointsMm.map(p=>p[1]))];
    if(raw.type!=='rect'||![raw.x,raw.y,raw.width,raw.height].every(Number.isFinite)||raw.width<=0||raw.height<=0
      ||raw.x>bounds[0]+tolerance||raw.y>bounds[1]+tolerance||raw.x+raw.width<bounds[2]-tolerance||raw.y+raw.height<bounds[3]-tolerance)
      add('RAW_BLANK_COVERS_BOUNDARY','毛坯未覆盖当前正式外轮廓。','扩大毛坯覆盖完整外轮廓，再由 D 重算结构。','failed','stages.rawBlank.boundary');
  }
  if(d.weaveId==='SQUARE-HOLE-1X1-V1')add('SQUARE_HOLE_PARAMETER_EVIDENCE','B 明确四角孔 9/6/15 mm 参数组合仍缺实物适配记录。','请 B 补充实际竹篾尺寸、净孔、节距与收边的测量和试编记录；当前参数仅作结构检查。','pending','grid');
  return issues;
}
