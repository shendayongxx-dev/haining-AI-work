import carrier from '../../../data/CARRIER_SPEC_V1_2.json';
import weave from '../../../data/WEAVE_SPEC_V1_2.json';
import { resolveWeaveSpec } from '../d/v03/weaveRegistry';
import { consumeV03 } from './v03/consume.mjs';
import { checkCustomStructure } from './validateCustom';
import { ENGINE_VERSION, RULE_SET_VERSION, evidenceRequirements, customEvidenceRequirement } from './craftRules';
import type { CraftInput, CraftIssue, CraftResult, CraftStatus } from './craftTypes';
export type { CraftInput, CraftIssue, CraftResult } from './craftTypes';

function stable(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
  return JSON.stringify(value)??'null';
}
export async function craftInputDigest(input:CraftInput):Promise<string>{
  const bytes=new TextEncoder().encode(stable({input,ruleData:{carrier,weave},engineVersion:ENGINE_VERSION,ruleSetVersion:RULE_SET_VERSION}));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function aggregateCraftStatus(issues:Pick<CraftIssue,'status'>[],coverageComplete:boolean):CraftStatus {
  return issues.some(x=>x.status==='failed')?'failed':!coverageComplete||issues.some(x=>x.status==='pending')?'pending':'passed';
}
export function acceptCraftResult(currentDigest:string,incoming:CraftResult,previous:CraftResult|null=null):CraftResult|null {
  return incoming.engineVersion===ENGINE_VERSION && incoming.ruleSetVersion===RULE_SET_VERSION && incoming.inputDigest===currentDigest?incoming:previous;
}
function structureIssue(code:string,path:string,reason:string):CraftIssue {
  return {id:`E-STRUCTURE-${code}-${path}`,ruleId:`E-STRUCTURE-${code}`,domain:'structure',status:'failed',
    title:'结构数据需要修正',reason,suggestion:'返回编辑调整参数并重新检查；若问题仍在，请将对象编号与错误原因交给 D 核对。',
    location:{path},evidence:{reference:'E independent structural checks',verification:'engineering-only'}};
}
export async function validateCraft(input:CraftInput):Promise<CraftResult>{
  const issues:CraftIssue[]=[],evaluatedRuleIds:string[]=[];
  let structuralStatus:CraftResult['structuralStatus']='passed';
  const context=input.kind==='fixed-fan'?input.current:input.input;
  try {
    if(input.kind==='fixed-fan'){
      const d=input.snapshot, resolved=resolveWeaveSpec(d.weaveId);
      const result=consumeV03(d,{carrier,weave:{...weave,weaveSpecVersion:resolved.weaveSpecVersion,weaves:[resolved]}});
      if(d.designId!==context.designId || d.designRevision!==context.designRevision || d.confirmedGenerationId!==context.confirmedGenerationId)
        issues.push(structureIssue('CURRENT_SOURCE','sourceKey','快照不属于当前设计、版本或已确认生成结果。'));
      for(const e of result.errors){
        const issue=structureIssue(e.code,e.path,e.message);
        const crossing=d.stages.rawBlank.crossings.find(c=>c.crossingId===e.path);
        const strip=d.strips.find(s=>s.stripId===e.path || e.path.startsWith(s.stripId+'/'));
        if(crossing)issue.location={path:e.path,crossingId:crossing.crossingId,positionMm:crossing.positionMm};
        else if(strip)issue.location={path:e.path,stripId:strip.stripId,positionMm:strip.rawBlankSegment.startMm};
        issues.push(issue);
      }
      evaluatedRuleIds.push(...result.checks.map(c=>'E-STRUCTURE-'+c.id));
      for(const w of d.engineeringWarnings)issues.push({id:w.warningId,ruleId:w.code,domain:'craft',status:'pending',
        title:'工程风险待工艺复核',reason:w.message,suggestion:'请 B 核对该位置的边缘、加固或连接要求；不能将待复核预警直接判为工艺不合格。',
        location:{path:'engineeringWarnings',...(w.stripId?{stripId:w.stripId}:{}),...(w.segmentId?{segmentId:w.segmentId}:{}),
          ...(w.crossingIds?.[0]?{crossingId:w.crossingIds[0]}:{}),...(w.positionMm?{positionMm:w.positionMm}:{})},
        evidence:{reference:w.ruleSource,verification:'engineering-only'}});
    }else{
      if(input.input.generationIssues.some(x=>x.severity==='blocking'))issues.push(structureIssue('UPSTREAM_BLOCKED','generationIssues','当前 C 形状存在阻断问题，请返回输入并重新确认结果。'));
      const checked=checkCustomStructure(input.input,input.result);
      issues.push(...checked.issues);evaluatedRuleIds.push(...checked.evaluatedRuleIds);
      structuralStatus=checked.status;
    }
  }catch(error){issues.push(structureIssue('INVALID_INPUT','snapshot',`无法读取结构：${error instanceof Error?error.message:String(error)}`));}
  if(issues.some(x=>x.domain==='structure'&&x.status==='failed'))structuralStatus='failed';
  const requirements=input.kind==='custom'?[...evidenceRequirements,customEvidenceRequirement]:evidenceRequirements;
  for(const r of requirements)issues.push({id:r.id,ruleId:r.id,domain:'evidence',status:'pending',title:r.title,
    reason:'当前没有登记覆盖本设计的 B 规则确认及实物验收依据。',suggestion:r.request,location:{path:input.kind},
    evidence:{reference:'docs/handoffs/E_CRAFT_B_EVIDENCE_REQUEST.md',verification:'missing'}});
  // No B-verified acceptance registry exists yet. Zero warnings never imply full craft coverage.
  const coverageComplete=false;
  return {schemaVersion:'E-CRAFT-0.1',engineVersion:ENGINE_VERSION,ruleSetVersion:RULE_SET_VERSION,
    designId:context.designId,designRevision:context.designRevision,kind:input.kind,status:aggregateCraftStatus(issues,coverageComplete),
    structuralStatus,sourceKey:input.kind==='fixed-fan'?structuredClone(input.snapshot.sourceKey):null,
    inputDigest:await craftInputDigest(input),issues,evaluatedRuleIds,
    physicalValidation:'not-completed',formalMaterialsAllowed:false,tutorialAllowed:false,exportAllowed:false};
}
