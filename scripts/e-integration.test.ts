import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStructureV03 } from '../src/modules/d/v03/calculateStructureV03';
import type { CarrierId, WeaveId } from '../src/modules/d/v03/types';
import { acceptCraftResult, craftInputDigest, validateCraft } from '../src/modules/e/validation';
import type { CraftInput } from '../src/modules/e/craftTypes';

const pattern = {
  patternId: 'green-triangle',
  coordinateSpace: { unit: 'mm' as const, width: 210, height: 297, origin: 'topLeft' as const, xAxis: 'right' as const, yAxis: 'down' as const },
  palette: [{ paletteId: 'green', color: '#315F3A' }],
  elements: [{ elementId: 'triangle', sourceInputId: 'drawing-1', kind: 'polygon' as const, paletteId: 'green', zIndex: 1,
    pointsMm: [{ x: 105, y: 65 }, { x: 70, y: 145 }, { x: 140, y: 145 }, { x: 105, y: 65 }] }],
  transform: { scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 } },
};
function input(carrierId: CarrierId, weaveId: WeaveId, revision = 2): CraftInput {
  const density = weaveId === 'SQUARE-HOLE-1X1-V1' ? 13 : 21;
  const width = 9;
  const snapshot = calculateStructureV03({
    designId: 'test-design', designRevision: revision,
    creativeSource: { confirmedGenerationId: 'generation-1', generationRevision: 1, generatorVersion: 'test', inputVersionId: 'input-1', generationIssues: [] },
    carrierId, weaveId, pattern, baseColor: '#C4A879',
    gridParameters: { warpCount: density, weftCount: density, stripWidthMm: width, pitchMm: (189 - width) / (density - 1) },
    patternPlacement: { scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, pivotMm: { x: 105, y: 110 } },
  });
  return { kind: 'fixed-fan', snapshot, current: { designId: 'test-design', designRevision: revision, confirmedGenerationId: 'generation-1' } };
}

test('E v1.5 checks current D snapshots for all fixed fans and weaves', async () => {
  const carriers: CarrierId[] = ['FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1'];
  const weaves: WeaveId[] = ['CROSS-1X1-V1', 'CROSS-COURSE-2X2-V1', 'HERRING-3X3-V1', 'SQUARE-HOLE-1X1-V1'];
  for (const carrierId of carriers) for (const weaveId of weaves) {
    const result = await validateCraft(input(carrierId, weaveId));
    assert.equal(result.structuralStatus, 'passed', `${carrierId}/${weaveId}`);
    assert.equal(result.status, weaveId === 'CROSS-1X1-V1' ? 'failed' : 'pending');
    assert.equal(result.ruleResults.length, weaveId === 'CROSS-1X1-V1' ? 20 : 19);
    assert.equal(result.summary.failedCount + result.summary.pendingCount, result.screening.issues.length);
    assert.equal(result.productionReady, false);
    assert.equal(result.screening.disabledOutputs.tutorial.enabled, false);
  }
});

test('A rejects a delayed result after the design revision changes', async () => {
  const oldInput = input('FAN-ROUND-170-V1', 'CROSS-COURSE-2X2-V1', 2);
  const oldResult = await validateCraft(oldInput);
  const currentDigest = await craftInputDigest(input('FAN-ROUND-170-V1', 'CROSS-COURSE-2X2-V1', 3));
  assert.equal(acceptCraftResult(currentDigest, oldResult), null);
});
