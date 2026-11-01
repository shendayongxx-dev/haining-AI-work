import { readFileSync } from 'node:fs';

const cases = ['round-cross-course', 'oval-herring', 'octagon-square-hole'];
let failed = false;
for (const name of cases) {
  const base = new URL(`../examples/d-v03-integration/${name}/`, import.meta.url);
  const snapshot = JSON.parse(readFileSync(new URL('structure-snapshot.json', base), 'utf8'));
  const report = JSON.parse(readFileSync(new URL('validation-report.json', base), 'utf8'));
  const matrix = readFileSync(new URL('crossing-matrix.csv', base), 'utf8').trim().split('\n');
  const expected = snapshot.grid.warpCount * snapshot.grid.weftCount;
  const directChecks = [
    snapshot.stages.rawBlank.crossings.length === expected,
    snapshot.stages.rawBlank.weavingOrder.length === expected,
    snapshot.stages.rawBlank.strips.every(strip => strip.stockLengthMm === null && strip.setupAllowanceMm === null && strip.trimWasteLengthMm === null),
    snapshot.engineeringWarnings.every(warning => warning.status === 'pending'),
    matrix.length === snapshot.grid.weftCount + 1 && matrix.every(row => row.split(',').length === snapshot.grid.warpCount + 1),
  ];
  const pass = report.pass && directChecks.every(Boolean);
  failed ||= !pass;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${snapshot.stages.rawBlank.strips.length} strips, ${expected} crossings, ${snapshot.stages.trimmedProduct.visibleCrossingIds.length} visible`);
}
if (failed) process.exitCode = 1;
