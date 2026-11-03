import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Carrier, Point } from './model';
import type { FixedFanCarrierId } from './data/fixedFanRegistry';
import { fixedFanRef, resolveFixedFan } from './data/fixedFanRegistry';
import FixedFanShape from './FixedFanShape';
import { prepareCustomShapeStroke } from './modules/c/shapeProcessing';
import { closeGestureLoop, createCameraSession, createPinchDrawingController, mapNormalizedPointToDesignSpace } from './modules/creative-input/camera-interaction.mjs';

type Stroke = Point[];
type GesturePoint = Point & { timestamp?: number };
type GestureStroke = { points: GesturePoint[] };
type GestureEvent = { type: string; reason?: string; cursor?: GesturePoint; stroke?: GestureStroke } | null;

const VISION_VERSION = '0.10.22-rc.20250304';
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
// Custom drawing is presented as a landscape 4:3 workspace; values are design-space units, not a physical size.
const CUSTOM_CANVAS_HEIGHT = 157.5;
const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]] as const;

export default function GestureDrawingCanvas({ carrier, fanVariantId, strokes, onChange, onUsePointer }: {
  carrier: Carrier;
  fanVariantId: FixedFanCarrierId;
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  onUsePointer: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const cameraWindowRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<ReturnType<typeof createCameraSession> | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const controllerRef = useRef(createController());
  const animationRef = useRef(0);
  const runningRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const strokesRef = useRef(strokes);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('启动摄像头后，把一只手放进画面');
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<Stroke>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [cameraPosition, setCameraPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const isFan = carrier === 'fan';
  const height = isFan ? 220 : CUSTOM_CANVAS_HEIGHT;
  const fan = resolveFixedFan(fixedFanRef(fanVariantId));

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => () => stopCamera(), []);

  function createController() {
    return createPinchDrawingController({
      startThreshold: 0.32,
      stopThreshold: 0.43,
      smoothingFactor: 0.58,
      maximumLostFrames: 4,
      createId: () => `gesture-${crypto.randomUUID()}`,
      style: { color: '#315f3a', width: 0.014 },
    });
  }

  async function ensureLandmarker() {
    if (landmarkerRef.current) return landmarkerRef.current;
    setStatus('正在加载手势识别模型…');
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return landmarkerRef.current;
  }

  async function startCamera() {
    if (runningRef.current || loading || !videoRef.current) return;
    setLoading(true);
    try {
      await ensureLandmarker();
      cameraRef.current ??= createCameraSession({ mediaDevices: navigator.mediaDevices, videoElement: videoRef.current });
      await cameraRef.current.start();
      runningRef.current = true;
      lastVideoTimeRef.current = -1;
      setRunning(true);
      setStatus('移动食指控制光标，拇指与食指捏合开始绘制');
      predictLoop();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '摄像头或手势模型启动失败，请重试或改用直接绘制。');
    } finally {
      setLoading(false);
    }
  }

  function stopCamera() {
    runningRef.current = false;
    cancelAnimationFrame(animationRef.current);
    cameraRef.current?.stop();
    commitGestureEvent(controllerRef.current.cancel());
    clearOverlay();
    setRunning(false);
    setCursor(null);
    setLive([]);
  }

  function predictLoop() {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      const landmarks = result.landmarks?.[0];
      renderHand(landmarks);
      commitGestureEvent(controllerRef.current.update({ landmarks, mirrored: true, timestamp: performance.now() }));
    }
    animationRef.current = requestAnimationFrame(predictLoop);
  }

  function commitGestureEvent(event: GestureEvent) {
    if (!event) return;
    if (event.cursor) setCursor(toDesignPoint(event.cursor));
    if ((event.type === 'stroke-start' || event.type === 'stroke-update') && event.stroke) {
      setLive(event.stroke.points.map(toDesignPoint));
      setStatus('正在捏合绘制，松开手指完成这一笔');
    } else if (event.type === 'stroke-complete') {
      const captured = event.stroke?.points.map(toDesignPoint) ?? [];
      const completed = isFan ? closeGestureLoop(captured) : captured;
      if (completed.length > 1 && event.reason !== 'cancelled') {
        const next = [...strokesRef.current, completed];
        strokesRef.current = next;
        onChange(next);
        setRedo([]);
      }
      setLive([]);
      setStatus(event.reason === 'tracking_lost' ? '手部追踪中断，已保存有效笔迹' : '一笔已完成；再次捏合可继续绘制');
    } else if (event.type === 'cursor') {
      setStatus('已识别手部，捏合拇指与食指开始绘制');
    } else if (event.type === 'tracking-missing') {
      setStatus('未检测到手部，请把一只手放进画面');
    }
  }

  function toDesignPoint(point: GesturePoint): Point {
    return mapNormalizedPointToDesignSpace(point, 210, height);
  }

  function renderHand(landmarks?: Array<{ x: number; y: number }>) {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(box.width * density));
    const heightPx = Math.max(1, Math.round(box.height * density));
    if (canvas.width !== width || canvas.height !== heightPx) { canvas.width = width; canvas.height = heightPx; }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, heightPx);
    if (!landmarks) return;
    const point = (index: number) => ({ x: (1 - landmarks[index].x) * width, y: landmarks[index].y * heightPx });
    context.strokeStyle = 'rgba(214, 236, 113, .8)';
    context.lineWidth = Math.max(2, width / 260);
    context.lineCap = 'round';
    for (const [from, to] of HAND_CONNECTIONS) {
      const a = point(from); const b = point(to);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    landmarks.forEach((_, index) => {
      const p = point(index);
      context.beginPath(); context.arc(p.x, p.y, index === 4 || index === 8 ? 6 : 3, 0, Math.PI * 2);
      context.fillStyle = index === 4 || index === 8 ? '#dcef71' : '#f6f9e6'; context.fill();
    });
  }

  function clearOverlay() {
    const canvas = overlayRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function beginCameraDrag(event: React.PointerEvent<HTMLSpanElement>) {
    const camera = cameraWindowRef.current;
    if (!camera || window.matchMedia('(max-width: 760px)').matches) return;
    const bounds = camera.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCamera(event: React.PointerEvent<HTMLSpanElement>) {
    const drag = dragRef.current;
    const workspace = workspaceRef.current;
    const camera = cameraWindowRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !workspace || !camera) return;
    const workspaceBounds = workspace.getBoundingClientRect();
    const cameraBounds = camera.getBoundingClientRect();
    setCameraPosition({
      x: clamp(event.clientX - workspaceBounds.left - drag.offsetX, 0, workspaceBounds.width - cameraBounds.width),
      y: clamp(event.clientY - workspaceBounds.top - drag.offsetY, 0, workspaceBounds.height - cameraBounds.height),
    });
  }

  function endCameraDrag(event: React.PointerEvent<HTMLSpanElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const points = (stroke: Stroke, completed = false) =>
    (completed && !isFan ? prepareCustomShapeStroke(stroke).points : stroke).map(point => `${point.x},${point.y}`).join(' ');

  return <div className="drawing gesture-drawing">
    <div className="drawing-tools"><strong>{isFan ? '手势绘制扇面表面图样' : '手势绘制自定义载体轮廓'}</strong><span>摄像头仅在浏览器本地处理，不上传或保存视频</span>
      <button type="button" disabled={!strokes.length} onClick={() => { const removed = strokes.at(-1); if (!removed) return; setRedo(previous => [...previous, removed]); onChange(strokes.slice(0, -1)); }}>撤销</button>
      <button type="button" disabled={!redo.length} onClick={() => { const restored = redo.at(-1); if (!restored) return; onChange([...strokes, restored]); setRedo(redo.slice(0, -1)); }}>重做</button>
      <button type="button" disabled={!strokes.length} onClick={() => { onChange([]); setRedo([]); }}>清空</button>
    </div>
    <div className="gesture-workspace" ref={workspaceRef}>
      <section ref={cameraWindowRef} className={`gesture-camera ${cameraPosition ? 'is-positioned' : ''}`} aria-label="摄像头手势画面"
        style={cameraPosition ? { left: cameraPosition.x, top: cameraPosition.y, right: 'auto' } : undefined}>
        <span className="gesture-pane-label gesture-drag-handle" role="button" aria-label="拖动摄像头悬浮窗" tabIndex={0}
          onPointerDown={beginCameraDrag} onPointerMove={moveCamera} onPointerUp={endCameraDrag} onPointerCancel={endCameraDrag}>摄像头动作 · 拖动</span>
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={overlayRef} />
        {!running && <div className="gesture-camera-empty"><strong>摄像头尚未启动</strong><span>启动后画面只在当前浏览器中处理</span></div>}
        <div className="gesture-status" role="status">{status}</div>
      </section>
      <section className="gesture-result" aria-label="手势绘制结果区域">
        <span className="gesture-pane-label">实时绘图结果</span>
        <svg className={`drawing-pad gesture-pad ${isFan ? 'drawing-pad-fan' : 'drawing-pad-custom'}`} viewBox={`0 0 210 ${height}`} preserveAspectRatio="xMidYMid meet" aria-label="手势绘制结果">
          <rect width="210" height={height} fill="#f4ead9" />
          {isFan && <><FixedFanShape id={fanVariantId} field="boundary" fill="#ead9b9" stroke="#7f6848" strokeWidth={1.2} />
            <FixedFanShape id={fanVariantId} field="effectivePatternBoundary" fill="#fffaf0" stroke="#2f7d68" strokeWidth={0.8} strokeDasharray="3 2" />
            <rect x={fan.handleExclusion.xMin} y={fan.handleExclusion.yMin} width={fan.handleExclusion.xMax-fan.handleExclusion.xMin} height={fan.handleExclusion.yMax-fan.handleExclusion.yMin} fill="#c85c5c" fillOpacity="0.25" stroke="#a43c3c" strokeWidth="0.6" /></>}
          {strokes.map((stroke, index) => <polyline key={index} points={points(stroke, true)} fill={isFan ? 'none' : '#315f3a33'} stroke="#14543b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
          <polyline points={points(live)} fill="none" stroke="#6a8b2c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {cursor && <BrushCursor point={cursor} drawing={live.length > 0} />}
        </svg>
        {!isFan && <div className="gesture-custom-boundary">{!strokes.length&&!live.length&&<div><strong>在整个区域内绘制手势轮廓</strong><span>捏合开始 · 松开完成一笔</span></div>}</div>}
      </section>
    </div>
    <div className="gesture-actions">
      <button type="button" className="primary" disabled={loading || running} onClick={startCamera}>{loading ? '正在准备…' : '启动摄像头'}</button>
      <button type="button" disabled={!running} onClick={stopCamera}>停止摄像头</button>
      <button type="button" onClick={() => { stopCamera(); onUsePointer(); }}>改用直接绘制</button>
    </div>
    <p>移动食指控制光标；拇指与食指捏合开始绘制，松开结束。{isFan ? '轨迹按当前扇面设计坐标保存。' : '轮廓完成后仍使用现有自动闭合与平滑规则。'}</p>
  </div>;
}

function BrushCursor({ point, drawing }: { point: Point; drawing: boolean }) {
  return <g transform={`translate(${point.x} ${point.y}) rotate(45)`} aria-label={drawing ? '正在绘制的画笔落点' : '画笔落点'}>
    <path d="M0 0 C-2-1.8-2.4-4 0-6 C2.4-4 2-1.8 0 0Z" fill={drawing ? '#b8d94b' : '#315f3a'} stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" />
    <rect x="-2.3" y="-8.2" width="4.6" height="3.6" rx=".7" fill="#d9b676" stroke="#fff" strokeWidth="1" />
    <rect x="-1.8" y="-17" width="3.6" height="9.8" rx="1.8" fill="#14543b" stroke="#fff" strokeWidth="1" />
    <circle cx="0" cy="0" r=".65" fill="#fff" />
  </g>;
}

function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
