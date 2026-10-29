/**
 * Converts browser PointerEvent-like objects into framework-neutral strokes.
 * The UI remains responsible for setPointerCapture/releasePointerCapture.
 */
export function createPointerDrawingController(options = {}) {
  const state = {
    activePointerId: null,
    activeStroke: null,
  };
  const minimumDistance = options.minimumDistance ?? 0.001;
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());

  return {
    pointerDown(event, bounds, style) {
      if (state.activePointerId !== null || event.isPrimary === false) return null;

      const point = eventToNormalizedPoint(event, bounds);
      state.activePointerId = event.pointerId;
      state.activeStroke = {
        id: createId(),
        captureMethod: "pointer",
        pointerType: event.pointerType ?? "mouse",
        color: style.color,
        width: style.width,
        closed: false,
        points: [point],
      };
      return cloneStroke(state.activeStroke);
    },

    pointerMove(event, bounds) {
      if (event.pointerId !== state.activePointerId || !state.activeStroke) return null;
      const point = eventToNormalizedPoint(event, bounds);
      const previous = state.activeStroke.points.at(-1);
      if (distance(previous, point) < minimumDistance) return null;
      state.activeStroke.points.push(point);
      return cloneStroke(state.activeStroke);
    },

    pointerUp(event, bounds) {
      if (event.pointerId !== state.activePointerId || !state.activeStroke) return null;
      const point = eventToNormalizedPoint(event, bounds);
      const previous = state.activeStroke.points.at(-1);
      if (distance(previous, point) >= minimumDistance) state.activeStroke.points.push(point);
      const completed = cloneStroke(state.activeStroke);
      reset(state);
      return completed;
    },

    pointerCancel(event) {
      if (event.pointerId !== state.activePointerId || !state.activeStroke) return null;
      const cancelled = cloneStroke(state.activeStroke);
      reset(state);
      return cancelled;
    },

    getActiveStroke() {
      return state.activeStroke ? cloneStroke(state.activeStroke) : null;
    },

    reset() {
      reset(state);
    },
  };
}

export function eventToNormalizedPoint(event, bounds) {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    throw new TypeError("Pointer bounds must have positive width and height");
  }
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
    y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    pressure: normalizePressure(event.pressure, event.pointerType),
    timestamp: Number.isFinite(event.timeStamp) ? event.timeStamp : undefined,
  };
}

function normalizePressure(pressure, pointerType) {
  if (pointerType !== "pen") return undefined;
  if (!Number.isFinite(pressure)) return undefined;
  return clamp(pressure, 0, 1);
}

function cloneStroke(stroke) {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function reset(state) {
  state.activePointerId = null;
  state.activeStroke = null;
}
