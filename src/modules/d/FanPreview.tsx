import { useId } from 'react';
import type { Candidate, CarrierShape, SurfacePattern } from '../../model';
import FixedFanShape from '../../FixedFanShape';
import { fixedFanRef, resolveFixedFan } from '../../data/fixedFanRegistry';
import type { FixedFanCarrierId } from '../../data/fixedFanRegistry';

export type PreviewProps = { candidate?: Candidate | null; carrierId?: FixedFanCarrierId; grid?: boolean; density?: number; stripWidth?: number; color?: string; weave?: string; scale?: number };

// Candidate-stage fixture; StructurePreview remains the authoritative edit-stage snapshot.
export default function FanPreview({ candidate, carrierId, grid = false, stripWidth = 3, color, scale = 100 }: PreviewProps) {
  const clipId = useId();
  const custom = candidate?.resultType === 'carrier_shape';
  const pattern = candidate?.resultType === 'surface_pattern' ? candidate.result as SurfacePattern : null;
  const shape = custom ? candidate.result as CarrierShape : null;
  const fanId = carrierId ?? candidate?.carrierRef?.carrierId ?? 'FAN-ROUND-170-V1';
  const fan = resolveFixedFan(fixedFanRef(fanId));
  const xLines = Array.from({ length: 22 }, (_, i) => 20 + i * 8);
  const yLines = Array.from({ length: 22 }, (_, i) => 25 + i * 8);
  const scaled = `translate(105 110) scale(${scale / 100}) translate(-105 -110)`;
  return <svg className="fan" viewBox={custom ? '0 0 210 297' : '0 0 210 220'} role="img" aria-label={custom ? '自定义载体形状候选' : `${fan.name}表面图样候选`}>
    {!custom && <>
      <defs><clipPath id={clipId}><FixedFanShape id={fanId} field="boundary" /></clipPath></defs>
      <FixedFanShape id={fanId} field="boundary" fill="#ead8b5" />
      <g clipPath={`url(#${clipId})`} opacity={grid ? .8 : .45}>
        {xLines.map((x, i) => <line key={`v${i}`} x1={x} x2={x} y1="20" y2="200" stroke="#aa8359" strokeWidth={stripWidth * .45} />)}
        {yLines.map((y, i) => <line key={`h${i}`} x1="15" x2="195" y1={y} y2={y} stroke="#fff6de" strokeWidth={stripWidth * .45} />)}
      </g>
      {pattern && <g transform={scaled} clipPath={`url(#${clipId})`}>{pattern.elements.map(element => element.kind === 'polygon'
        ? <polygon key={element.elementId} points={element.pointsMm.map(p => `${p.x},${p.y}`).join(' ')} fill={color ?? pattern.palette.find(p => p.paletteId === element.paletteId)?.color ?? '#315F3A'} stroke={pattern.elements.length>1?'none':'#14543b'} strokeWidth="1.5" />
        : <polyline key={element.elementId} points={element.pointsMm.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color ?? '#315F3A'} strokeWidth="2" />)}</g>}
      <FixedFanShape id={fanId} field="boundary" fill="none" stroke="#ba8750" strokeWidth={2} />
      <rect x={fan.handleExclusion.xMin} y={fan.handleExclusion.yMin} width={fan.handleExclusion.xMax-fan.handleExclusion.xMin} height={fan.handleExclusion.yMax-fan.handleExclusion.yMin} fill="#ba8750" fillOpacity=".25" />
    </>}
    {shape && shape.components.map(component => <polygon key={component.componentId} points={component.outerBoundary.pointsMm.map(p => `${p.x},${p.y}`).join(' ')} fill="#ead8b5" stroke="#ba8750" strokeWidth="2" />)}
  </svg>;
}
