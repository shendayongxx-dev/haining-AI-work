import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { generateCandidate } = await server.ssrLoadModule('/src/modules/c/generateCandidate.ts');
  const { fixedFanRef } = await server.ssrLoadModule('/src/data/fixedFanRegistry.ts');
  const { calculateStructureV03 } = await server.ssrLoadModule('/src/modules/d/v03/calculateStructureV03.ts');
  const candidate = await generateCandidate({
    channel: 'drawing',
    captureMethod: 'cameraGesture',
    carrier: 'fan',
    carrierRef: fixedFanRef('FAN-ROUND-170-V1'),
    inputVersionId: 'gesture-preview-test',
    generationRevision: 1,
    strokes: [[{ x: 80, y: 70 }, { x: 125, y: 70 }, { x: 135, y: 120 }, { x: 75, y: 125 }, { x: 84, y: 75 }]],
  });
  assert.equal(candidate.resultType, 'surface_pattern');
  assert.equal(candidate.result.elements[0].kind, 'polygon');
  const snapshot = calculateStructureV03({
    designId: 'gesture-preview-test',
    designRevision: 1,
    creativeSource: {
      confirmedGenerationId: candidate.generationId,
      generationRevision: candidate.generationRevision,
      generatorVersion: candidate.generatorVersion,
      inputVersionId: candidate.inputVersionId,
      generationIssues: candidate.issues,
    },
    carrierId: 'FAN-ROUND-170-V1',
    weaveId: 'CROSS-COURSE-2X2-V1',
    pattern: candidate.result,
    baseColor: '#C4A879',
    gridParameters: { warpCount: 21, weftCount: 21, stripWidthMm: 9, pitchMm: 9 },
    patternPlacement: { scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, pivotMm: { x: 105, y: 110 } },
  });
  const motifSegments = snapshot.strips.flatMap(strip => strip.visibleSegments).flatMap(segment => segment.colorSegments).filter(segment => segment.scope === 'motif');
  assert.ok(motifSegments.length > 0, 'gesture polygon should create motif color segments in the fan structure');
  console.log(`PASS gesture outline creates ${motifSegments.length} motif color segments`);
} finally {
  await server.close();
}
