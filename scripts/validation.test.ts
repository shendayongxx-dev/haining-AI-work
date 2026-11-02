import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {calculateStructureV03} from '../src/modules/d/v03/calculateStructureV03';
import {calculateCustomStructure} from '../src/modules/d/calculateCustomStructure';
import {validateCraft,craftInputDigest,acceptCraftResult,aggregateCraftStatus} from '../src/modules/e/validation';
import {SOURCE_FIELDS} from '../src/modules/e/v03/consume.mjs';
import type {CraftInput} from '../src/modules/e/craftTypes';
import type {CustomStructureInput} from '../src/modules/d/customTypes';
import type {CarrierId,WeaveId} from '../src/modules/d/v03/types';
import fixture from '../examples/d-v03-integration/round-cross-course/structure-snapshot.json';
const carriers:CarrierId[]=['FAN-ROUND-170-V1','FAN-OVAL-150X180-V1','FAN-OCTAGON-170-V1'];
const weaves:WeaveId[]=['CROSS-1X1-V1','CROSS-COURSE-2X2-V1','HERRING-3X3-V1','SQUARE-HOLE-1X1-V1'];
function fan(carrierId:CarrierId=carriers[0],weaveId:WeaveId=weaves[1],gridParameters?:{warpCount:number;weftCount:number;stripWidthMm:number;pitchMm:number}):CraftInput&{kind:'fixed-fan'}{
 const snapshot=calculateStructureV03({designId:'e-regression-fan',designRevision:1,carrierId,weaveId,
   creativeSource:fixture.creativeSource,pattern:fixture.sourcePattern,baseColor:'#C4A879',gridParameters});
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
 const input=fan(c,w),r=await validateCraft(input);assert.equal(r.structuralStatus,'passed',JSON.stringify(r.issues.filter(x=>x.status==='failed')));closed(r);
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
 const r=await validateCraft(custom(undefined,w));assert.equal(r.structuralStatus,'passed',JSON.stringify(r.issues.filter(x=>x.status==='failed')));closed(r);assert.equal(r.sourceKey,null);
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
 const r=await validateCraft(d);assert.equal(r.status,'failed');assert.ok(r.issues.some(i=>i.ruleId==='E-CUSTOM-TOPOLOGY'));
});
test('upstream blocking issue and wrong custom weave rule version are rejected',async()=>{
 const d=custom();d.input.generationIssues.push({id:'blocked',code:'BLOCKED',severity:'blocking',stage:'geometry',message:'blocked',generatorVersion:'C-test'});
 assert.equal((await validateCraft(d)).status,'failed');
 const p=custom();if(p.result.status==='ok')p.result.snapshot.weave.rule='old-rule';
 assert.equal((await validateCraft(p)).status,'failed');
});
test('zero engineering warnings still requires B evidence, and E rule version rejects old output',async()=>{
 const d=fan(carriers[1],weaves[2]),r=await validateCraft(d);
 assert.equal(d.snapshot.engineeringWarnings.length,0);closed(r);assert.equal(r.issues.filter(x=>x.domain==='evidence').length,4);
 assert.equal(acceptCraftResult(r.inputDigest,{...r,ruleSetVersion:'old'}),null);
});
test('write traceable fan and custom outputs for A review',async()=>{
 mkdirSync('examples/e-craft-validation',{recursive:true});
 for(const [name,input] of [['fixed-fan',fan()],['custom-concave',custom(concave)]] as const){
  writeFileSync(`examples/e-craft-validation/${name}.json`,JSON.stringify({input,result:await validateCraft(input)},null,2)+'\n');
 }
});
