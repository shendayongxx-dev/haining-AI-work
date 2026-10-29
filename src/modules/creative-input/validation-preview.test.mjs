import assert from "node:assert/strict";
import test from "node:test";

import { findDuplicateConsecutivePoints, findSelfIntersections } from "./geometry-analysis.mjs";
import { renderGenerationPreviewSvg } from "./preview-svg.mjs";
import { translateDrawing } from "./core.mjs";
import { validateGenerationResult } from "./result-validator.mjs";

function fanGeneration() {
  return translateDrawing({
    designId: "design",
    inputVersionId: "input",
    generationId: "generation",
    generationRevision: 1,
    carrier: {
      type: "fan",
      coordinateSpace: { unit: "mm", width: 200, height: 120, origin: "topLeft", xAxis: "right", yAxis: "down" },
    },
    input: {
      channel: "drawing",
      captureMethod: "pointer",
      drawingSpace: { unit: "normalized", width: 1, height: 1, origin: "topLeft", xAxis: "right", yAxis: "down" },
      strokes: [{
        id: "stroke",
        color: "#315f3a",
        width: 0.02,
        closed: true,
        points: [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.1 }, { x: 0.8, y: 0.3 }, { x: 0.2, y: 0.3 }],
      }],
    },
  });
}

test("geometry analysis returns the crossing location and segment indexes", () => {
  const crossings = findSelfIntersections([
    { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 },
  ]);
  assert.deepEqual(crossings, [{ firstSegmentIndex: 0, secondSegmentIndex: 2, point: { x: 5, y: 5 } }]);
});

test("geometry analysis reports consecutive duplicate points", () => {
  assert.deepEqual(findDuplicateConsecutivePoints([{ x: 1, y: 1 }, { x: 1, y: 1 }]), [{ index: 1, point: { x: 1, y: 1 } }]);
});

test("validates a generated fan pattern", () => {
  assert.deepEqual(validateGenerationResult(fanGeneration()), []);
});

test("validator rejects missing palette references and non-mm public geometry", () => {
  const generation = fanGeneration();
  generation.result.coordinateSpace.unit = "normalized";
  generation.result.elements[0].paletteId = "missing";
  const codes = validateGenerationResult(generation).map((entry) => entry.code);
  assert.equal(codes.includes("INVALID_PUBLIC_UNIT"), true);
  assert.equal(codes.includes("UNKNOWN_PALETTE_ID"), true);
});

test("renders a safe creative-result SVG preview", () => {
  const svg = renderGenerationPreviewSvg(fanGeneration(), { label: '预览"测试' });
  assert.match(svg, /<polygon/);
  assert.match(svg, /data-element-id="generation-element-001"/);
  assert.match(svg, /aria-label="预览&quot;测试"/);
  assert.doesNotMatch(svg, /<script/);
});
