import { useId } from 'react';
import type { Candidate, CarrierShape, SurfacePattern } from '../../model';
import { FORMAL_FAN_CARRIER_V1 as fan } from '../../data/formalFanCarrier';

export type PreviewProps = { candidate?: Candidate | null; grid?: boolean; density?: number; stripWidth?: number; color?: string; weave?: string; scale?: number };

// Candidate-stage fixture; StructurePreview remains the authoritative edit-stage snapshot.
export default function FanPreview({ candidate, grid = false, stripWidth = 3, color, scale = 100 }: PreviewProps) {
  const clipId = useId();
  const custom = candidate?.resultType === 'carrier_shape';
  const pattern = candidate?.resultType === 'surface_pattern' ? candidate.result as SurfacePattern : null;
  const shape = custom ? candidate.result as CarrierShape : null;
  const circle = fan.boundary;
  const xLines = Array.from({ length: 22 }, (_, i) => 20 + i * 8);
  const yLines = Array.from({ length: 22 }, (_, i) => 25 + i * 8);
  const scaled = `translate(105 110) scale(${scale / 100}) translate(-105 -110)`;
  return <svg className="fan" viewBox={custom ? '0 0 210 297' : '0 0 210 220'} role="img" aria-label={custom ? '自定义载体形状候选' : '圆形扇面表面图样候选'}>
    {!custom && <>
      <defs><clipPath id={clipId}><circle cx={circle.centerMm.x} cy={circle.centerMm.y} r={circle.radiusMm} /></clipPath></defs>
      <circle cx={circle.centerMm.x} cy={circle.centerMm.y} r={circle.radiusMm} fill="#ead8b5" />
      <g clipPath={`url(#${clipId})`} opacity={grid ? .8 : .45}>
        {xLines.map((x, i) => <line key={`v${i}`} x1={x} x2={x} y1="20" y2="200" stroke="#aa8359" strokeWidth={stripWidth * .45} />)}
        {yLines.map((y, i) => <line key={`h${i}`} x1="15" x2="195" y1={y} y2={y} stroke="#fff6de" strokeWidth={stripWidth * .45} />)}
      </g>
      {pattern && <g transform={scaled} clipPath={`url(#${clipId})`}>{pattern.elements.map(element => element.kind === 'polygon'
        ? <polygon key={element.elementId} points={element.pointsMm.map(p => `${p.x},${p.y}`).join(' ')} fill={color ?? pattern.palette.find(p => p.paletteId === element.paletteId)?.color ?? '#315F3A'} stroke="#14543b" strokeWidth="1.5" />
        : <polyline key={element.elementId} points={element.pointsMm.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color ?? '#315F3A'} strokeWidth="2" />)}</g>}
      <circle cx={circle.centerMm.x} cy={circle.centerMm.y} r={circle.radiusMm} fill="none" stroke="#ba8750" strokeWidth="2" />
      <rect x={fan.handleReserve.x} y={fan.handleReserve.y} width={fan.handleReserve.width} height={fan.handleReserve.height} fill="#ba8750" fillOpacity=".25" />
    </>}
    {shape && shape.components.map(component => <polygon key={component.componentId} points={component.outerBoundary.pointsMm.map(p => `${p.x},${p.y}`).join(' ')} fill="#ead8b5" stroke="#ba8750" strokeWidth="2" />)}
  </svg>;
}
