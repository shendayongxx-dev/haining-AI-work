import { useRef, useState } from 'react';
import type { Carrier, Point } from './model';
import type { FixedFanCarrierId } from './data/fixedFanRegistry';
import { fixedFanRef, resolveFixedFan } from './data/fixedFanRegistry';
import FixedFanShape from './FixedFanShape';
import { prepareCustomShapeStroke } from './modules/c/shapeProcessing';

type Stroke = Point[];

export default function DrawingCanvas({ carrier, fanVariantId, strokes, onChange }: { carrier: Carrier; fanVariantId: FixedFanCarrierId; strokes: Stroke[]; onChange: (s: Stroke[]) => void }) {
  const active = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const isFan = carrier === 'fan';
  const fan = resolveFixedFan(fixedFanRef(fanVariantId));
  const points = (stroke: Stroke, completed = false) =>
    (completed && !isFan ? prepareCustomShapeStroke(stroke).points : stroke)
      .map(p => `${p.x},${p.y}`).join(' ');
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
      {isFan && <><FixedFanShape id={fanVariantId} field="boundary" fill="#ead9b9" stroke="#7f6848" strokeWidth={1.2} />
        <FixedFanShape id={fanVariantId} field="effectivePatternBoundary" fill="#fffaf0" stroke="#2f7d68" strokeWidth={0.8} strokeDasharray="3 2" />
        <rect x={fan.handleExclusion.xMin} y={fan.handleExclusion.yMin} width={fan.handleExclusion.xMax-fan.handleExclusion.xMin} height={fan.handleExclusion.yMax-fan.handleExclusion.yMin} fill="#c85c5c" fillOpacity="0.25" stroke="#a43c3c" strokeWidth="0.6" /></>}
      {strokes.map((stroke, i) => <polyline key={i} points={points(stroke, true)} fill={isFan ? 'none' : '#315f3a33'} stroke="#14543b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
      <polyline points={points(live)} fill="none" stroke="#14543b" strokeWidth="2" />
    </svg>
    <p>{isFan ? `${fan.name}：实线为外轮廓，绿色虚线为有效图样区；红色区域为扇柄连接保留区。` : '在普通画布中绘制载体轮廓；完成后自动连接首尾并平滑线条，无需精准回到起点。'} 坐标以毫米保存。</p>
  </div>;
}
