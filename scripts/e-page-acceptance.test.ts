import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {validateCraft} from '../src/modules/e/validation';
import {issuePresentation} from '../src/modules/e/checkPresentation';
import {makePageCase,pageCases} from '../tests/e-check/fixtures';
for(const entry of pageCases)test(`page acceptance: ${entry.id}`,async()=>{
  const input=makePageCase(entry.id),r=await validateCraft(input);
  assert.equal(r.status,entry.expectedStatus);assert.equal(r.structuralStatus,entry.expectedStructure);assert.equal(r.ruleResults.length,19);
  if(entry.ruleId)assert.ok(r.issues.some(i=>i.ruleId===entry.ruleId));
  for(const issue of r.issues){const p=issuePresentation(issue,r);assert.ok(p.title&&p.reason&&p.suggestion&&p.locationLabel);if(issue.status==='failed')assert.equal(p.category,'edit');}
  assert.equal(r.productionReady,false);assert.equal(r.exportAllowed,false);
  mkdirSync('examples/e-page-acceptance',{recursive:true});
  writeFileSync(`examples/e-page-acceptance/${entry.id}.json`,JSON.stringify({case:entry,baseSource:entry.id.startsWith('custom-')?'D custom calculator v0.2 from test contour':'D d1f9ceb round snapshot',note:entry.injected?'Deliberately injected test fault, not a production design or B acceptance record.':'Structural fixture; not a physical pass record.',result:r.screening},null,2)+'\n');
});
test('copy preserves raw evidence while making missing context readable',async()=>{
  const r=await validateCraft(makePageCase('custom-context')),before=JSON.stringify(r);
  const item=r.issues.find(i=>i.ruleId==='CUSTOM_CONTEXT_COMPLETE')!,copy=issuePresentation(item,r);
  assert.equal(copy.category,'context');assert.ok(copy.reason.includes('毛坯'));assert.equal(JSON.stringify(r),before);
  const edge=issuePresentation(r.issues.find(i=>i.ruleId==='EDGE_FINISH_EVIDENCE')!,r);assert.equal(edge.category,'evidence');assert.ok(edge.suggestion.includes('试编'));
});
test('dependent pending rules after a structure failure are not presented as missing design data',async()=>{
  const r=await validateCraft(makePageCase('color-gap')),pending=r.issues.find(i=>i.ruleId==='FIXED_CARRIER_ID_MATCH')!;
  const copy=issuePresentation(pending,r);assert.equal(pending.status,'pending');assert.equal(copy.category,'blocked');assert.ok(copy.suggestion.includes('先处理'));
});
