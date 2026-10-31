import { useId } from 'react';
import type { CustomStructureSnapshot } from './customTypes';

export default function CustomStructurePreview({ snapshot }: { snapshot: CustomStructureSnapshot }) {
  const clipId = useId();
  const path = snapshot.boundary.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ') + ' Z';
  const stripsById = new Map(snapshot.strips.list.map(strip => [strip.id, strip]));
  return <svg viewBox="0 0 210 297" role="img" aria-label="由 D 结构快照驱动的自定义形状竹条交织预览">
    <defs><clipPath id={clipId}><path d={path}/></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      {snapshot.strips.list.map(strip => <line key={strip.id} x1={strip.startMm.x} y1={strip.startMm.y} x2={strip.endMm.x} y2={strip.endMm.y} stroke={strip.color} strokeWidth={strip.widthMm} />)}
      {snapshot.interlace.crossings.map(crossing => {
      const top = stripsById.get(crossing.top === 'warp' ? crossing.warpStripId : crossing.weftStripId);
      if (!top) return null;
      const half = top.widthMm * .7;
      return top.direction === 'warp'
        ? <line key={crossing.id} x1={crossing.positionMm.x} x2={crossing.positionMm.x} y1={crossing.positionMm.y-half} y2={crossing.positionMm.y+half} stroke={top.color} strokeWidth={top.widthMm} />
        : <line key={crossing.id} x1={crossing.positionMm.x-half} x2={crossing.positionMm.x+half} y1={crossing.positionMm.y} y2={crossing.positionMm.y} stroke={top.color} strokeWidth={top.widthMm} />;
      })}
    </g>
    <path d={path} fill="none" stroke="#ba8750" strokeWidth="1.5" />
  </svg>;
}
