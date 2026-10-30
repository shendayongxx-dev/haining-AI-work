import { useId } from 'react';
import type { CarrierShape, Point } from '../../model';

type Props = { shape: CarrierShape; density: number; stripWidthMm: number; color: string; scale: number };

function path(points: Point[]) {
  return points.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`).join(' ') + ' Z';
}

export default function CustomStructurePreview({ shape, density, stripWidthMm, color, scale }: Props) {
  const id = useId();
  const components = shape.components;
  const allPoints = components.flatMap(component => component.outerBoundary.pointsMm);
  if (!allPoints.length) return null;
  const minX = Math.min(...allPoints.map(p => p.x));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxY = Math.max(...allPoints.map(p => p.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const count = Math.max(2, Math.round(density));
  const xs = Array.from({ length: count }, (_, i) => minX + (maxX - minX) * i / (count - 1));
  const ys = Array.from({ length: count }, (_, i) => minY + (maxY - minY) * i / (count - 1));
  const outline = components.map(component => [path(component.outerBoundary.pointsMm), ...component.holes.map(hole => path(hole.pointsMm))].join(' ')).join(' ');
  const transform = `translate(${centerX} ${centerY}) scale(${scale / 100}) translate(${-centerX} ${-centerY})`;
  return <svg viewBox="0 0 210 297" role="img" aria-label="自定义形状竹条交织结构示意，工艺待验证">
    <defs><clipPath id={id}><path d={outline} fillRule="evenodd" clipRule="evenodd" /></clipPath></defs>
    <g transform={transform}>
      <path d={outline} fill="#ead8b5" fillRule="evenodd" />
      <g clipPath={`url(#${id})`}>
        {xs.map((x, i) => <line key={`v${i}`} x1={x} x2={x} y1={minY} y2={maxY} stroke="#c4a879" strokeWidth={stripWidthMm} />)}
        {ys.map((y, i) => <line key={`h${i}`} x1={minX} x2={maxX} y1={y} y2={y} stroke={color} strokeWidth={stripWidthMm} />)}
        {xs.flatMap((x, i) => ys.map((y, j) => (i + j) % 2 === 0
          ? <line key={`x${i}-${j}`} x1={x} x2={x} y1={y - stripWidthMm * .65} y2={y + stripWidthMm * .65} stroke="#c4a879" strokeWidth={stripWidthMm} />
          : null))}
      </g>
      <path d={outline} fill="none" stroke="#ba8750" strokeWidth="1.5" fillRule="evenodd" />
    </g>
  </svg>;
}
