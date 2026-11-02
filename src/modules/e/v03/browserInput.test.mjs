import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertBrowserInput} from './browserInput.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../../../../examples/d-v03-integration/${name}/structure-snapshot.json`,import.meta.url),'utf8'));
test('all three v0.3.4 snapshots can enter the browser without rewriting IDs',()=>{
  for(const name of ['round-cross-course','oval-herring','octagon-square-hole']){
    const d=read(name);assert.equal(assertBrowserInput(d),d);
  }
});
test('invalid schema, incomplete stages, malformed points and unsafe load sizes are rejected',()=>{
  for(const mutate of [d=>{d.schemaVersion='0.2';},d=>{delete d.stages.rawBlank;},d=>{d.stages.rawBlank.boundary=null;},d=>{delete d.structureGeneratorVersion;},d=>{d.strips.length=1001;},d=>{d.strips[0].rawBlankSegment.startMm.x=NaN;},d=>{d.carrierGeometry.boundary={type:'svgPath',path:'unimplemented'};}]){
    const d=read('round-cross-course');mutate(d);assert.throws(()=>assertBrowserInput(d));
  }
  assert.throws(()=>assertBrowserInput(null));assert.throws(()=>assertBrowserInput({}));
});
