import { useId } from 'react';
import type { CustomStructureSnapshot } from './customTypes';

export default function CustomStructurePreview({ snapshot }: { snapshot: CustomStructureSnapshot }) {
  const clipId = useId();
  const shadowId = useId();
  const path = snapshot.boundary.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ') + ' Z';
  const stripsById = new Map(snapshot.strips.list.map(strip => [strip.id, strip]));
  return <svg viewBox="0 0 210 297" role="img" aria-label="由 D 结构快照驱动的自定义形状竹条交织预览">
    <defs>
      <clipPath id={clipId}><path d={path}/></clipPath>
      <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx=".6" dy=".75" stdDeviation=".55" floodColor="#25170d" floodOpacity=".5" />
      </filter>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <path d={path} fill="#cfb98f" fillOpacity=".42" />
      {snapshot.strips.list.map(strip => <g key={strip.id} data-strip-id={strip.id}>
        <line x1={strip.startMm.x} y1={strip.startMm.y} x2={strip.endMm.x} y2={strip.endMm.y} stroke="#3c291b" strokeOpacity=".36" strokeWidth={strip.widthMm+.6} />
        <line x1={strip.startMm.x} y1={strip.startMm.y} x2={strip.endMm.x} y2={strip.endMm.y} stroke={strip.color} strokeWidth={strip.widthMm} />
      </g>)}
      {snapshot.interlace.crossings.map(crossing => {
        const top = stripsById.get(crossing.top === 'warp' ? crossing.warpStripId : crossing.weftStripId);
        const lower = stripsById.get(crossing.top === 'warp' ? crossing.weftStripId : crossing.warpStripId);
        if (!top || !lower) return null;
        const half = lower.widthMm/2+.35;
        const coordinates = top.direction === 'warp'
          ? { x1: crossing.positionMm.x, x2: crossing.positionMm.x, y1: crossing.positionMm.y-half, y2: crossing.positionMm.y+half }
          : { x1: crossing.positionMm.x-half, x2: crossing.positionMm.x+half, y1: crossing.positionMm.y, y2: crossing.positionMm.y };
        const highlightCoordinates = top.direction === 'warp'
          ? { ...coordinates, x1: coordinates.x1-.3, x2: coordinates.x2-.3 }
          : { ...coordinates, y1: coordinates.y1-.3, y2: coordinates.y2-.3 };
        return <g key={crossing.id} data-crossing-id={crossing.id} className="weave-crossing">
          <title>{`${crossing.id} · ${top.id} 在上（压） · ${lower.id} 在下（挑）`}</title>
          <line {...coordinates} stroke="#cfb98f" strokeWidth={top.widthMm+1.6} />
          <line {...coordinates} stroke="#2f2117" strokeOpacity=".55" strokeWidth={top.widthMm+.75} filter={`url(#${shadowId})`} />
          <line {...coordinates} className="weave-top" stroke={top.color} strokeWidth={top.widthMm} />
          <line {...highlightCoordinates} stroke="#fff8e8" strokeOpacity=".28" strokeWidth=".25" />
        </g>;
      })}
    </g>
    <path d={path} fill="none" stroke="#ba8750" strokeWidth="1.5" />
  </svg>;
}
