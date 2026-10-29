import type { FanStructureInput } from './types';

// Temporary D-side adapter fixture derived from the current repository C placeholder coordinates.
// It is not C's required V0.2 JSON and must not be used to claim C→A→D acceptance.
export const greenTriangleRevision1: FanStructureInput = {
  schemaVersion: '0.2',
  designId: 'demo-fan-green-triangle',
  designRevision: 1,
  confirmedGenerationId: 'demo-generation-awaiting-c-v0.2-fixture',
  pattern: {
    patternId: 'demo-pattern-awaiting-c-v0.2-fixture',
    palette: [
      { paletteId: 'bamboo-base', color: '#ead8b5', role: 'base' },
      { paletteId: 'triangle-green', color: '#488b5c', role: 'pattern' },
    ],
    elements: [{
      elementId: 'demo-element-awaiting-c-v0.2-fixture',
      kind: 'polygon',
      paletteId: 'triangle-green',
      zIndex: 1,
      pointsMm: [{ x: 130, y: 35 }, { x: 95, y: 105 }, { x: 165, y: 105 }],
    }],
    transform: { scale: 1, rotationDeg: 0, translateMm: { x: 0, y: 0 } },
  },
  parameters: { density: 65, stripWidthMm: 3, weaveId: 'plain-demo' },
};

export const greenTriangleRevision2: FanStructureInput = {
  ...greenTriangleRevision1,
  designRevision: 2,
  pattern: {
    ...greenTriangleRevision1.pattern,
    transform: { ...greenTriangleRevision1.pattern.transform, scale: 1.1 },
  },
  parameters: { ...greenTriangleRevision1.parameters, density: 60, stripWidthMm: 3.5 },
};
