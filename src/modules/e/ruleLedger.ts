import {B_RULES,B_RULE_SET_VERSION,EVIDENCE_SET_VERSION,ENGINE_VERSION} from './craftRules';
import type {CraftDiagnostics,CraftInput,CraftIssue,CraftResult,RuleResult,RuleStatus,RuleSummary,ScreeningResult,Basis} from './craftTypes';
import {shaValue,stableValue} from './assessmentIdentity';
import Ajv2020 from 'ajv/dist/2020.js';
import resultSchema from '../../../data/b-craft-v1.5/schemas/craft_check_result.schema.json';
const validateSchema=new Ajv2020({allErrors:true}).compile(resultSchema);

const aliases=new Map<string,string>(B_RULES.rules.flatMap(r=>[...('aliases' in r?r.aliases??[]:[])].map(a=>[a,r.ruleId] as [string,string])));
const ruleTitles:Record<string,string>={INPUT_REQUIRED_FIELDS:'输入与结构条件',FIXED_CARRIER_ID_MATCH:'载体与规范版本',BOUNDARY_GEOMETRY_MATCH:'载体边界与区域',
  CUSTOM_CONTEXT_COMPLETE:'自定义形状上下文',CUSTOM_BOUNDARY_CLOSED:'轮廓与有效区闭合',CUSTOM_BOUNDARY_SIMPLE:'轮廓合法性',EFFECTIVE_BOUNDARY_INSIDE:'图样有效区范围',
  RAW_BLANK_COVERS_BOUNDARY:'毛坯覆盖范围',OUTER_BASE_WEAVE_CONTINUITY:'外侧基础编织连续性',WEAVE_MATRIX_MATCH:'编法与交织关系',STRIP_ID_TRACEABLE:'竹条与交点追溯',
  COLOR_SEGMENT_COVERAGE:'颜色分段覆盖',HANDLE_MOTIF_EXCLUSION:'重点图案与柄区避让',SHORT_VISIBLE_SEGMENT:'边缘短段复核',OPEN_HALF_HOLE_AT_EDGE:'边缘开放半孔复核',
  CORNER_OR_VALLEY_REINFORCEMENT:'转角与凹谷加固',HANDLE_REINFORCEMENT_REQUIRED:'柄口连接加固',EDGE_FINISH_EVIDENCE:'收边验证依据',SQUARE_HOLE_PARAMETER_EVIDENCE:'四角孔参数依据',UNSUPPORTED_WEAVE:'当前编法适用范围'};
export function canonicalRuleId(id:string):string{
  if(aliases.has(id))return aliases.get(id)!;
  if(B_RULES.rules.some(r=>r.ruleId===id)||id==='UNSUPPORTED_WEAVE')return id;
  if(id.startsWith('E-STRUCTURE-')){
    const code=id.slice(12);
    if(/^(COLOR|MOTIF|BASE_SOURCE)/.test(code))return 'COLOR_SEGMENT_COVERAGE';
    if(/^(WEAVE_MATRIX|OP_ACTION|OP_SEQUENCE)/.test(code))return 'WEAVE_MATRIX_MATCH';
    if(/^(OUTER)/.test(code))return 'OUTER_BASE_WEAVE_CONTINUITY';
    if(/^(STRIP|DUPLICATE_STRIP|SEGMENT|DUPLICATE_SEGMENT|CROSSING|DUPLICATE_CROSSING|DUPLICATE_PAIR|INVISIBLE_SEGMENT|VISIBLE_CROSSING|OP_REFERENCE|OP_SEGMENT|OP_COVERAGE|OP_DUPLICATE|RAW_LENGTH|GRID_)/.test(code))return 'STRIP_ID_TRACEABLE';
    return 'INPUT_REQUIRED_FIELDS';
  }
  if(id.startsWith('E-CUSTOM-')){
    const code=id.slice(9);
    if(code==='SHORT_SEGMENT')return 'SHORT_VISIBLE_SEGMENT';
    if(code==='TOPOLOGY')return 'CUSTOM_BOUNDARY_SIMPLE';
    if(code==='BOUNDARY')return 'CUSTOM_BOUNDARY_CLOSED';
    if(code.startsWith('CROSSING'))return 'WEAVE_MATRIX_MATCH';
    if(code.startsWith('STRIP'))return 'STRIP_ID_TRACEABLE';
    if(code==='UNSUPPORTED_TOPOLOGY'||code==='HOLES_UNSUPPORTED'||code==='MULTIPLE_COMPONENTS_UNSUPPORTED')return 'CUSTOM_CONTEXT_COMPLETE';
    return 'INPUT_REQUIRED_FIELDS';
  }
  return 'INPUT_REQUIRED_FIELDS';
}
export function summarizeRules(rows:RuleResult[]):RuleSummary{
  const counts={passedCount:0,failedCount:0,pendingCount:0,notApplicableCount:0};
  for(const row of rows){if(row.status==='passed')counts.passedCount++;else if(row.status==='failed')counts.failedCount++;else if(row.status==='pending')counts.pendingCount++;else counts.notApplicableCount++;}
  return counts;
}
export function aggregateRules(rows:RuleResult[]):'passed'|'failed'|'pending'{
  const active=rows.filter(r=>r.participatesInAggregate);
  return active.some(r=>r.status==='failed')?'failed':!active.length||active.some(r=>r.status==='pending')?'pending':'passed';
}
function basis(ruleId:string):Basis{
  const r=B_RULES.rules.find(r=>r.ruleId===ruleId);
  return {documentId:r?.basis??B_RULE_SET_VERSION,rulePath:ruleId,evidenceLevel:(r?.evidenceLevel??'documented') as Basis['evidenceLevel'],evidenceRecordIds:[]};
}
/** One canonical record per rule. An absent implementation remains pending, never an implicit pass. */
export async function finalizeCraftResult(input:CraftInput,raw:CraftDiagnostics):Promise<CraftResult>{
  const grouped=new Map<string,CraftIssue[]>();
  for(const issue of raw.issues){const id=canonicalRuleId(issue.ruleId);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id)!.push(issue);}
  const fixed=input.kind==='fixed-fan',d=fixed?input.snapshot:null;
  const weaveId=fixed?input.snapshot.weaveId:input.input.weaveId;
  const supported=B_RULES.scope.weaveIds.includes(weaveId);
  const evaluated=new Set(raw.evaluatedRuleIds);
  const fixedConsumed=(id:string)=>evaluated.has('E-STRUCTURE-'+id);
  const customOk=input.kind==='custom'&&input.result.status==='ok'&&raw.structuralStatus==='passed';
  function decision(id:string):[RuleStatus,string]{
    const faults=grouped.get(id)??[];
    if(faults.some(i=>i.status==='failed'))return ['failed',[...new Set(faults.filter(i=>i.status==='failed').map(i=>i.reason))].join('；')];
    if(fixed&&id.startsWith('CUSTOM_'))return ['notApplicable','当前为固定载体，此自定义规则不适用。'];
    if(!fixed&&['FIXED_CARRIER_ID_MATCH','BOUNDARY_GEOMETRY_MATCH'].includes(id))return ['notApplicable','当前为自定义形状，固定载体规范规则不适用。'];
    if(id==='OPEN_HALF_HOLE_AT_EDGE'||id==='SQUARE_HOLE_PARAMETER_EVIDENCE'){
      if(weaveId!=='SQUARE-HOLE-1X1-V1')return ['notApplicable','当前编法不是四角孔编。'];
    }
    if(id==='WEAVE_MATRIX_MATCH'&&!supported)return ['notApplicable','编法超出本版检查范围，使用 UNSUPPORTED_WEAVE 单独报告。'];
    if(id==='CORNER_OR_VALLEY_REINFORCEMENT'&&d){
      const shape=d.carrierGeometry?.boundary as {type?:string};
      if(shape?.type==='circle'||shape?.type==='ellipse')return ['notApplicable','当前正式外轮廓为圆或椭圆，没有多边形转角或瓣谷。'];
    }
    if(faults.length)return ['pending',[...new Set(faults.map(i=>i.reason))].join('；')];
    switch(id){
      case 'INPUT_REQUIRED_FIELDS':
        if(fixedConsumed('source-key-and-specifications')||customOk)return ['passed','当前可消费结构的基础来源和必要字段已复核；自定义完整上下文另行记录。'];break;
      case 'FIXED_CARRIER_ID_MATCH':case 'BOUNDARY_GEOMETRY_MATCH':
        if(d&&raw.structuralStatus==='passed')return ['passed','已按 B 正式载体 ID、规范和几何进行独立比较。'];break;
      case 'CUSTOM_BOUNDARY_SIMPLE':
        if(customOk)return ['passed','现有外轮廓已执行自交、零面积及非相邻重合检查。'];break;
      case 'CUSTOM_BOUNDARY_CLOSED':return ['pending','现有外轮廓可以复核，但缺少独立有效区，尚不能完成外轮廓与有效区均闭合的必检条件。'];
      case 'EFFECTIVE_BOUNDARY_INSIDE':
        if(d&&raw.structuralStatus==='passed')return ['passed','正式外轮廓和有效区均与 B 锁定且内含的规范几何一致。'];break;
      case 'RAW_BLANK_COVERS_BOUNDARY':
        if(d?.stages.rawBlank.boundary&&raw.structuralStatus==='passed')return ['passed','已以边界极值复核矩形毛坯覆盖正式外轮廓。'];break;
      case 'OUTER_BASE_WEAVE_CONTINUITY':
        if(fixedConsumed('outer-base-and-accounting-contract')&&raw.structuralStatus==='passed')return ['pending','已复核连续性合同、全局身份与相位；D 当前颜色段采用 0.5 mm 采样，有效区边缘的分区精度合同尚未确认，不将合同声明等同于精确分区已通过。'];break;
      case 'WEAVE_MATRIX_MATCH':
        if((fixedConsumed('crossings-bidirectional-links-and-matrix')&&fixedConsumed('weaving-steps-consumption')&&raw.structuralStatus==='passed')||customOk)
          return ['passed','已按当前 weaveId 的矩阵独立复核现有交点及挑压关系。'];break;
      case 'STRIP_ID_TRACEABLE':
        if(fixedConsumed('strip-identities-and-material-fields')&&fixedConsumed('crossings-bidirectional-links-and-matrix')&&raw.structuralStatus==='passed')return ['passed','原竹条、可见段、交点的正反向引用完整。'];
        if(!fixed)return ['pending','自定义 v0.2 只有裁切段身份，缺少原竹篾到多段的正式映射。'];break;
      case 'COLOR_SEGMENT_COVERAGE':
        if(fixedConsumed('segments-colors-and-boundary')&&raw.structuralStatus==='passed')return ['passed','可见段颜色连续覆盖及来源已复核。'];
        if(!fixed)return ['pending','自定义 v0.2 未提供可按 v0.3 语义检查的颜色分段。'];break;
      case 'SHORT_VISIBLE_SEGMENT':
        if(d&&d.strips.some(s=>s.visibleSegments.some(seg=>seg.lengthMm<2*s.pitchMm)))return ['pending','E 独立检出短于两倍节距的可见段，需复核加固；工程阈值仍待实物验证。'];
        if(raw.structuralStatus==='passed')return ['passed','当前工程筛查未检出短于两倍中心间距的段；不代表实物安全阈值已验证。'];break;
      case 'HANDLE_MOTIF_EXCLUSION':return ['pending','尚无重点图案边界或明确无重点图案的输入合同，不能推断不适用。'];
      case 'HANDLE_REINFORCEMENT_REQUIRED':return ['pending',fixed?'正式载体包含柄区，加固验收尚缺实物记录。':'未明确有无手柄及连接上下文。'];
      case 'EDGE_FINISH_EVIDENCE':return ['pending','缺少当前形状收边、连接和材料实物记录。'];
      case 'CUSTOM_CONTEXT_COMPLETE':return ['pending','缺少有效区、先编后裁毛坯、手柄声明及上下文来源合同。'];
    }
    return ['pending','缺少执行所需上下文、验证依据，或该项判定尚未完整实现；本次不计为通过。'];
  }
  const rows:RuleResult[]=B_RULES.rules.map(r=>{const [status,reason]=decision(r.ruleId);const b=basis(r.ruleId);
    if(r.ruleId==='WEAVE_MATRIX_MATCH'&&supported)b.rulePath+='.'+(B_RULES.rules.find(r=>r.ruleId==='WEAVE_MATRIX_MATCH') as {childrenByWeaveId?:Record<string,string>}).childrenByWeaveId?.[weaveId];
    return {ruleId:r.ruleId,status,participatesInAggregate:status!=='notApplicable',reason,basis:b};});
  if(!supported)rows.push({ruleId:'UNSUPPORTED_WEAVE',status:'failed',participatesInAggregate:true,reason:'编法不在 B v1.5 正式检查范围内。',basis:basis('UNSUPPORTED_WEAVE')});
  const uiIssues:CraftIssue[]=rows.filter(r=>r.status==='failed'||r.status==='pending').map(r=>{
    const diagnostics=grouped.get(r.ruleId)??[];
    let prior=diagnostics.find(i=>i.status===r.status)??diagnostics[0];
    if(!prior&&d&&r.ruleId==='SHORT_VISIBLE_SEGMENT'){
      const strip=d.strips.find(s=>s.visibleSegments.some(seg=>seg.lengthMm<2*s.pitchMm)),segment=strip?.visibleSegments.find(seg=>seg.lengthMm<2*strip.pitchMm);
      if(strip&&segment)prior={id:'E-SHORT-INDEPENDENT',ruleId:r.ruleId,domain:'craft',status:'pending',title:'边缘短段待复核',reason:r.reason,
        suggestion:'调整轮廓或参数后重新检查，并请 B 确认该位置的加固方案。',location:{path:'visibleSegments',stripId:strip.stripId,segmentId:segment.segmentId,positionMm:segment.startMm},
        evidence:{reference:'data/WEAVE_SPEC_V1_2.json#edgeAcceptanceRules.shortStrip',verification:'engineering-only'}};
    }
    return {id:'E15-'+r.ruleId,ruleId:r.ruleId,domain:prior?.domain??'evidence',status:r.status as 'failed'|'pending',title:ruleTitles[r.ruleId]??'待复核项目',
      reason:r.reason,suggestion:prior?.suggestion??'补齐本规则所需上下文和验证依据后重新检查；不得用默认值代替缺失的工艺数据。',
      location:prior?.location??{path:r.ruleId},evidence:prior?.evidence??{reference:r.basis.documentId+'#'+r.basis.rulePath,verification:'missing'}};
  });
  const carrierContext=fixed?{kind:input.kind,geometry:input.snapshot.carrierGeometry,coordinateSpace:input.snapshot.coordinateSpace,rawBlank:input.snapshot.stages?.rawBlank?.boundary,carrierId:input.snapshot.carrierId,carrierSpecVersion:input.snapshot.carrierSpecVersion}
    :{kind:input.kind,shape:input.input.shape,shapeScale:input.input.parameters.shapeScale,boundary:input.result.status==='ok'?input.result.snapshot.boundary:undefined,missing:['effectivePatternBoundary','rawBlankBoundary','handleContext','D sourceKey','originalStripMapping']};
  const assessmentKey={resultSchemaVersion:'1.5' as const,craftRuleSetVersion:B_RULE_SET_VERSION,evidenceSetVersion:EVIDENCE_SET_VERSION,craftCheckEngineVersion:ENGINE_VERSION,
    carrierType:fixed?'fixed' as const:'custom' as const,carrierId:d?.carrierId??null,carrierContextHash:'sha256:'+await shaValue(carrierContext),carrierSpecVersion:d?.carrierSpecVersion??null,
    weaveId,weaveSpecVersion:d?.weaveSpecVersion??'WEAVE-SPEC-v1.2'};
  const summary=summarizeRules(rows),status=aggregateRules(rows);
  // Custom projection is explicitly an E adapter proposal, never presented as a D-provided sourceKey.
  const sourceKey:Record<string,unknown>=d?.sourceKey?structuredClone(d.sourceKey):input.kind==='custom'?{
    schemaVersion:'0.2',designId:input.input.designId,designRevision:input.input.designRevision,
    ...(input.result.status==='ok'?{generatedFromRevision:input.result.snapshot.generatedFromRevision,shapeId:input.result.snapshot.shapeId}:{}),
    confirmedGenerationId:input.input.confirmedGenerationId,sourceOrigin:'E-projection-from-legacy-input-not-D-sourceKey'}:{sourceOrigin:'missing-D-sourceKey'};
  const screening:ScreeningResult={checkId:'E15-'+raw.inputDigest,status,assessmentScope:'structural-and-craft-screening',productionReady:false,physicalValidation:'not-completed',sourceKey,assessmentKey,summary,ruleResults:rows,
    issues:uiIssues.map(issue=>{const row=rows.find(r=>r.ruleId===issue.ruleId)!;const handleChild=issue.ruleId==='CUSTOM_CONTEXT_COMPLETE'&&(grouped.get(issue.ruleId)??[]).some(i=>i.ruleId==='CUSTOM_HANDLE_CONTEXT');
      return {issueId:issue.id,ruleId:issue.ruleId,status:issue.status,severity:issue.status==='failed'?'error':'review',reason:issue.reason,suggestion:issue.suggestion,
        location:{carrierSpace:'A4_MM_210X297',pointMm:issue.location.positionMm??null,region:handleChild?'handleContext':issue.location.path,boundaryRef:null,stripId:issue.location.stripId??null,segmentId:issue.location.segmentId??null,crossingId:issue.location.crossingId??null},
        basis:handleChild?{...row.basis,rulePath:'CUSTOM_CONTEXT_COMPLETE.children.CUSTOM_HANDLE_CONTEXT'}:row.basis,
        evidenceStatus:issue.evidence.verification==='missing'?'missing':row.basis.evidenceLevel};}),
    disabledOutputs:{materialBom:{enabled:false,reason:'材料余量未经实物验证。'},tutorial:{enabled:false,reason:'制作流程转换留待后续开发。'},formalExport:{enabled:false,reason:'未开放正式导出。'},productionApproval:{enabled:false,reason:'未获实物制作批准。'},weavingOrder:{mode:'structure-preview-only'}}};
  assertScreeningConsistency(screening);
  return {...raw,status,issues:uiIssues,ruleResults:rows,summary,assessmentKey,screening,diagnostics:raw.issues};
}
export function assertScreeningConsistency(result:ScreeningResult):void{
  if(!validateSchema(result))throw Error('B v1.5 result schema invalid: '+JSON.stringify(validateSchema.errors));
  if((result as ScreeningResult&{exampleOnly?:boolean}).exampleOnly)throw Error('Example-only result cannot enter runtime');
  const ids=result.ruleResults.map(r=>r.ruleId);
  if(new Set(ids).size!==ids.length||B_RULES.rules.some(r=>!ids.includes(r.ruleId))||ids.some(id=>!B_RULES.rules.some(r=>r.ruleId===id)&&id!=='UNSUPPORTED_WEAVE'))throw Error('Rule coverage or canonical identities invalid');
  for(const row of result.ruleResults){if(row.participatesInAggregate!==(row.status!=='notApplicable'))throw Error('Aggregation participation invalid');}
  for(const rule of B_RULES.rules){
    const row=result.ruleResults.find(r=>r.ruleId===rule.ruleId)!;
    const applies=rule.appliesTo.includes(result.assessmentKey.carrierType);
    if(rule.execution==='required'&&applies&&row.status==='notApplicable'
      &&!(row.ruleId==='WEAVE_MATRIX_MATCH'&&!B_RULES.scope.weaveIds.includes(result.assessmentKey.weaveId)))throw Error('Required applicable rule cannot be skipped');
    if(row.status==='passed'&&rule.evidenceLevel==='physical-validated')throw Error('No physical acceptance registry is installed');
  }
  if(stableValue(summarizeRules(result.ruleResults))!==stableValue(result.summary))throw Error('Summary mismatch');
  if(result.status!=='stale'&&aggregateRules(result.ruleResults)!==result.status)throw Error('Aggregate status mismatch');
  const unresolved=result.ruleResults.filter(r=>r.status==='failed'||r.status==='pending');
  if(result.issues.length!==unresolved.length||new Set(result.issues.map(i=>i.issueId)).size!==result.issues.length)throw Error('Issue count or IDs invalid');
  for(const r of unresolved)if(result.issues.filter(i=>i.ruleId===r.ruleId&&i.status===r.status).length!==1)throw Error('Issue-rule correspondence invalid');
  if(result.productionReady!==false||result.disabledOutputs.weavingOrder.mode!=='structure-preview-only'||['materialBom','tutorial','formalExport','productionApproval'].some(k=>result.disabledOutputs[k as 'tutorial'].enabled!==false))throw Error('Production outputs must stay disabled');
  if(result.assessmentKey.resultSchemaVersion!=='1.5'||result.assessmentKey.craftRuleSetVersion!==B_RULE_SET_VERSION||result.assessmentKey.evidenceSetVersion!==EVIDENCE_SET_VERSION||result.assessmentKey.craftCheckEngineVersion!==ENGINE_VERSION||!/^sha256:[a-f0-9]{64}$/.test(result.assessmentKey.carrierContextHash))throw Error('Assessment identity invalid');
}
export function screeningForCurrentInput(incoming:CraftResult,currentDigest:string):ScreeningResult{
  const result=structuredClone(incoming.screening);
  if(incoming.inputDigest!==currentDigest)result.status='stale';
  return result;
}
