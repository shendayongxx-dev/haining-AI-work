import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { generateCandidate, canConfirmCandidate } = await server.ssrLoadModule('/src/modules/c/generateCandidate.ts');
  const base = { channel: 'drawing', carrier: 'custom', carrierRef: null, captureMethod: 'cameraGesture' };

  const noisyOutline = [
    { x: 30, y: 30 }, { x: 90, y: 30 }, { x: 84, y: 36 }, { x: 94, y: 38 },
    { x: 86, y: 27 }, { x: 150, y: 32 }, { x: 170, y: 100 }, { x: 145, y: 190 },
    { x: 70, y: 215 }, { x: 28, y: 150 }, { x: 30, y: 30 },
  ];
  const repaired = await generateCandidate({ ...base, inputVersionId: 'local-loop', strokes: [noisyOutline] });
  assert.equal(canConfirmCandidate(repaired), true, 'a small hand-jitter loop should be repaired');
  assert.ok(repaired.issues.some(issue => ['OUTLINE_AUTO_REFINED', 'SELF_INTERSECTION_AUTO_REPAIRED'].includes(issue.code)));
  assert.equal(repaired.issues.some(issue => issue.code === 'SELF_INTERSECTION'), false);

  const bowTie = [
    { x: 30, y: 30 }, { x: 170, y: 210 }, { x: 30, y: 210 }, { x: 170, y: 30 }, { x: 30, y: 30 },
  ];
  const structuralCrossing = await generateCandidate({ ...base, inputVersionId: 'structural-crossing', strokes: [bowTie] });
  assert.equal(canConfirmCandidate(structuralCrossing), false, 'a large structural crossing should remain blocked');
  assert.ok(structuralCrossing.issues.some(issue => issue.code === 'SELF_INTERSECTION'));

  console.log('PASS local self-intersection repaired; structural crossing remains protected');
} finally {
  await server.close();
}
