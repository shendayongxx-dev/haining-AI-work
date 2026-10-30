import { useRef, useState } from 'react';
import type { Carrier, Point } from './model';
import { FORMAL_FAN_CARRIER_V1 as fan } from './data/formalFanCarrier';

type Stroke = Point[];

export default function DrawingCanvas({ carrier, strokes, onChange }: { carrier: Carrier; strokes: Stroke[]; onChange: (s: Stroke[]) => void }) {
  const active = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const isFan = carrier === 'fan';
  const points = (stroke: Stroke) => stroke.map(p => `${p.x},${p.y}`).join(' ');
  const xy = (e: React.PointerEvent<SVGSVGElement>): Point => {
    const matrix = e.currentTarget.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 };
  };
  return <div className="drawing">
    <div className="drawing-tools"><strong>{isFan ? '绘制扇面表面图样' : '绘制自定义载体轮廓'}</strong><span>鼠标 / 触屏 / 触控笔</span>
      <button onClick={() => { if (strokes.length) { setRedo([...redo, strokes.at(-1)!]); onChange(strokes.slice(0, -1)); } }}>撤销</button>
      <button onClick={() => { if (redo.length) { onChange([...strokes, redo.at(-1)!]); setRedo(redo.slice(0, -1)); } }}>重做</button>
      <button onClick={() => { onChange([]); setRedo([]); }}>清空</button>
    </div>
    <svg className={`drawing-pad ${isFan ? 'drawing-pad-fan' : 'drawing-pad-custom'}`} viewBox={isFan ? '0 0 210 220' : '0 0 210 297'}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); active.current = [xy(e)]; setLive(active.current); }}
      onPointerMove={e => { if (active.current) { active.current = [...active.current, xy(e)]; setLive(active.current); } }}
      onPointerUp={() => { if (active.current && active.current.length > 1) onChange([...strokes, active.current]); active.current = null; setLive([]); }}
      onPointerCancel={() => { active.current = null; setLive([]); }}>
      <rect width="210" height={isFan ? '220' : '297'} fill="#f4ead9" />
      {isFan && <><circle cx={fan.boundary.centerMm.x} cy={fan.boundary.centerMm.y} r={fan.boundary.radiusMm} fill="#ead9b9" stroke="#7f6848" strokeWidth="1.2" />
        <circle cx={fan.effectivePatternBoundary.centerMm.x} cy={fan.effectivePatternBoundary.centerMm.y} r={fan.effectivePatternBoundary.radiusMm} fill="#fffaf0" stroke="#2f7d68" strokeWidth="0.8" strokeDasharray="3 2" />
        <rect x={fan.handleReserve.x} y={fan.handleReserve.y} width={fan.handleReserve.width} height={fan.handleReserve.height} fill="#c85c5c" fillOpacity="0.25" stroke="#a43c3c" strokeWidth="0.6" /></>}
      {strokes.map((stroke, i) => <polyline key={i} points={points(stroke)} fill="none" stroke="#14543b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
      <polyline points={points(live)} fill="none" stroke="#14543b" strokeWidth="2" />
    </svg>
    <p>{isFan ? '实线为170 mm圆扇，绿色虚线为150 mm有效图样区；红色区域为扇柄连接保留区。' : '在普通画布中绘制闭合的载体外轮廓；这里不预设扇面边框。'} 坐标以毫米保存。</p>
  </div>;
}
