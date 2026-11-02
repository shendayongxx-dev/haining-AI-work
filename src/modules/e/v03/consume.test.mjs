import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consumeV03, sameSource, acceptV03Result, SOURCE_FIELDS } from './consume.mjs';
const load = p => JSON.parse(readFileSync(new URL(`../../../../${p}`,import.meta.url),'utf8'));
const specs = {carrier:load('data/CARRIER_SPEC_V1_2.json'),weave:load('data/WEAVE_SPEC_V1_2.json')};
const cases = Object.fromEntries(['round-cross-course','oval-herring','octagon-square-hole'].map(name=>[name,load(`examples/d-v03-integration/${name}/structure-snapshot.json`)]));
// Test-only migration of old faulty topology; production rejects legacy layouts.
function migrateHistoricalFixture(name){
 const old=load(`examples/e-v03-baseline-983c7cd/${name}.json`), d=structuredClone(cases[name]);
 d.strips=old.stages.rawBlank.strips;
 d.stages.rawBlank={boundary:old.stages.rawBlank.boundary,stripIds:d.strips.map(s=>s.stripId),crossings:old.stages.rawBlank.crossings,weavingOrder:old.stages.rawBlank.weavingOrder};
 d.stages.trimmedProduct={...d.stages.trimmedProduct,visibleStripIds:d.strips.filter(s=>s.visibleSegments.length).map(s=>s.stripId),visibleCrossingIds:old.stages.trimmedProduct.visibleCrossingIds};
 d.structureGeneratorVersion=old.structureGeneratorVersion;d.sourceKey.structureGeneratorVersion=old.structureGeneratorVersion;
 return d;
}
const baseline = Object.fromEntries(['round-cross-course','oval-herring','octagon-square-hole'].map(name=>[name,migrateHistoricalFixture(name)]));
test('round consumer can group 441 operations into 21 steps without guessing stock',()=>{
  const r=consumeV03(cases['round-cross-course'],specs);
  assert.equal(r.structuralConsumptionPassed,true); assert.equal(r.counts.operations,441);
  assert.equal(r.tutorialPreview.steps.length,21); assert.equal(r.materials.totalStockLengthMm,null);
  assert.equal(r.materials.stripCount,42); assert.equal(r.craftValidation.status,'pending'); assert.equal(r.formalExportAllowed,false);
});
test('ellipse boundary cases with invisible/non-null references remain reported',()=>{
  const r=consumeV03(baseline['oval-herring'],specs);
  assert.equal(r.structuralConsumptionPassed,false);
  const ids=new Set(r.errors.filter(e=>e.code==='INVISIBLE_SEGMENT_REFERENCE').map(e=>e.path));
  assert.deepEqual([...ids].sort(),['X-V011-H001','X-V011-H021']);
});
test('six octagon boundary references must not silently disappear',()=>{
  const r=consumeV03(baseline['octagon-square-hole'],specs);
  const ids=new Set(r.errors.filter(e=>e.code==='INVISIBLE_SEGMENT_REFERENCE').map(e=>e.path));
  assert.equal(ids.size,6); assert.equal(r.structuralConsumptionPassed,false);
});
test('all ten source components independently invalidate both checks and tutorial/material outputs',()=>{
  const d=cases['round-cross-course'], r=consumeV03(d,specs);
  for(const f of SOURCE_FIELDS){const current={...d.sourceKey,[f]:['designRevision','generatedFromRevision'].includes(f)?d.sourceKey[f]+1:d.sourceKey[f]+'-new'};
    for(const old of [r,r.materials,r.tutorialPreview]){
      assert.equal(sameSource(current,old.sourceKey),false);
      assert.equal(acceptV03Result(current,old),null);
    }
  }
});
test('a delayed result cannot replace newer accepted results',async()=>{
  const d=cases['round-cross-course'], old=consumeV03(d,specs), current={...d.sourceKey,generatedFromRevision:2};
  const latest={sourceKey:current,marker:'new'};
  assert.equal(acceptV03Result(current,await Promise.resolve(old),latest),latest);
});
test('object key order does not expire source keys or cause duplicate stage discrepancies',()=>{
  const d=structuredClone(cases['round-cross-course']);
  assert.equal(sameSource(d.sourceKey,Object.fromEntries(Object.entries(d.sourceKey).reverse())),true);
  d.strips=d.strips.map(s=>Object.fromEntries(Object.entries(s).reverse()));
  assert.equal(consumeV03(d,specs).structuralConsumptionPassed,true);
});
test('operation-action corruption and zero-stock substitution are rejected',()=>{
  const d=structuredClone(cases['round-cross-course']);d.stages.rawBlank.weavingOrder[0].action='under';
  assert.ok(consumeV03(d,specs).errors.some(e=>e.code==='OP_ACTION'));
  const m=structuredClone(cases['round-cross-course']);m.strips[0].stockLengthMm=0;
  assert.ok(consumeV03(m,specs).errors.some(e=>e.code==='SETUP_ACCOUNTING'));
});
test('D v0.3.4 all three inputs pass structural consumption while craft stays pending',()=>{
  for(const d of Object.values(cases)){
    const r=consumeV03(d,specs);
    assert.equal(d.structureGeneratorVersion,'D-STRUCTURE-v0.3.4');
    assert.equal(r.structuralConsumptionPassed,true,JSON.stringify(r.errors));
    assert.equal(r.craftValidation.status,'pending');assert.equal(r.physicalValidation.status,'not-completed');
    assert.equal(r.formalExportAllowed,false);assert.equal(r.materials.totalStockLengthMm,null);
  }
});
test('ellipse tangencies are invisible with both segment references and operation references null',()=>{
  const d=cases['oval-herring'];
  for(const id of ['X-V011-H001','X-V011-H021']){
    const c=d.stages.rawBlank.crossings.find(c=>c.crossingId===id),op=d.stages.rawBlank.weavingOrder.find(o=>o.crossingId===id);
    assert.equal(c.trimmedProduct.visible,false);assert.equal(c.warpSegmentId,null);assert.equal(c.weftSegmentId,null);
    assert.deepEqual(op.trimmedProduct,{visible:false,workingSegmentId:null,referenceSegmentId:null});
  }
  assert.equal(d.stages.trimmedProduct.visibleCrossingIds.length,259);
});
test('all six octagon boundary points become visible with bidirectional links',()=>{
  const d=cases['octagon-square-hole'];
  for(const id of ['X-V010-H002','X-V011-H003','X-V012-H004','X-V012-H010','X-V011-H011','X-V010-H012']){
    const c=d.stages.rawBlank.crossings.find(c=>c.crossingId===id);
    assert.equal(c.trimmedProduct.visible,true);assert.ok(c.warpSegmentId);assert.ok(c.weftSegmentId);
    assert.ok(d.stages.trimmedProduct.visibleCrossingIds.includes(id));
    for(const s of d.strips)for(const seg of s.visibleSegments)
      if(seg.segmentId===c.warpSegmentId||seg.segmentId===c.weftSegmentId)assert.ok(seg.crossingIds.includes(id));
  }
  assert.equal(d.stages.trimmedProduct.visibleCrossingIds.length,109);
});
test('generator-only upgrade rejects v0.3.0 even when design revision is unchanged',()=>{
  for(const name of Object.keys(cases)){
    const old=consumeV03(baseline[name],specs),current=consumeV03(cases[name],specs);
    assert.equal(old.sourceKey.generatedFromRevision,current.sourceKey.generatedFromRevision);
    assert.equal(sameSource(current.sourceKey,old.sourceKey),false);
    assert.equal(acceptV03Result(current.sourceKey,old,current),current);
  }
});
test('reintroducing an invisible non-null segment or omitting an octagon backlink is rejected',()=>{
  const d=structuredClone(cases['oval-herring']);d.stages.rawBlank.crossings.find(c=>c.crossingId==='X-V011-H001').warpSegmentId='V011-S01';
  assert.ok(consumeV03(d,specs).errors.some(e=>e.code==='INVISIBLE_SEGMENT_REFERENCE'));
  const o=structuredClone(cases['octagon-square-hole']),id='X-V010-H002';
  const c=o.stages.rawBlank.crossings.find(c=>c.crossingId===id);
  o.strips.find(s=>s.stripId===c.warpStripId).visibleSegments.find(s=>s.segmentId===c.warpSegmentId).crossingIds=[];
  assert.ok(consumeV03(o,specs).errors.some(e=>e.code==='SEGMENT_BACKLINK'));
});

test('v0.3.4 preserves the complete ten-field source key on all E outputs for every case',()=>{
  assert.equal(SOURCE_FIELDS.length,10);
  for(const d of Object.values(cases)){
    const r=consumeV03(d,specs);
    for(const out of [r,r.materials,r.tutorialPreview])assert.deepEqual(out.sourceKey,d.sourceKey);
    assert.equal(r.counts.operations,d.grid.warpCount*d.grid.weftCount);
    assert.equal(r.tutorialPreview.steps.flatMap(s=>s.operations).length,r.counts.operations);
    const older={...d.sourceKey,structureGeneratorVersion:'D-STRUCTURE-v0.3.1'};
    assert.equal(acceptV03Result(d.sourceKey,{sourceKey:older}),null);
  }
});

const contractMutations=[
  ['creative result ID',d=>{d.creativeSource.resultId='wrong';},'CREATIVE_SOURCE'],
  ['unsupported carrier shape result',d=>{d.creativeSource.resultType='carrier_shape';},'CREATIVE_SOURCE'],
  ['palette color',d=>{d.sourcePattern.palette[0].color='#000000';},'MOTIF_SOURCE'],
  ['source input renamed',d=>{d.strips.flatMap(s=>s.visibleSegments).flatMap(s=>s.colorSegments).find(c=>c.scope==='motif').sourceInputId='invented';},'MOTIF_SOURCE'],
  ['generator missing',d=>{d.creativeSource.generatorVersion='';},'CREATIVE_SOURCE'],
  ['coordinate origin',d=>{d.sourcePattern.coordinateSpace.origin='bottomRight';},'SOURCE_COORDINATES'],
  ['issue generator mismatch',d=>{d.creativeSource.generationIssues.push({severity:'warning',generatorVersion:'other'});},'UPSTREAM_ISSUE_DOMAIN'],
  ['duplicate palette',d=>{d.sourcePattern.palette.push(structuredClone(d.sourcePattern.palette[0]));},'SOURCE_IDS_DUPLICATE'],
  ['duplicate element',d=>{d.sourcePattern.elements.push(structuredClone(d.sourcePattern.elements[0]));},'SOURCE_IDS_DUPLICATE'],
  ['raw strip index',d=>{d.stages.rawBlank.stripIds.pop();},'RAW_STRIP_INDEX'],
  ['visible strip index',d=>{d.stages.trimmedProduct.visibleStripIds.push('missing');},'VISIBLE_STRIP_INDEX'],
  ['stale revision with consistent source key',d=>{d.designRevision++;d.sourceKey.designRevision++;},'STALE_SNAPSHOT'],
];
for(const [name,mutate,code] of contractMutations)test(`v0.3.4 independently rejects ${name}`,()=>{
  const d=structuredClone(cases['round-cross-course']);mutate(d);
  const r=consumeV03(d,specs);
  assert.equal(r.structuralConsumptionPassed,false);
  assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r.errors));
  assert.equal(r.formalExportAllowed,false);
});
