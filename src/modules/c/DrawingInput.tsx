import { useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { DrawingStroke, Point } from "./types";

interface Props {
  color?: string;
  disabled?: boolean;
  onChange: (strokes: DrawingStroke[]) => void;
}

const CLOSE_DISTANCE = 0.035;

export function DrawingInput({ color = "#315F3A", disabled = false, onChange }: Props) {
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [active, setActive] = useState<DrawingStroke | null>(null);

  const paths = useMemo(() => (active ? [...strokes, active] : strokes), [active, strokes]);

  function pointFromEvent(event: PointerEvent<SVGSVGElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    };
  }

  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (disabled || event.isPrimary === false) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive({
      id: globalThis.crypto.randomUUID(),
      color,
      width: 0.012,
      closed: false,
      points: [pointFromEvent(event)],
    });
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = pointFromEvent(event);
    const previous = active.points.at(-1)!;
    if (Math.hypot(next.x - previous.x, next.y - previous.y) < 0.002) return;
    setActive({ ...active, points: [...active.points, next] });
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    if (!active) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const first = active.points[0];
    const last = active.points.at(-1)!;
    const shouldClose = active.points.length >= 3 && Math.hypot(first.x - last.x, first.y - last.y) <= CLOSE_DISTANCE;
    const completed = {
      ...active,
      closed: shouldClose,
      points: shouldClose ? [...active.points.slice(0, -1), first] : active.points,
    };
    const next = [...strokes, completed];
    setStrokes(next);
    setActive(null);
    onChange(next);
  }

  function undo() {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    onChange(next);
  }

  function clear() {
    setStrokes([]);
    setActive(null);
    onChange([]);
  }

  return (
    <section aria-label="用户绘制输入">
      <svg
        viewBox="0 0 1000 600"
        role="img"
        aria-label="绘制区域，支持鼠标、触屏和触控笔"
        style={{ width: "100%", minHeight: 280, border: "1px solid #b9b2a4", touchAction: "none" }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={finish}
        onPointerCancel={() => setActive(null)}
      >
        <rect width="1000" height="600" fill="#fbf8f0" />
        {paths.map((stroke) => (
          <polyline
            key={stroke.id}
            points={stroke.points.map((point) => `${point.x * 1000},${point.y * 600}`).join(" ")}
            fill={stroke.closed ? stroke.color : "none"}
            stroke={stroke.color}
            strokeWidth="8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div>
        <button type="button" disabled={disabled || strokes.length === 0} onClick={undo}>撤销上一笔</button>
        <button type="button" disabled={disabled || (strokes.length === 0 && !active)} onClick={clear}>清空</button>
      </div>
      <p>首版建议绘制单个闭合图形；接近起点松开会自动闭合。</p>
    </section>
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
