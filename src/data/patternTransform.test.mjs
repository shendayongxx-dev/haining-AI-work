import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPatternTransform } from './patternTransform.mjs';

test('scale, clockwise rotation, then offset share one fixed numeric contract', () => {
  const transform = { scale: 2, rotationDeg: 90, pivotMm: { x: 105, y: 110 }, offsetMm: { x: 3, y: -4 } };
  const a = applyPatternTransform({ x: 115, y: 110 }, transform);
  const b = applyPatternTransform({ x: 105, y: 100 }, transform);
  assert.ok(Math.abs(a.x - 108) < 1e-9 && Math.abs(a.y - 126) < 1e-9);
  assert.ok(Math.abs(b.x - 128) < 1e-9 && Math.abs(b.y - 106) < 1e-9);
});
