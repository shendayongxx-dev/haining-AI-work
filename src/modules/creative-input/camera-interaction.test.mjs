import assert from "node:assert/strict";
import test from "node:test";

import { closeGestureLoop, createCameraSession, createPinchDrawingController, mapNormalizedPointToDesignSpace, normalizeCameraError } from "./camera-interaction.mjs";

test("camera session starts, attaches, and stops every media track", async () => {
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] };
  const video = { srcObject: null, play: async () => {} };
  const session = createCameraSession({ mediaDevices: { getUserMedia: async () => stream }, videoElement: video });
  assert.equal(await session.start(), stream);
  assert.equal(video.srcObject, stream);
  session.stop();
  assert.equal(stopped, 2);
  assert.equal(video.srcObject, null);
});

test("camera session maps permission errors to a recoverable code", async () => {
  const cause = new Error("denied");
  cause.name = "NotAllowedError";
  const session = createCameraSession({ mediaDevices: { getUserMedia: async () => { throw cause; } } });
  await assert.rejects(session.start(), (error) => error.code === "CAMERA_PERMISSION_DENIED");
  assert.equal(normalizeCameraError(cause).code, "CAMERA_PERMISSION_DENIED");
});

test("pinch controller creates a mirrored camera stroke and completes after release", () => {
  const controller = createPinchDrawingController({ createId: () => "camera-stroke", smoothingFactor: 0 });
  const started = controller.update(frame({ index: { x: 0.2, y: 0.4 }, thumb: { x: 0.22, y: 0.4 } }));
  const updated = controller.update(frame({ index: { x: 0.3, y: 0.5 }, thumb: { x: 0.32, y: 0.5 } }));
  const completed = controller.update(frame({ index: { x: 0.4, y: 0.5 }, thumb: { x: 0.8, y: 0.5 } }));

  assert.equal(started.type, "stroke-start");
  assert.deepEqual(started.stroke.points[0], { x: 0.8, y: 0.4, timestamp: 1 });
  assert.equal(updated.type, "stroke-update");
  assert.equal(completed.type, "stroke-complete");
  assert.equal(completed.reason, "pinch_released");
  assert.equal(completed.stroke.captureMethod, "cameraGesture");
});

test("pinch controller completes active stroke after repeated tracking loss", () => {
  const controller = createPinchDrawingController({ createId: () => "camera-stroke", maximumLostFrames: 1 });
  controller.update(frame({ index: { x: 0.2, y: 0.4 }, thumb: { x: 0.22, y: 0.4 } }));
  assert.equal(controller.update({ landmarks: [] }).type, "tracking-missing");
  const completed = controller.update({ landmarks: [] });
  assert.equal(completed.type, "stroke-complete");
  assert.equal(completed.reason, "tracking_lost");
});

test("camera points map into the public design space and clamp at its boundary", () => {
  assert.deepEqual(mapNormalizedPointToDesignSpace({ x: 0.5, y: 0.25 }, 210, 220), { x: 105, y: 55 });
  assert.deepEqual(mapNormalizedPointToDesignSpace({ x: 1.2, y: -0.1 }, 210, 297), { x: 210, y: 0 });
});

test("near-complete gesture outlines close for motif filling while open paths stay open", () => {
  const loop = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 28, y: 25 }];
  const open = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 50, y: 90 }];
  const closed = closeGestureLoop(loop);
  assert.deepEqual(closed.at(-1), closed[0]);
  assert.equal(closed.length, loop.length + 1);
  assert.equal(closeGestureLoop(open).length, open.length);
});

function frame({ index, thumb }) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[0] = { x: 0.5, y: 0.9 };
  landmarks[9] = { x: 0.5, y: 0.5 };
  landmarks[4] = thumb;
  landmarks[8] = index;
  return { landmarks, timestamp: 1, mirrored: true };
}
