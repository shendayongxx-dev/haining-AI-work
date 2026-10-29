import assert from "node:assert/strict";
import test from "node:test";

import { createDrawingHistory } from "./drawing-history.mjs";
import { closeStroke, processStroke, suggestClosure } from "./path-processing.mjs";
import { createPointerDrawingController } from "./pointer-controller.mjs";

const bounds = { left: 100, top: 50, width: 400, height: 200 };

function pointer(pointerId, clientX, clientY, extra = {}) {
  return {
    pointerId,
    clientX,
    clientY,
    pointerType: "mouse",
    isPrimary: true,
    timeStamp: 1,
    ...extra,
  };
}

test("pointer controller captures one primary pointer and normalizes coordinates", () => {
  const controller = createPointerDrawingController({ createId: () => "stroke-001" });
  const started = controller.pointerDown(pointer(1, 100, 50), bounds, { color: "#000000", width: 4 });
  const moved = controller.pointerMove(pointer(1, 300, 150), bounds);
  const completed = controller.pointerUp(pointer(1, 500, 250), bounds);

  assert.equal(started.id, "stroke-001");
  assert.deepEqual(started.points[0], { x: 0, y: 0, pressure: undefined, timestamp: 1 });
  assert.deepEqual(moved.points.at(-1), { x: 0.5, y: 0.5, pressure: undefined, timestamp: 1 });
  assert.deepEqual(completed.points.at(-1), { x: 1, y: 1, pressure: undefined, timestamp: 1 });
  assert.equal(controller.getActiveStroke(), null);
});

test("pointer controller ignores secondary and unrelated pointers", () => {
  const controller = createPointerDrawingController({ createId: () => "stroke-001" });
  assert.equal(controller.pointerDown(pointer(2, 100, 50, { isPrimary: false }), bounds, { color: "#000", width: 4 }), null);
  controller.pointerDown(pointer(1, 100, 50), bounds, { color: "#000", width: 4 });
  assert.equal(controller.pointerMove(pointer(2, 200, 100), bounds), null);
});

test("pen pressure is retained and mouse pressure is omitted", () => {
  const controller = createPointerDrawingController({ createId: () => "stroke-001" });
  const started = controller.pointerDown(pointer(1, 200, 100, { pointerType: "pen", pressure: 0.7 }), bounds, { color: "#000", width: 4 });
  assert.equal(started.points[0].pressure, 0.7);
});

test("drawing history supports add, undo, redo and clears redo after new drawing", () => {
  const history = createDrawingHistory();
  const strokeA = { id: "a", points: [{ x: 0, y: 0 }] };
  const strokeB = { id: "b", points: [{ x: 1, y: 1 }] };

  history.add(strokeA);
  history.add(strokeB);
  assert.deepEqual(history.undo().strokes.map((stroke) => stroke.id), ["a"]);
  assert.deepEqual(history.redo().strokes.map((stroke) => stroke.id), ["a", "b"]);
  history.undo();
  const snapshot = history.add({ id: "c", points: [{ x: 0.5, y: 0.5 }] });
  assert.equal(snapshot.canRedo, false);
  assert.deepEqual(snapshot.strokes.map((stroke) => stroke.id), ["a", "c"]);
});

test("drawing history clear is recoverable with undo", () => {
  const history = createDrawingHistory([{ id: "a", points: [{ x: 0, y: 0 }] }]);
  assert.equal(history.clear().strokes.length, 0);
  assert.deepEqual(history.undo().strokes.map((stroke) => stroke.id), ["a"]);
  assert.equal(history.redo().strokes.length, 0);
});

test("path processing keeps original points and reports simplification", () => {
  const processed = processStroke({
    id: "stroke",
    points: [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0.0001 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ],
  });
  assert.equal(processed.originalPoints.length, 4);
  assert.equal(processed.processing.removedDuplicatePoints, 1);
  assert.equal(processed.points.length < processed.originalPoints.length, true);
});

test("closure is suggested but only applied explicitly", () => {
  const stroke = {
    id: "stroke",
    closed: false,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.11, y: 0.11 },
    ],
  };
  assert.equal(suggestClosure(stroke, 0.02).suggested, true);
  const closed = closeStroke(stroke);
  assert.equal(closed.closed, true);
  assert.deepEqual(closed.points[0], closed.points.at(-1));
});
