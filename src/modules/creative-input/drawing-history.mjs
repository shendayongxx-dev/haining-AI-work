export function createDrawingHistory(initialStrokes = []) {
  let strokes = cloneStrokes(initialStrokes);
  let past = [];
  let future = [];

  return {
    add(stroke) {
      past = [...past, cloneStrokes(strokes)];
      strokes = [...strokes, cloneStroke(stroke)];
      future = [];
      return this.snapshot();
    },
    replace(nextStrokes) {
      past = [...past, cloneStrokes(strokes)];
      strokes = cloneStrokes(nextStrokes);
      future = [];
      return this.snapshot();
    },
    undo() {
      if (past.length === 0) return this.snapshot();
      future = [cloneStrokes(strokes), ...future];
      strokes = past.at(-1);
      past = past.slice(0, -1);
      return this.snapshot();
    },
    redo() {
      if (future.length === 0) return this.snapshot();
      past = [...past, cloneStrokes(strokes)];
      strokes = future[0];
      future = future.slice(1);
      return this.snapshot();
    },
    clear() {
      if (strokes.length === 0) return this.snapshot();
      past = [...past, cloneStrokes(strokes)];
      strokes = [];
      future = [];
      return this.snapshot();
    },
    snapshot() {
      return {
        strokes: cloneStrokes(strokes),
        canUndo: past.length > 0,
        canRedo: future.length > 0,
      };
    },
  };
}

function cloneStrokes(strokes) {
  return strokes.map(cloneStroke);
}

function cloneStroke(stroke) {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })) };
}
