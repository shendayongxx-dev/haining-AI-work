import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: 'custom',
});
try {
  const { generateCandidate } = await server.ssrLoadModule('/src/modules/c/generateCandidate.ts');
  const { fixedFanRef } = await server.ssrLoadModule('/src/data/fixedFanRegistry.ts');
  const fans = ['FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1'];
  const make = (carrierId, strokes) => generateCandidate({
    carrier: 'fan', carrierRef: fixedFanRef(carrierId), channel: 'drawing',
    inputVersionId: `check-${carrierId}`, strokes: [strokes],
  });
  const triangle = [{ x: 105, y: 65 }, { x: 70, y: 145 }, { x: 140, y: 145 }, { x: 105, y: 65 }];
  for (const carrierId of fans) {
    const result = await make(carrierId, triangle);
    assert.equal(result.carrierRef.carrierId, carrierId);
    assert.equal(result.issues.filter(issue => issue.severity === 'blocking').length, 0);
    assert.deepEqual(result.result.elements[0].pointsMm, triangle);
  }
  const crossing = await make('FAN-OVAL-150X180-V1', [{ x: -10, y: 110 }, { x: 220, y: 110 }]);
  assert.equal(crossing.issues.some(issue => issue.code === 'PATTERN_OUTSIDE_CARRIER'), false);
  assert.equal(crossing.issues.some(issue => issue.code === 'PATTERN_CROSSES_EFFECTIVE_BOUNDARY'), true);
  const outside = await make('FAN-OCTAGON-170-V1', [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  assert.equal(outside.issues.some(issue => issue.code === 'PATTERN_OUTSIDE_CARRIER'), true);
  const enclosing = await make('FAN-OCTAGON-170-V1', [{ x: 0, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 220 }, { x: 0, y: 220 }, { x: 0, y: 0 }]);
  assert.equal(enclosing.issues.some(issue => issue.code === 'PATTERN_OUTSIDE_CARRIER'), false);
  const handle = await make('FAN-ROUND-170-V1', [{ x: 100, y: 165 }, { x: 100, y: 190 }]);
  assert.equal(handle.issues.some(issue => issue.code === 'HANDLE_RESERVE_OVERLAP'), true);
  console.log('PASS C fixed-fan geometry and carrier references');
} finally {
  await server.close();
}
