import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consumeV03, sameSource, acceptV03Result, SOURCE_FIELDS } from './consume.mjs';
const load = p => JSON.parse(readFileSync(new URL(`../../../../${p}`,import.meta.url),'utf8'));
const specs = {carrier:load('data/CARRIER_SPEC_V1_2.json'),weave:load('data/WEAVE_SPEC_V1_2.json')};
const cases = Object.fromEntries(['round-cross-course','oval-herring','octagon-square-hole'].map(name=>[name,load(`examples/d-v03-integration/${name}/structure-snapshot.json`)]));
const baseline = Object.fromEntries(['round-cross-course','oval-herring','octagon-square-hole'].map(name=>[name,load(`examples/e-v03-baseline-983c7cd/${name}.json`)]));
test('round consumer can group 441 operations into 21 steps without guessing stock',()=>{
  const r=consumeV03(cases['round-cross-course'],specs);
  assert.equal(r.structuralConsumptionPassed,true); assert.equal(r.counts.operations,441);
  assert.equal(r.tutorialPreview.steps.length,21); assert.equal(r.materials.totalStockLengthMm,null);
  assert.equal(r.materials.stripCount,42); assert.equal(r.validationStatus,'pending'); assert.equal(r.formalExportAllowed,false);
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
test('all nine source components independently invalidate both checks and tutorial/material outputs',()=>{
  const d=cases['round-cross-course'], r=consumeV03(d,specs);
  for(const f of SOURCE_FIELDS){const current={...d.sourceKey,[f]:f==='generatedFromRevision'?2:d.sourceKey[f]+'-new'};
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
  d.stages.trimmedProduct.strips=d.stages.trimmedProduct.strips.map(s=>Object.fromEntries(Object.entries(s).reverse()));
  assert.equal(consumeV03(d,specs).structuralConsumptionPassed,true);
});
test('operation-action corruption and zero-stock substitution are rejected',()=>{
  const d=structuredClone(cases['round-cross-course']);d.stages.rawBlank.weavingOrder[0].action='under';
  assert.ok(consumeV03(d,specs).errors.some(e=>e.code==='OP_ACTION'));
  const m=structuredClone(cases['round-cross-course']);m.stages.rawBlank.strips[0].stockLengthMm=0;
  assert.ok(consumeV03(m,specs).errors.some(e=>e.code==='SETUP_ACCOUNTING'));
});
test('D v0.3.1 all three inputs pass structural consumption while craft stays pending',()=>{
  for(const d of Object.values(cases)){
    const r=consumeV03(d,specs);
    assert.equal(d.structureGeneratorVersion,'D-STRUCTURE-v0.3.1');
    assert.equal(r.structuralConsumptionPassed,true,JSON.stringify(r.errors));
    assert.equal(r.validationStatus,'pending');assert.equal(r.physicalValidation,'not-completed');
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
    for(const s of d.stages.trimmedProduct.strips)for(const seg of s.visibleSegments)
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
  o.stages.rawBlank.strips.find(s=>s.stripId===c.warpStripId).visibleSegments.find(s=>s.segmentId===c.warpSegmentId).crossingIds=[];
  assert.ok(consumeV03(o,specs).errors.some(e=>e.code==='SEGMENT_BACKLINK'));
});
