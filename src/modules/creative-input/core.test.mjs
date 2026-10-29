import assert from "node:assert/strict";
import test from "node:test";

import {
  canConfirmGeneration,
  hasSelfIntersection,
  signedArea,
  translateDrawing,
} from "./core.mjs";

const coordinateSpace = {
  unit: "mm",
  width: 200,
  height: 120,
  origin: "topLeft",
  xAxis: "right",
  yAxis: "down",
};

function request(overrides = {}) {
  return {
    designId: "design-demo-001",
    inputVersionId: "input-001",
    generationId: "generation-001",
    generationRevision: 1,
    carrier: { type: "fan", coordinateSpace },
    input: {
      channel: "drawing",
      captureMethod: "pointer",
      drawingSpace: {
        width: 1,
        height: 1,
        unit: "normalized",
        origin: "topLeft",
        xAxis: "right",
        yAxis: "down",
      },
      strokes: [
        {
          id: "stroke-001",
          color: "#315F3A",
          width: 0.02,
          closed: true,
          points: [
            { x: 0.35, y: 0.62 },
            { x: 0.45, y: 0.48 },
            { x: 0.55, y: 0.62 },
            { x: 0.35, y: 0.62 },
          ],
        },
      ],
    },
    ...overrides,
  };
}

test("translates normalized fan drawing into an mm surface pattern", () => {
  const result = translateDrawing(request());

  assert.equal(result.status, "succeeded");
  assert.equal(result.generatorVersion, "c-core-v0.1");
  assert.equal(result.result.resultType, "surface_pattern");
  assert.deepEqual(result.result.elements[0].pointsMm[0], { x: 70, y: 74.4 });
  assert.equal(result.result.elements[0].type, "polygon");
  assert.equal(canConfirmGeneration(result), true);
});

test("keeps an open fan stroke as an editable polyline", () => {
  const openRequest = request();
  openRequest.input.strokes[0].closed = false;
  openRequest.input.strokes[0].points.pop();

  const result = translateDrawing(openRequest);

  assert.equal(result.result.elements[0].type, "polyline");
  assert.equal(result.result.elements[0].strokeWidthMm, 2.4);
});

test("blocks confirmation for an open custom-shape boundary", () => {
  const customRequest = request({
    carrier: { type: "custom", coordinateSpace },
  });
  customRequest.input.strokes[0].closed = false;
  customRequest.input.strokes[0].points.pop();

  const result = translateDrawing(customRequest);

  assert.equal(result.result.resultType, "carrier_shape");
  assert.equal(result.issues[0].code, "OPEN_BOUNDARY");
  assert.equal(result.issues[0].source.generatorVersion, "c-core-v0.1");
  assert.equal(canConfirmGeneration(result), false);
});

test("detects a self-intersecting custom-shape boundary", () => {
  const customRequest = request({
    carrier: { type: "custom", coordinateSpace },
  });
  customRequest.input.strokes[0].points = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.8 },
    { x: 0.2, y: 0.2 },
  ];

  const result = translateDrawing(customRequest);

  assert.equal(result.issues.some((entry) => entry.code === "SELF_INTERSECTION"), true);
  assert.deepEqual(result.issues.find((entry) => entry.code === "SELF_INTERSECTION").location, { x: 100, y: 60, unit: "mm" });
  assert.equal(canConfirmGeneration(result), false);
});

test("geometry helpers distinguish area and self-intersection", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 0, y: 0 },
  ];
  assert.equal(Math.abs(signedArea(square)), 100);
  assert.equal(hasSelfIntersection(square), false);
});

test("translates pixel coordinates into the same public mm space", () => {
  const pixelRequest = request();
  pixelRequest.input.drawingSpace = {
    width: 1000,
    height: 600,
    unit: "px",
    origin: "topLeft",
    xAxis: "right",
    yAxis: "down",
  };
  pixelRequest.input.strokes[0].points = [
    { x: 350, y: 372 },
    { x: 450, y: 288 },
    { x: 550, y: 372 },
    { x: 350, y: 372 },
  ];
  pixelRequest.input.strokes[0].width = 20;

  const result = translateDrawing(pixelRequest);

  assert.deepEqual(result.result.elements[0].pointsMm[0], { x: 70, y: 74.4 });
});

test("marks multiple closed custom-shape components as pending warning", () => {
  const customRequest = request({
    carrier: { type: "custom", coordinateSpace },
  });
  customRequest.input.strokes.push({
    id: "stroke-002",
    color: "#315F3A",
    width: 0.02,
    closed: true,
    points: [
      { x: 0.65, y: 0.3 },
      { x: 0.75, y: 0.5 },
      { x: 0.65, y: 0.7 },
      { x: 0.65, y: 0.3 },
    ],
  });

  const result = translateDrawing(customRequest);

  assert.equal(result.issues.some((entry) => entry.code === "MULTIPLE_COMPONENTS"), true);
  assert.equal(result.issues.some((entry) => entry.severity === "blocking"), false);
  assert.equal(canConfirmGeneration(result), true);
});

test("returns a blocking failed result for an empty drawing", () => {
  const emptyRequest = request();
  emptyRequest.input.strokes = [];

  const result = translateDrawing(emptyRequest);

  assert.equal(result.status, "failed");
  assert.equal(result.result, undefined);
  assert.equal(result.issues[0].code, "GENERATION_FAILED");
  assert.equal(canConfirmGeneration(result), false);
});
