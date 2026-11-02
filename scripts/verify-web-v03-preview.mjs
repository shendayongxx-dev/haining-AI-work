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
  const { calculateCustomStructure } = await server.ssrLoadModule('/src/modules/d/calculateCustomStructure.ts');
  const { validateStructureV03 } = await server.ssrLoadModule('/src/modules/d/v03/validateStructureV03.ts');
  const { weaveForFanPreview } = await server.ssrLoadModule('/src/data/fanPreviewSelection.ts');
  const { canAdjustFanStructure, isFanWeaveAllowed } = await server.ssrLoadModule('/src/data/fanPreviewSelection.ts');
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
    assert.match(structureSvg, /<clipPath id="product-boundary">/);
    assert.equal((structureSvg.match(/clip-path="url\(#product-boundary\)"/g) ?? []).length, 2);
    console.log(`PASS ${fixture} candidate and structure SVG`);
  }
  const pattern = JSON.parse(readFileSync(new URL('../examples/d-v03-integration/round-cross-course/structure-snapshot.json', import.meta.url), 'utf8')).sourcePattern;
  let availableCombinations = 0;
  for (const carrierId of ['FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1']) {
    for (const weaveId of ['CROSS-1X1-V1', 'CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']) {
      if (!isFanWeaveAllowed(carrierId, weaveId)) continue;
      availableCombinations += 1;
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
  assert.equal(availableCombinations, 12);
  assert.equal(canAdjustFanStructure('FAN-ROUND-170-V1'), true);
  assert.equal(canAdjustFanStructure('FAN-OVAL-150X180-V1'), true);
  assert.equal(canAdjustFanStructure('FAN-OCTAGON-170-V1'), true);
  assert.equal(isFanWeaveAllowed('FAN-OVAL-150X180-V1', 'CROSS-1X1-V1'), true);
  const adjustedRound = calculateStructureV03({
    designId: 'round-adjusted', designRevision: 3,
    creativeSource: { confirmedGenerationId: 'fixture-generation', generationRevision: 1, generatorVersion: 'fixture', inputVersionId: 'fixture-input', generationIssues: [] },
    carrierId: 'FAN-ROUND-170-V1', weaveId: 'CROSS-1X1-V1', pattern, baseColor: '#C4A879',
    gridParameters: { warpCount: 15, weftCount: 15, stripWidthMm: 6, pitchMm: (189-6)/14 },
    patternPlacement: { scale: 1.3, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, pivotMm: { x: 105, y: 110 } },
  });
  assert.equal(validateStructureV03(adjustedRound).pass, true);
  assert.equal(adjustedRound.grid.warpCount, 15);
  assert.equal(adjustedRound.patternPlacement.scale, 1.3);
  const roundTopPatterns = new Set();
  for (const weaveId of ['CROSS-1X1-V1', 'CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']) {
    const recolored = { ...pattern, palette: pattern.palette.map(entry => ({ ...entry, color: '#0e6652' })) };
    const snapshot = calculateStructureV03({ designId: 'color-and-weave-check', designRevision: 4,
      creativeSource: { confirmedGenerationId: 'fixture-generation', generationRevision: 1, generatorVersion: 'fixture', inputVersionId: 'fixture-input', generationIssues: [] },
      carrierId: 'FAN-ROUND-170-V1', weaveId, pattern: recolored, baseColor: '#d6aa77' });
    assert.equal(validateStructureV03(snapshot).pass, true);
    assert.ok(snapshot.strips.some(strip => strip.visibleSegments.some(segment => segment.colorSegments.some(color => color.scope === 'motif' && color.color === '#0e6652'))));
    assert.match(renderStructureSvg(snapshot), /filter="url\(#lift\)"/);
    roundTopPatterns.add(`${snapshot.grid.pitchMm}:`+snapshot.stages.rawBlank.crossings.slice(0, 36).map(crossing => crossing.topStripId === crossing.weftStripId ? 'W' : 'V').join(''));
  }
  assert.equal(roundTopPatterns.size, 4);
  for (const carrierId of ['FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1']) {
    for (const weaveId of ['CROSS-1X1-V1', 'CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']) {
      const adjusted = calculateStructureV03({
        designId: 'non-round-adjusted', designRevision: 3,
        creativeSource: { confirmedGenerationId: 'fixture-generation', generationRevision: 1, generatorVersion: 'fixture', inputVersionId: 'fixture-input', generationIssues: [] },
        carrierId, weaveId, pattern, baseColor: '#aa9966',
        gridParameters: { warpCount: 15, weftCount: 15, stripWidthMm: 6, pitchMm: (189-6)/14 },
        patternPlacement: { scale: 1.3, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, pivotMm: { x: 105, y: 110 } },
      });
      assert.equal(validateStructureV03(adjusted).pass, true, `${carrierId} + ${weaveId} adjusted`);
      assert.equal(adjusted.grid.warpCount, 15);
      assert.equal(adjusted.patternPlacement.scale, 1.3);
      assert.ok(adjusted.strips.some(strip => strip.visibleSegments.some(segment => segment.colorSegments.some(color => color.scope === 'base' && color.color.toLowerCase() === '#aa9966'))));
    }
  }
  const shape = JSON.parse(readFileSync(new URL('../examples/c-to-d/custom-leaf-shape.candidate.json', import.meta.url), 'utf8')).generation.result;
  const customTopPatterns = new Set();
  for (const weaveId of ['CROSS-1X1-V1', 'CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1']) {
    const custom = calculateCustomStructure({ schemaVersion: '0.2', designId: 'custom-weaves', designRevision: 2,
      confirmedGenerationId: 'fixture-generation', shape, generationIssues: [], weaveId,
      parameters: { density: weaveId === 'SQUARE-HOLE-1X1-V1' ? 13 : 21, stripWidthMm: 6,
        warpColor: '#c4a879', weftColor: '#315f3a', shapeScale: 1 } });
    assert.equal(custom.status, 'ok');
    assert.ok(custom.snapshot.interlace.crossings.length > 0);
    customTopPatterns.add(custom.snapshot.interlace.crossings.map(crossing => crossing.top).join(','));
  }
  assert.equal(customTopPatterns.size, 4);
  console.log('PASS 12 fan combinations and four distinct custom-shape crossing patterns');
  const confirmed = {
    carrierRef: { carrierId: 'FAN-ROUND-170-V1', carrierSpecVersion: 'CARRIER-SPEC-v1.2' },
    resultType: 'surface_pattern', result: pattern,
  };
  const switchedPreview = renderToStaticMarkup(React.createElement(FanPreview, { candidate: confirmed, carrierId: 'FAN-OCTAGON-170-V1' }));
  assert.match(switchedPreview, /aria-label="八角式表面图样候选"/);
  assert.match(switchedPreview, /<polygon points="70,25 140,25/);
  assert.equal(confirmed.carrierRef.carrierId, 'FAN-ROUND-170-V1');
  const switchedSnapshot = calculateStructureV03({
    designId: 'same-confirmed-idea', designRevision: 2,
    creativeSource: { confirmedGenerationId: 'same-generation', generationRevision: 1, generatorVersion: 'fixture', inputVersionId: 'same-input', generationIssues: [] },
    carrierId: 'FAN-OCTAGON-170-V1', weaveId: 'HERRING-3X3-V1', pattern: confirmed.result, baseColor: '#C4A879',
  });
  assert.equal(switchedSnapshot.carrierId, 'FAN-OCTAGON-170-V1');
  assert.equal(switchedSnapshot.creativeSource.confirmedGenerationId, 'same-generation');
  assert.deepEqual(switchedSnapshot.sourcePattern, pattern);
  assert.equal(validateStructureV03(switchedSnapshot).pass, true);
  console.log('PASS confirmed idea reused on another fixed fan without regeneration');
  assert.equal(weaveForFanPreview('CROSS-1X1-V1', 'FAN-OCTAGON-170-V1'), 'CROSS-1X1-V1');
  assert.equal(weaveForFanPreview('HERRING-3X3-V1', 'FAN-OCTAGON-170-V1'), 'HERRING-3X3-V1');
  assert.equal(weaveForFanPreview('CROSS-1X1-V1', 'FAN-ROUND-170-V1'), 'CROSS-1X1-V1');
  console.log('PASS weave selection stays usable when switching fixed fans');
} finally {
  await server.close();
}
