import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx');
  const { default: FanPreview } = await server.ssrLoadModule('/src/modules/d/FanPreview.tsx');
  const { renderStructureSvg } = await server.ssrLoadModule('/src/modules/d/v03/renderStructureSvg.ts');
  const { calculateStructureV03 } = await server.ssrLoadModule('/src/modules/d/v03/calculateStructureV03.ts');
  const { validateStructureV03 } = await server.ssrLoadModule('/src/modules/d/v03/validateStructureV03.ts');
  const home = renderToStaticMarkup(React.createElement(App));
  for (const id of ['FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1']) {
    assert.match(home, new RegExp(`title="${id} · [^"]+"`));
  }
  for (const [fixture, carrierId, shapeTag] of [
    ['oval-herring', 'FAN-OVAL-150X180-V1', 'ellipse'],
    ['octagon-square-hole', 'FAN-OCTAGON-170-V1', 'polygon'],
  ]) {
    const snapshot = JSON.parse(readFileSync(new URL(`../examples/d-v03-integration/${fixture}/structure-snapshot.json`, import.meta.url), 'utf8'));
    const candidate = {
      carrierRef: { carrierId, carrierSpecVersion: 'CARRIER-SPEC-v1.2' },
      resultType: 'surface_pattern', result: snapshot.sourcePattern,
    };
    const candidateSvg = renderToStaticMarkup(React.createElement(FanPreview, { candidate }));
    const structureSvg = renderStructureSvg(snapshot);
    assert.match(candidateSvg, new RegExp(`<${shapeTag} `));
    assert.match(structureSvg, new RegExp(`<${shapeTag} `));
    assert.match(structureSvg, /viewBox="0 0 210 297"/);
    console.log(`PASS ${fixture} candidate and structure SVG`);
  }
  const pattern = JSON.parse(readFileSync(new URL('../examples/d-v03-integration/round-cross-course/structure-snapshot.json', import.meta.url), 'utf8')).sourcePattern;
  for (const carrierId of ['FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1']) {
    for (const weaveId of ['CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']) {
      const snapshot = calculateStructureV03({
        designId: 'web-integration-check', designRevision: 1,
        creativeSource: { confirmedGenerationId: 'fixture-generation', generationRevision: 1, generatorVersion: 'fixture', inputVersionId: 'fixture-input', generationIssues: [] },
        carrierId, weaveId, pattern, baseColor: '#C4A879',
      });
      const report = validateStructureV03(snapshot);
      assert.equal(report.pass, true, `${carrierId} + ${weaveId}: ${report.checks.filter(check => !check.pass).map(check => check.id).join(', ')}`);
      assert.equal(snapshot.craftValidation.status, 'pending');
      assert.equal(snapshot.physicalValidation.status, 'not-completed');
    }
  }
  console.log('PASS all 9 fixed-fan and weave combinations');
} finally {
  await server.close();
}
