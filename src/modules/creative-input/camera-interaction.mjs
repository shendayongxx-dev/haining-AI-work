export function createCameraSession({ mediaDevices, videoElement, constraints } = {}) {
  if (typeof mediaDevices?.getUserMedia !== "function") throw new TypeError("mediaDevices.getUserMedia is required");
  let stream = null;

  return {
    async start() {
      if (stream) return stream;
      try {
        stream = await mediaDevices.getUserMedia(constraints ?? {
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoElement) {
          videoElement.srcObject = stream;
          if (typeof videoElement.play === "function") await videoElement.play();
        }
        return stream;
      } catch (cause) {
        throw normalizeCameraError(cause);
      }
    },

    stop() {
      if (!stream) return;
      for (const track of stream.getTracks?.() ?? []) track.stop();
      if (videoElement?.srcObject === stream) videoElement.srcObject = null;
      stream = null;
    },

    getStream() {
      return stream;
    },
  };
}

export function createPinchDrawingController(options = {}) {
  const startThreshold = options.startThreshold ?? 0.32;
  const stopThreshold = options.stopThreshold ?? 0.42;
  const smoothingFactor = options.smoothingFactor ?? 0.7;
  const maximumLostFrames = options.maximumLostFrames ?? 3;
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());
  const style = options.style ?? { color: "#315f3a", width: 0.02 };
  let activeStroke = null;
  let lastPoint = null;
  let lostFrames = 0;

  return {
    update(result) {
      const landmarks = result?.landmarks;
      if (!Array.isArray(landmarks) || landmarks.length < 10) {
        lostFrames += 1;
        if (activeStroke && lostFrames > maximumLostFrames) return finish("tracking_lost");
        return { type: "tracking-missing", lostFrames };
      }

      lostFrames = 0;
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const wrist = landmarks[0];
      const middleMcp = landmarks[9];
      const palmSize = distance(wrist, middleMcp);
      if (!(palmSize > 0)) return { type: "tracking-invalid", reason: "zero_palm_size" };
      const pinchRatio = distance(indexTip, thumbTip) / palmSize;
      const rawPoint = {
        x: clamp(result.mirrored === false ? indexTip.x : 1 - indexTip.x, 0, 1),
        y: clamp(indexTip.y, 0, 1),
        timestamp: result.timestamp,
      };
      const point = lastPoint
        ? {
            x: lastPoint.x * smoothingFactor + rawPoint.x * (1 - smoothingFactor),
            y: lastPoint.y * smoothingFactor + rawPoint.y * (1 - smoothingFactor),
            timestamp: rawPoint.timestamp,
          }
        : rawPoint;
      lastPoint = point;

      if (!activeStroke && pinchRatio < startThreshold) {
        activeStroke = {
          id: createId(),
          captureMethod: "cameraGesture",
          pointerType: "camera",
          color: style.color,
          width: style.width,
          closed: false,
          points: [point],
        };
        return { type: "stroke-start", pinchRatio, stroke: cloneStroke(activeStroke), cursor: point };
      }

      if (activeStroke && pinchRatio > stopThreshold) return finish("pinch_released", pinchRatio, point);

      if (activeStroke) {
        activeStroke.points.push(point);
        return { type: "stroke-update", pinchRatio, stroke: cloneStroke(activeStroke), cursor: point };
      }

      return { type: "cursor", pinchRatio, cursor: point };
    },

    cancel() {
      if (!activeStroke) return null;
      return finish("cancelled");
    },

    getActiveStroke() {
      return activeStroke ? cloneStroke(activeStroke) : null;
    },
  };

  function finish(reason, pinchRatio, cursor) {
    const stroke = activeStroke ? cloneStroke(activeStroke) : null;
    activeStroke = null;
    lastPoint = cursor ?? lastPoint;
    return { type: "stroke-complete", reason, ...(pinchRatio === undefined ? {} : { pinchRatio }), stroke, ...(cursor ? { cursor } : {}) };
  }
}

export function normalizeCameraError(cause) {
  const name = cause?.name;
  const code = name === "NotAllowedError"
    ? "CAMERA_PERMISSION_DENIED"
    : name === "NotFoundError"
      ? "CAMERA_NOT_FOUND"
      : name === "NotReadableError"
        ? "CAMERA_BUSY"
        : "CAMERA_START_FAILED";
  const message = {
    CAMERA_PERMISSION_DENIED: "摄像头权限被拒绝，请允许权限或改用直接绘制。",
    CAMERA_NOT_FOUND: "未找到可用摄像头，请改用直接绘制。",
    CAMERA_BUSY: "摄像头正被其他应用占用，请关闭占用后重试。",
    CAMERA_START_FAILED: "摄像头启动失败，请重试或改用直接绘制。",
  }[code];
  const error = new Error(message, { cause });
  error.code = code;
  return error;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneStroke(stroke) {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
}
