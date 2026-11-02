import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {calculateStructureV03} from '../src/modules/d/v03/calculateStructureV03';
import {calculateCustomStructure} from '../src/modules/d/calculateCustomStructure';
import {validateCraft,craftInputDigest,acceptCraftResult,aggregateCraftStatus} from '../src/modules/e/validation';
import {SOURCE_FIELDS} from '../src/modules/e/v03/consume.mjs';
import type {CraftInput} from '../src/modules/e/craftTypes';
import type {CustomStructureInput} from '../src/modules/d/customTypes';
import type {CarrierId,WeaveId} from '../src/modules/d/v03/types';
import fixture from '../examples/d-v03-integration/round-cross-course/structure-snapshot.json';
import {assertScreeningConsistency,canonicalRuleId,screeningForCurrentInput} from '../src/modules/e/ruleLedger';
import {acceptV03Result} from '../src/modules/e/v03/consume.mjs';
import bRules from '../data/b-craft-v1.5/data/craft_check_rules_v1.5.json';
import type {StructureSnapshotV03} from '../src/modules/d/v03/types';
const carriers:CarrierId[]=['FAN-ROUND-170-V1','FAN-OVAL-150X180-V1','FAN-OCTAGON-170-V1'];
const weaves:WeaveId[]=['CROSS-1X1-V1','CROSS-COURSE-2X2-V1','HERRING-3X3-V1','SQUARE-HOLE-1X1-V1'];
function fan(carrierId:CarrierId=carriers[0],weaveId:WeaveId=weaves[1],gridParameters?:{warpCount:number;weftCount:number;stripWidthMm:number;pitchMm:number}):CraftInput&{kind:'fixed-fan'}{
 const snapshot=structuredClone(calculateStructureV03({designId:'e-regression-fan',designRevision:1,carrierId,weaveId,
   creativeSource:fixture.creativeSource,pattern:fixture.sourcePattern,baseColor:'#C4A879',gridParameters}));
 return{kind:'fixed-fan',snapshot,current:{designId:snapshot.designId,designRevision:1,confirmedGenerationId:snapshot.confirmedGenerationId}};
}
function custom(points=[{x:35,y:40},{x:175,y:40},{x:175,y:200},{x:35,y:200},{x:35,y:40}],weaveId:WeaveId=weaves[1]):CraftInput&{kind:'custom'}{
 const input:CustomStructureInput={schemaVersion:'0.2',designId:'e-regression-custom',designRevision:1,confirmedGenerationId:'c-shape-1',generationIssues:[],weaveId,
   shape:{shapeId:'shape-1',coordinateSpace:{unit:'mm',width:210,height:297,origin:'topLeft',xAxis:'right',yAxis:'down'},fillRule:'evenodd',components:[{componentId:'part-1',outerBoundary:{closed:true,pointsMm:points},holes:[]}]},
   parameters:{density:13,stripWidthMm:4,shapeScale:1,warpColor:'#C4A879',weftColor:'#315F3A'}};
 return{kind:'custom',input,result:calculateCustomStructure(input)};
}
function closed(r:Awaited<ReturnType<typeof validateCraft>>){assert.equal(r.status,'pending');assert.equal(r.formalMaterialsAllowed,false);assert.equal(r.tutorialAllowed,false);assert.equal(r.exportAllowed,false);}
for(const c of carriers)for(const w of weaves)test(`${c} / ${w} consumes but does not certify craft`,async()=>{
 const input=fan(c,w),r=await validateCraft(input);assert.equal(r.structuralStatus,'passed',JSON.stringify(r.issues.filter(x=>x.status==='failed')));if(w==='CROSS-1X1-V1'){assert.equal(r.status,'failed');assert.ok(r.issues.some(x=>x.ruleId==='UNSUPPORTED_WEAVE'));}else closed(r);
 assert.deepEqual(r.sourceKey,input.snapshot.sourceKey);assert.ok(r.issues.every(x=>x.ruleId&&x.location.path&&x.reason&&x.suggestion&&x.evidence.reference));
});
test('parameterized fan remains consumable without pretending defaults are craft limits',async()=>{
 const r=await validateCraft(fan(carriers[1],weaves[2],{warpCount:17,weftCount:17,stripWidthMm:4,pitchMm:(189-4)/16}));
 assert.equal(r.structuralStatus,'passed',JSON.stringify(r.issues));closed(r);
});
test('every source component and pattern placement invalidates previous results',async()=>{
 assert.equal(SOURCE_FIELDS.length,11);const d=fan(),r=await validateCraft(d);
 for(const field of SOURCE_FIELDS){const n=structuredClone(d);const key=n.snapshot.sourceKey as Record<string,unknown>;
  key[field]=typeof key[field]==='number'?(key[field] as number)+1:String(key[field])+'-changed';
  assert.equal(acceptCraftResult(await craftInputDigest(n),r),null,field);
 }
 const p=structuredClone(d);p.snapshot.patternPlacement.scale=1.2;const changed=await validateCraft(p);assert.equal(changed.status,'failed');
 const newer={...r,inputDigest:await craftInputDigest(p)};assert.equal(acceptCraftResult(newer.inputDigest,r,newer),newer);
});
test('mismatched current design and corrupted operations are failed, not pending',async()=>{
 const d=fan();d.current.designRevision++;assert.equal((await validateCraft(d)).status,'failed');
 const p=fan();p.snapshot.stages.rawBlank.weavingOrder[0].action='under';assert.equal((await validateCraft(p)).status,'failed');
});
test('input property order does not invalidate fingerprint',async()=>{
 const d=fan(),other={current:d.current,snapshot:d.snapshot,kind:d.kind};assert.equal(await craftInputDigest(d),await craftInputDigest(other));
});
for(const w of weaves)test(`custom convex shape / ${w} enters actual checks`,async()=>{
 const r=await validateCraft(custom(undefined,w));assert.equal(r.structuralStatus,'passed',JSON.stringify(r.issues.filter(x=>x.status==='failed')));if(w==='CROSS-1X1-V1')assert.equal(r.status,'failed');else closed(r);assert.equal(r.sourceKey,null);
});
const concave=[{x:30,y:30},{x:180,y:30},{x:180,y:200},{x:140,y:200},{x:140,y:80},{x:70,y:80},{x:70,y:200},{x:30,y:200},{x:30,y:30}];
test('concave shape with multiple segments is checked without new material identities',async()=>{
 const d=custom(concave);assert.equal(d.result.status,'ok');if(d.result.status!=='ok')return;
 assert.ok(d.result.snapshot.strips.list.some(s=>s.segmentIndex>0));const r=await validateCraft(d);assert.equal(r.structuralStatus,'passed',JSON.stringify(r.issues.filter(x=>x.status==='failed')));closed(r);
});
test('custom source, segment geometry and missing crossing cannot pass',async()=>{
 for(const mutate of [d=>{d.result.snapshot.generatedFromRevision=0;},d=>{d.result.snapshot.strips.list[0].endMm.y+=5;},d=>{d.result.snapshot.interlace.crossings.pop();}]){
  const d=custom();assert.equal(d.result.status,'ok');mutate(d as any);assert.equal((await validateCraft(d)).status,'failed');
 }
});
test('holes and multiple components return pending capability issues instead of unproven craft failure',async()=>{
 for(const which of ['holes','components']){
  const d=custom();if(which==='holes')d.input.shape.components[0].holes.push({holeId:'hole-1',closed:true,pointsMm:[{x:70,y:70},{x:90,y:70},{x:80,y:90},{x:70,y:70}]});
  else d.input.shape.components.push(structuredClone(d.input.shape.components[0]));
  d.result=calculateCustomStructure(d.input);const r=await validateCraft(d);assert.equal(r.structuralStatus,'pending');closed(r);
 }
});
test('open or self intersecting input is explicitly blocked',async()=>{
 const d=custom();d.input.shape.components[0].outerBoundary.closed=false;d.result=calculateCustomStructure(d.input);assert.equal((await validateCraft(d)).status,'failed');
 const p=custom([{x:30,y:30},{x:180,y:180},{x:30,y:180},{x:180,y:30},{x:30,y:30}]);assert.equal((await validateCraft(p)).status,'failed');
});
test('custom shape, parameters, palette, shape ID and revision change expire old results even with unchanged revision',async()=>{
 const d=custom(),r=await validateCraft(d);
 for(const mutate of [n=>{n.input.parameters.stripWidthMm=5;},n=>{n.input.shape.components[0].outerBoundary.pointsMm[1].x-=5;},n=>{n.input.shape.shapeId='shape-2';},n=>{n.input.parameters.warpColor='#000000';},n=>{n.input.designRevision++;}]){
  const n=structuredClone(d);mutate(n);assert.equal(acceptCraftResult(await craftInputDigest(n),r),null);
 }
});
test('aggregate supports three statuses with missing evidence priority, without shipping fabricated verified rules',()=>{
 assert.equal(aggregateCraftStatus([],true),'passed');assert.equal(aggregateCraftStatus([],false),'pending');
 assert.equal(aggregateCraftStatus([{status:'pending'}],true),'pending');assert.equal(aggregateCraftStatus([{status:'pending'},{status:'failed'}],false),'failed');
});
test('E independently rejects forged self-intersecting geometry even if D status is ok',async()=>{
 const d=custom();d.input.shape.components[0].outerBoundary.pointsMm=[{x:30,y:30},{x:180,y:180},{x:30,y:180},{x:180,y:30},{x:30,y:30}];
 const r=await validateCraft(d);assert.equal(r.status,'failed');assert.ok(r.issues.some(i=>i.ruleId==='CUSTOM_BOUNDARY_SIMPLE'));
});
test('upstream blocking issue and wrong custom weave rule version are rejected',async()=>{
 const d=custom();d.input.generationIssues.push({id:'blocked',code:'BLOCKED',severity:'blocking',stage:'geometry',message:'blocked',generatorVersion:'C-test'});
 assert.equal((await validateCraft(d)).status,'failed');
 const p=custom();if(p.result.status==='ok')p.result.snapshot.weave.rule='old-rule';
 assert.equal((await validateCraft(p)).status,'failed');
});
test('zero engineering warnings still requires B evidence, and E rule version rejects old output',async()=>{
 const d=fan(carriers[1],weaves[2]),r=await validateCraft(d);
 assert.equal(d.snapshot.engineeringWarnings.length,0);closed(r);assert.equal(r.issues.filter(x=>x.ruleId==='EDGE_FINISH_EVIDENCE').length,1);
 assert.equal(acceptCraftResult(r.inputDigest,{...r,ruleSetVersion:'old'}),null);
});
test('write traceable fan and custom outputs for A review',async()=>{
 mkdirSync('examples/e-craft-validation',{recursive:true});
 for(const [name,input] of [['fixed-fan',fan()],['custom-concave',custom(concave)]] as const){
  writeFileSync(`examples/e-craft-validation/${name}.json`,JSON.stringify({input,result:await validateCraft(input)},null,2)+'\n');
 }
});
test('B v1.5 boundary and handle modifications reject an otherwise consistent snapshot',async()=>{
 for(const field of ['boundary','effectivePatternBoundary','handleExclusion']){
  const d=fan(),geometry=d.snapshot.carrierGeometry as Record<string,any>;
  if(field==='handleExclusion')geometry[field].xMin+=1;else geometry[field].r+=1;
  const r=await validateCraft(d);assert.equal(r.status,'failed');assert.ok(r.issues.some(x=>x.ruleId==='BOUNDARY_GEOMETRY_MATCH'));
 }
});
test('B v1.5 identifies missing mandatory fields as pending rather than craft failure',async()=>{
 for(const field of ['sourceKey','patternPlacement','carrierId']){
  const d=fan();delete (d.snapshot as any)[field];const r=await validateCraft(d);
  assert.equal(r.status,'pending',JSON.stringify(r.issues));assert.equal(r.structuralStatus,'pending');assert.ok(r.issues.some(x=>x.ruleId==='INPUT_REQUIRED_FIELDS'));
 }
});
test('B v1.5 square hole measurements remain pending and custom context is not fabricated',async()=>{
 const r=await validateCraft(fan(carriers[2],weaves[3]));assert.ok(r.issues.some(x=>x.ruleId==='SQUARE_HOLE_PARAMETER_EVIDENCE'&&x.status==='pending'));
 const c=await validateCraft(custom());for(const rule of ['CUSTOM_CONTEXT_COMPLETE','EDGE_FINISH_EVIDENCE'])assert.ok(c.issues.some(x=>x.ruleId===rule));
});
test('B v1.5 raw blank coverage rejects cropped blank without inventing production margin',async()=>{
 const d=fan();(d.snapshot.stages.rawBlank.boundary as any).height=50;
 const r=await validateCraft(d);assert.equal(r.status,'failed');assert.ok(r.issues.some(x=>x.ruleId==='RAW_BLANK_COVERS_BOUNDARY'));
});
test('B evidence and ruleset versions are bound to result acceptance',async()=>{
 const d=fan(),r=await validateCraft(d);assert.equal(r.bRuleSetVersion,'B-CRAFT-CHECK-v1.5');assert.equal(r.evidenceSetVersion,'B-EVIDENCE-v1.5');assert.equal(r.productionReady,false);
 assert.equal(acceptCraftResult(r.inputDigest,{...r,evidenceSetVersion:'old'}),null);assert.equal(acceptCraftResult(r.inputDigest,{...r,bRuleSetVersion:'old'}),null);
});
function realFan(path:string):CraftInput&{kind:'fixed-fan'}{
 const snapshot=JSON.parse(readFileSync(path,'utf8')) as StructureSnapshotV03;
 return{kind:'fixed-fan',snapshot,current:{designId:snapshot.designId,designRevision:snapshot.designRevision,confirmedGenerationId:snapshot.confirmedGenerationId}};
}
const realCases=[['round-cross-course',42,441,285],['oval-herring',42,441,259],['octagon-square-hole',26,169,109]] as const;
for(const [name,strips,crossings,visible] of realCases)test(`D d1f9ceb actual ${name}: 19 canonical rules and B schema`,async()=>{
 const input=realFan(`examples/d-v03-integration/${name}/structure-snapshot.json`),r=await validateCraft(input);
 assert.equal(input.snapshot.strips.length,strips);assert.equal(input.snapshot.stages.rawBlank.crossings.length,crossings);assert.equal(input.snapshot.stages.trimmedProduct.visibleCrossingIds.length,visible);
 assert.equal(r.structuralStatus,'passed');assert.equal(r.status,'pending');assert.equal(r.ruleResults.length,19);assert.equal(new Set(r.ruleResults.map(x=>x.ruleId)).size,19);
 assert.deepEqual(new Set(r.ruleResults.map(x=>x.ruleId)),new Set(bRules.rules.map(x=>x.ruleId)));
 assert.deepEqual(r.screening.sourceKey,input.snapshot.sourceKey);assertScreeningConsistency(r.screening);
 mkdirSync('examples/e-v15-regression',{recursive:true});
 writeFileSync(`examples/e-v15-regression/${name}.json`,JSON.stringify({dCommit:'d1f9ceb',inputPath:`examples/d-v03-integration/${name}/structure-snapshot.json`,inputSha256:createHash('sha256').update(readFileSync(`examples/d-v03-integration/${name}/structure-snapshot.json`)).digest('hex'),structuralStatus:r.structuralStatus,result:r.screening},null,2)+'\n');
});
test('D real revision 1 to 2 expires check, source-bound material and tutorial caches',async()=>{
 const v1=realFan('examples/d-v03-integration/round-cross-course/structure-snapshot.json');
 const v2=realFan('examples/d-to-e-invalidation/round-cross-course.revision-2.json');
 assert.equal(v1.snapshot.designRevision,1);assert.equal(v2.snapshot.designRevision,2);assert.equal(v1.snapshot.patternPlacement.scale,1);assert.equal(v2.snapshot.patternPlacement.scale,1.1);
 const old=await validateCraft(v1),fresh=await validateCraft(v2);assert.equal(fresh.structuralStatus,'passed');assert.equal(fresh.status,'pending');
 assert.equal(acceptCraftResult(fresh.inputDigest,old),null);assert.equal(acceptCraftResult(fresh.inputDigest,old,fresh),fresh);
 for(const kind of ['check','material','tutorial'])assert.equal(acceptV03Result(v2.snapshot.sourceKey,{kind,sourceKey:v1.snapshot.sourceKey}),null);
 const stale=screeningForCurrentInput(old,fresh.inputDigest);assert.equal(stale.status,'stale');assert.deepEqual(stale.sourceKey,v1.snapshot.sourceKey);assertScreeningConsistency(stale);
 writeFileSync('examples/e-v15-regression/revision-invalidation.json',JSON.stringify({dCommit:'d1f9ceb',oldSourceKey:old.sourceKey,currentSourceKey:fresh.sourceKey,oldDigest:old.inputDigest,currentDigest:fresh.inputDigest,oldCheckAccepted:false,sourceBoundCacheScopesRejected:['check','material','tutorial'],staleResult:stale,currentResult:fresh.screening,note:'Material and tutorial objects are synthetic source-bound cache probes; production features remain unimplemented and disabled.'},null,2)+'\n');
});
test('custom parent-only ledger and legacy source projection stay explicit',async()=>{
 const r=await validateCraft(custom(concave));assert.equal(r.ruleResults.length,19);
 assert.equal(canonicalRuleId('CUSTOM_HANDLE_CONTEXT'),'CUSTOM_CONTEXT_COMPLETE');
 assert.equal(r.ruleResults.filter(x=>x.ruleId==='CUSTOM_CONTEXT_COMPLETE').length,1);assert.equal(r.ruleResults.filter(x=>x.ruleId==='CUSTOM_HANDLE_CONTEXT').length,0);
 assert.equal(r.issues.filter(x=>x.ruleId==='CUSTOM_CONTEXT_COMPLETE').length,1);assert.equal(r.screening.issues.find(x=>x.ruleId==='CUSTOM_CONTEXT_COMPLETE')?.location.region,'handleContext');
 assert.equal(r.sourceKey,null);assert.equal(r.screening.sourceKey.sourceOrigin,'E-projection-from-legacy-input-not-D-sourceKey');
 assert.equal(r.ruleResults.find(x=>x.ruleId==='STRIP_ID_TRACEABLE')?.status,'pending');assert.equal(r.ruleResults.find(x=>x.ruleId==='OUTER_BASE_WEAVE_CONTINUITY')?.status,'pending');
 assertScreeningConsistency(r.screening);writeFileSync('examples/e-v15-regression/custom-v02-pending.json',JSON.stringify(r.screening,null,2)+'\n');
});
const badResults=[
 ['missing canonical rule',r=>{r.ruleResults.pop();}],
 ['duplicate rule',r=>{r.ruleResults.push(structuredClone(r.ruleResults[0]));}],
 ['child alias counted independently',r=>{r.ruleResults.push({...r.ruleResults[0],ruleId:'CUSTOM_HANDLE_CONTEXT'});}],
 ['incorrect summary',r=>{r.summary.passedCount++;}],
 ['missing issue',r=>{r.issues.pop();}],
 ['mismatched issue status',r=>{r.issues[0].status='failed';}],
 ['skipped required rule',r=>{r.ruleResults[0].status='notApplicable';r.ruleResults[0].participatesInAggregate=false;}],
 ['unblocked formal export',r=>{r.disabledOutputs.formalExport.enabled=true;}],
 ['null fields omitted',r=>{delete r.issues[0].location.pointMm;}],
 ['example fixture marked runtime',r=>{r.exampleOnly=true;}],
 ['wrong evidence version',r=>{r.assessmentKey.evidenceSetVersion='old';}],
 ['fabricated physical pass',r=>{r.ruleResults.find(x=>x.ruleId==='EDGE_FINISH_EVIDENCE').status='passed';}],
] as const;
for(const [name,mutate] of badResults)test(`v1.5 runtime rejects ${name}`,async()=>{
 const r=await validateCraft(fan()),broken=structuredClone(r.screening);mutate(broken as any);assert.throws(()=>assertScreeningConsistency(broken));
});
test('incoming result with matching digest but broken ledger is rejected',async()=>{
 const r=await validateCraft(fan()),broken=structuredClone(r);broken.screening.summary.pendingCount++;
 assert.equal(acceptCraftResult(r.inputDigest,broken),null);
});
test('short segment review is recomputed even if upstream warnings were omitted',async()=>{
 const input=fan(carriers[0],weaves[1],{warpCount:3,weftCount:3,stripWidthMm:3,pitchMm:93});
 input.snapshot.engineeringWarnings=[];const r=await validateCraft(input);
 assert.equal(r.structuralStatus,'passed');assert.equal(r.ruleResults.find(x=>x.ruleId==='SHORT_VISIBLE_SEGMENT')?.status,'pending');
 assert.ok(r.screening.issues.find(x=>x.ruleId==='SHORT_VISIBLE_SEGMENT')?.location.segmentId);
});
