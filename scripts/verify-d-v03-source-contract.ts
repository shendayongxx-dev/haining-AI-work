import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateStructureV03 } from '../src/modules/d/v03/validateStructureV03';
import type { StructureSnapshotV03 } from '../src/modules/d/v03/types';

const fixturePath = join(process.cwd(), 'examples/d-v03-integration/round-cross-course/structure-snapshot.json');
const original = JSON.parse(readFileSync(fixturePath, 'utf8')) as StructureSnapshotV03;

function clone() {
  return JSON.parse(JSON.stringify(original)) as StructureSnapshotV03;
}

function expectFailure(name: string, mutate: (snapshot: StructureSnapshotV03) => void, expectedCheck: string) {
  const snapshot = clone();
  mutate(snapshot);
  const report = validateStructureV03(snapshot);
  const check = report.checks.find(value => value.id === expectedCheck);
  if (report.pass || !check || check.pass) {
    throw new Error(`${name}: expected ${expectedCheck} to fail`);
  }
  console.log(`PASS tamper rejected: ${name} -> ${expectedCheck}`);
}

const baseline = validateStructureV03(original);
if (!baseline.pass) throw new Error('Baseline v0.3.5 fixture must pass before tamper tests.');
console.log('PASS baseline source contract');

expectFailure('sourceKey designRevision mismatch', snapshot => {
  snapshot.sourceKey.designRevision += 1;
}, 'source-key-complete');

expectFailure('creative resultId mismatch', snapshot => {
  snapshot.creativeSource.resultId = 'pattern-tampered';
}, 'creative-source-complete');

expectFailure('carrier_shape outside v0.3.5 scope', snapshot => {
  (snapshot.creativeSource as { resultType: string }).resultType = 'carrier_shape';
}, 'creative-source-complete');

expectFailure('palette color mismatch', snapshot => {
  snapshot.sourcePattern.palette[0].color = '#000000';
}, 'color-source-semantics');

expectFailure('sourceInputId renamed by D', snapshot => {
  const motif = snapshot.strips.flatMap(strip => strip.visibleSegments)
    .flatMap(segment => segment.colorSegments).find(color => color.scope === 'motif');
  if (!motif) throw new Error('Fixture must contain one motif color segment.');
  motif.sourceInputId = 'stroke-derived-by-d';
}, 'color-source-semantics');

expectFailure('creative generatorVersion missing', snapshot => {
  snapshot.creativeSource.generatorVersion = '';
}, 'creative-source-complete');

expectFailure('coordinate origin tampered', snapshot => {
  (snapshot.sourcePattern.coordinateSpace as { origin: string }).origin = 'bottomRight';
}, 'source-coordinate-space');

expectFailure('generation issue generatorVersion mismatch', snapshot => {
  snapshot.creativeSource.generationIssues.push({
    id: 'issue-generator-mismatch',
    code: 'GENERATOR_MISMATCH',
    severity: 'warning',
    stage: 'translation',
    message: 'tampered issue generator',
    generatorVersion: 'different-generator',
  });
}, 'upstream-generation-domain');

expectFailure('duplicate paletteId', snapshot => {
  snapshot.sourcePattern.palette.push({ ...snapshot.sourcePattern.palette[0] });
}, 'source-palette-ids-unique');

expectFailure('duplicate elementId', snapshot => {
  snapshot.sourcePattern.elements.push({
    ...snapshot.sourcePattern.elements[0],
    pointsMm: snapshot.sourcePattern.elements[0].pointsMm.map(point => ({ ...point })),
  });
}, 'source-element-ids-unique');
