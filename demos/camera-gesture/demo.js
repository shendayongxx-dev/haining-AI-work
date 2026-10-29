import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm";
import { createCameraSession, createPinchDrawingController } from "../../src/modules/creative-input/camera-interaction.mjs";

const elements = {
  video: document.querySelector("#camera"),
  handCanvas: document.querySelector("#handOverlay"),
  drawCanvas: document.querySelector("#drawingCanvas"),
  drawingStage: document.querySelector("#drawingStage"),
  cameraStage: document.querySelector(".camera-stage"),
  cameraEmpty: document.querySelector("#cameraEmpty"),
  start: document.querySelector("#startCamera"),
  stop: document.querySelector("#stopCamera"),
  undo: document.querySelector("#undoDrawing"),
  clear: document.querySelector("#clearDrawing"),
  mirror: document.querySelector("#mirrorInput"),
  systemStatus: document.querySelector("#systemStatus"),
  handStatus: document.querySelector("#handStatus"),
  drawStatus: document.querySelector("#drawStatus"),
  strokeCount: document.querySelector("#strokeCount"),
};

const state = {
  handLandmarker: null,
  camera: null,
  running: false,
  animationFrame: 0,
  lastVideoTime: -1,
  strokes: [],
  activeStroke: null,
  cursor: null,
};

let gestureController = createGestureController();
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

bootstrap();

async function bootstrap() {
  bindControls();
  resizeCanvases();
  window.addEventListener("resize", resizeCanvases);
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
    );
    state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    setSystemStatus("手势模型已就绪", "ready");
    elements.start.disabled = false;
  } catch (error) {
    console.error(error);
    setSystemStatus("模型加载失败，请检查网络后刷新", "error");
  }
}

function bindControls() {
  elements.start.addEventListener("click", startCamera);
  elements.stop.addEventListener("click", stopCamera);
  elements.undo.addEventListener("click", () => {
    state.strokes.pop();
    renderDrawing();
    updateDrawingControls();
  });
  elements.clear.addEventListener("click", () => {
    state.strokes = [];
    state.activeStroke = null;
    gestureController.cancel();
    renderDrawing();
    updateDrawingControls();
  });
  elements.mirror.addEventListener("change", () => {
    elements.cameraStage.classList.toggle("no-mirror", !elements.mirror.checked);
    gestureController.cancel();
    gestureController = createGestureController();
  });
}

async function startCamera() {
  if (!state.handLandmarker || state.running) return;
  elements.start.disabled = true;
  setSystemStatus("正在请求摄像头权限…", "loading");
  state.camera ??= createCameraSession({ mediaDevices: navigator.mediaDevices, videoElement: elements.video });
  try {
    await state.camera.start();
    state.running = true;
    state.lastVideoTime = -1;
    elements.cameraEmpty.classList.add("hidden");
    elements.stop.disabled = false;
    setSystemStatus("摄像头运行中", "ready");
    setHandStatus("请把一只手放入画面");
    predictLoop();
  } catch (error) {
    setSystemStatus(error.message, "error");
    elements.start.disabled = false;
  }
}

function stopCamera() {
  if (!state.running && !state.camera?.getStream()) return;
  state.running = false;
  cancelAnimationFrame(state.animationFrame);
  state.camera.stop();
  const completion = gestureController.cancel();
  commitGestureEvent(completion);
  clearHandOverlay();
  state.cursor = null;
  elements.cameraEmpty.classList.remove("hidden");
  elements.start.disabled = false;
  elements.stop.disabled = true;
  setSystemStatus("手势模型已就绪", "ready");
  setHandStatus("等待启动");
  elements.drawStatus.textContent = "等待手势";
  elements.drawStatus.classList.remove("active");
  renderDrawing();
}

function predictLoop() {
  if (!state.running) return;
  if (elements.video.readyState >= 2 && elements.video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = elements.video.currentTime;
    const result = state.handLandmarker.detectForVideo(elements.video, performance.now());
    const landmarks = result.landmarks?.[0];
    renderHand(landmarks);
    commitGestureEvent(gestureController.update({
      landmarks,
      mirrored: elements.mirror.checked,
      timestamp: performance.now(),
    }));
  }
  state.animationFrame = requestAnimationFrame(predictLoop);
}

function createGestureController() {
  return createPinchDrawingController({
    startThreshold: 0.32,
    stopThreshold: 0.43,
    smoothingFactor: 0.58,
    maximumLostFrames: 4,
    createId: () => `gesture-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    style: { color: "#315f3a", width: 0.014 },
  });
}

function commitGestureEvent(event) {
  if (!event) return;
  if (event.cursor) state.cursor = event.cursor;
  if (event.type === "stroke-start" || event.type === "stroke-update") {
    state.activeStroke = event.stroke;
    setHandStatus("已识别手部 · 正在捏合", true);
    elements.drawStatus.textContent = "正在绘制";
    elements.drawStatus.classList.add("active");
  } else if (event.type === "stroke-complete") {
    if (event.stroke?.points?.length > 1 && event.reason !== "cancelled") state.strokes.push(event.stroke);
    state.activeStroke = null;
    setHandStatus(event.reason === "tracking_lost" ? "手部离开画面" : "已识别手部 · 移动食指", true);
    elements.drawStatus.textContent = "松开，已完成一笔";
    elements.drawStatus.classList.remove("active");
    updateDrawingControls();
  } else if (event.type === "cursor") {
    setHandStatus("已识别手部 · 捏合开始画", true);
    elements.drawStatus.textContent = "移动光标中";
    elements.drawStatus.classList.remove("active");
  } else if (event.type === "tracking-missing") {
    setHandStatus("未检测到手部");
  }
  renderDrawing();
}

function renderHand(landmarks) {
  const canvas = elements.handCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const toCanvas = (point) => ({ x: point.x * canvas.width, y: point.y * canvas.height });
  context.strokeStyle = "rgba(201, 220, 112, .74)";
  context.lineWidth = Math.max(2, canvas.width / 260);
  context.lineCap = "round";
  for (const [from, to] of HAND_CONNECTIONS) {
    const a = toCanvas(landmarks[from]);
    const b = toCanvas(landmarks[to]);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }
  landmarks.forEach((point, index) => {
    const p = toCanvas(point);
    context.beginPath();
    context.arc(p.x, p.y, index === 4 || index === 8 ? 6 : 3, 0, Math.PI * 2);
    context.fillStyle = index === 4 || index === 8 ? "#dcef71" : "#f6f9e6";
    context.fill();
  });
}

function renderDrawing() {
  const canvas = elements.drawCanvas;
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  const boundary = createFanPath(width, height);
  context.save();
  context.clip(boundary);
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, width, height);
  drawSubtleWeave(context, width, height);
  for (const stroke of [...state.strokes, ...(state.activeStroke ? [state.activeStroke] : [])]) drawStroke(context, stroke, width, height);
  if (state.cursor) drawCursor(context, state.cursor, width, height, Boolean(state.activeStroke));
  context.restore();
  context.strokeStyle = "#315f3a";
  context.lineWidth = Math.max(2, width / 340);
  context.stroke(boundary);
}

function createFanPath(width, height) {
  const path = new Path2D();
  const cx = width * 0.5;
  const cy = height * 0.94;
  const radius = Math.min(width * 0.46, height * 0.84);
  path.moveTo(cx, cy);
  path.arc(cx, cy, radius, Math.PI * 1.16, Math.PI * 1.84);
  path.closePath();
  return path;
}

function drawSubtleWeave(context, width, height) {
  context.strokeStyle = "rgba(97, 107, 87, .055)";
  context.lineWidth = 1;
  const gap = Math.max(18, width / 30);
  for (let x = -height; x < width + height; x += gap) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x + height, height); context.stroke();
    context.beginPath(); context.moveTo(x + height, 0); context.lineTo(x, height); context.stroke();
  }
}

function drawStroke(context, stroke, width, height) {
  if (!stroke.points.length) return;
  context.beginPath();
  context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
  for (const point of stroke.points.slice(1)) context.lineTo(point.x * width, point.y * height);
  context.strokeStyle = stroke.color ?? "#315f3a";
  context.lineWidth = Math.max(3, (stroke.width ?? 0.014) * Math.min(width, height));
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

function drawCursor(context, cursor, width, height, drawing) {
  const x = cursor.x * width;
  const y = cursor.y * height;
  context.beginPath();
  context.arc(x, y, drawing ? 10 : 7, 0, Math.PI * 2);
  context.fillStyle = drawing ? "#c9dc70" : "#315f3a";
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.95)";
  context.lineWidth = 3;
  context.stroke();
}

function resizeCanvases() {
  for (const canvas of [elements.handCanvas, elements.drawCanvas]) {
    const box = canvas.getBoundingClientRect();
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * density));
    canvas.height = Math.max(1, Math.round(box.height * density));
  }
  renderDrawing();
}

function clearHandOverlay() {
  const context = elements.handCanvas.getContext("2d");
  context.clearRect(0, 0, elements.handCanvas.width, elements.handCanvas.height);
}

function updateDrawingControls() {
  const hasStrokes = state.strokes.length > 0;
  elements.undo.disabled = !hasStrokes;
  elements.clear.disabled = !hasStrokes;
  elements.strokeCount.textContent = `${state.strokes.length} 笔`;
}

function setSystemStatus(message, status) {
  elements.systemStatus.textContent = message;
  elements.systemStatus.dataset.state = status;
}

function setHandStatus(message, active = false) {
  elements.handStatus.textContent = message;
  elements.handStatus.classList.toggle("active", active);
}

window.addEventListener("pagehide", stopCamera);
