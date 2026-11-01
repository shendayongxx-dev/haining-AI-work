import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { consumeV03, sameSource, acceptV03Result, SOURCE_FIELDS } from '../src/modules/e/v03/consume.mjs';
const load = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const specs = { carrier: load('data/CARRIER_SPEC_V1_2.json'), weave: load('data/WEAVE_SPEC_V1_2.json') };
const out = new URL('../examples/e-v03-consumption-v031/', import.meta.url);
mkdirSync(out, { recursive: true });
const all = [], rejectionExamples = [];
let failed = false;
for (const name of ['round-cross-course', 'oval-herring', 'octagon-square-hole']) {
  const d = load(`examples/d-v03-integration/${name}/structure-snapshot.json`);
  const r = consumeV03(d, specs);
  const versionChecks = SOURCE_FIELDS.map(field => {
    const current = structuredClone(d.sourceKey);
    current[field] = field === 'generatedFromRevision' ? current[field] + 1 : `${current[field]}-changed`;
    const preserved = {sourceKey: current, marker: 'current-result'};
    const pass = !sameSource(current, r.sourceKey) && acceptV03Result(current, r, preserved) === preserved;
    return { field, pass };
  });
  const reordered = Object.fromEntries(Object.entries(d.sourceKey).reverse());
  versionChecks.push({field:'key-order-does-not-expire',pass:sameSource(reordered,d.sourceKey)});
  versionChecks.push({field:'missing-key-rejected',pass:!sameSource({...d.sourceKey,craftRuleVersion:undefined},d.sourceKey)});
  const exampleKey = {...d.sourceKey,generatedFromRevision:d.generatedFromRevision+1};
  rejectionExamples.push({caseId:name,currentSourceKey:exampleKey,incomingSourceKey:r.sourceKey,
    accepted:acceptV03Result(exampleKey,r) !== null,reason:'sourceKey.generatedFromRevision changed'});
  const report = {...r,versionChecks};
  writeFileSync(new URL(`${name}.json`,out),JSON.stringify(report,null,2)+'\n');
  const pass = r.structuralConsumptionPassed && versionChecks.every(x=>x.pass);
  failed ||= !pass;
  const summary = {caseId:name,pass,counts:r.counts,materialStatus:r.materials.status,totalStockLengthMm:r.materials.totalStockLengthMm,
    sourceKey: r.sourceKey, checks:r.checks, errors:r.errors,versionChecks};
  all.push(summary);
  console.log(JSON.stringify(summary,null,2));
}
const source = load('examples/d-v03-integration/round-cross-course/structure-snapshot.json');
const mutations = [
  ['source-key-mismatch',d=>{d.sourceKey.weaveSpecVersion='old';}],
  ['duplicate-strip',d=>{d.stages.rawBlank.strips.push(structuredClone(d.stages.rawBlank.strips[0]));}],
  ['wrong-operation-action',d=>{d.stages.rawBlank.weavingOrder[0].action='under';}],
  ['missing-operation',d=>{d.stages.rawBlank.weavingOrder.pop();}],
  ['dangling-segment',d=>{const c=d.stages.rawBlank.crossings.find(c=>c.trimmedProduct.visible);c.warpSegmentId='missing';}],
  ['missing-backlink',d=>{const s=d.stages.rawBlank.strips.find(s=>s.visibleSegments.some(g=>g.crossingIds.length));s.visibleSegments[0].crossingIds=[];}],
  ['color-gap',d=>{const s=d.stages.rawBlank.strips.find(s=>s.visibleSegments.length);s.visibleSegments[0].colorSegments[0].stripOffsetStartMm+=1;}],
  ['fake-zero-stock',d=>{d.stages.rawBlank.strips[0].stockLengthMm=0;}],
  ['false-warning-certification',d=>{d.engineeringWarnings[0].status='passed';}],
];
const negativeTests = mutations.map(([name,mutate])=>{const d=structuredClone(source);mutate(d);const r=consumeV03(d,specs);
  return{name,pass:!r.structuralConsumptionPassed,errorCodes:[...new Set(r.errors.map(e=>e.code))]};});
// Split the identity representation without adding a new strip: procurement count stays 42.
const multi = structuredClone(source), s = multi.stages.rawBlank.strips.find(s=>s.visibleSegments.length);
s.visibleSegments.push(structuredClone(s.visibleSegments[0])); // invalid duplicate is rejected, not bought twice
const mr=consumeV03(multi,specs);
negativeTests.push({name:'duplicate-segment-not-new-material',pass:mr.materials.stripCount===42&&!mr.structuralConsumptionPassed});
failed ||= negativeTests.some(t=>!t.pass);
writeFileSync(new URL('summary.json',out),JSON.stringify({cases:all,negativeTests,rejectionExamples},null,2)+'\n');
console.log('NEGATIVE TESTS',JSON.stringify(negativeTests,null,2));
if(failed)process.exitCode=1;
