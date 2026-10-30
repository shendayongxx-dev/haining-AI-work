import type { HighlightTarget, StructureSnapshot } from './types';

export type StructurePreviewProps = {
  snapshot: StructureSnapshot;
  highlight?: HighlightTarget;
};

function isStripHighlighted(highlight: HighlightTarget | undefined, id: string) {
  return highlight?.kind === 'strip' && highlight.id === id;
}

export default function StructurePreview({ snapshot, highlight = null }: StructurePreviewProps) {
  const { mmToSvg } = snapshot.viewTransform;
  const width = snapshot.carrier.widthMm * mmToSvg;
  const height = snapshot.carrier.heightMm * mmToSvg;
  const crossings = new Map(snapshot.interlace.crossings.map(value => [value.id, value]));
  const strips = new Map(snapshot.strips.list.map(value => [value.id, value]));
  const crossing = highlight?.kind === 'crossing' ? crossings.get(highlight.id) : undefined;
  const marker = highlight?.kind === 'position' ? highlight.positionMm : crossing?.positionMm;
  const circle = snapshot.activeArea;
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="圆扇竹条结构示意预览，交叉点按平编上下关系显示">
    <defs>
      <clipPath id={`fan-${snapshot.designRevision}`}>
        <circle cx={circle.centerMm.x * mmToSvg} cy={circle.centerMm.y * mmToSvg} r={circle.radiusMm * mmToSvg} />
      </clipPath>
    </defs>
    <circle cx={circle.centerMm.x * mmToSvg} cy={circle.centerMm.y * mmToSvg} r={circle.radiusMm * mmToSvg} fill="#ead8b5" />
    <g clipPath={`url(#fan-${snapshot.designRevision})`}>
      {snapshot.strips.list.map(strip => {
        const highlighted = isStripHighlighted(highlight, strip.id);
        return strip.colorSegments.map((segment, index) => strip.direction === 'warp'
          ? <line key={`${strip.id}-${index}`} data-strip-id={strip.id} x1={strip.axisMm * mmToSvg}
              x2={strip.axisMm * mmToSvg} y1={(strip.startMm.y + segment.fromMm) * mmToSvg}
              y2={(strip.startMm.y + segment.toMm) * mmToSvg}
              stroke={highlighted ? '#ff3b30' : segment.color} strokeWidth={(highlighted ? strip.widthMm + 2 : strip.widthMm) * mmToSvg} />
          : <line key={`${strip.id}-${index}`} data-strip-id={strip.id} y1={strip.axisMm * mmToSvg}
              y2={strip.axisMm * mmToSvg} x1={(strip.startMm.x + segment.fromMm) * mmToSvg}
              x2={(strip.startMm.x + segment.toMm) * mmToSvg}
              stroke={highlighted ? '#ff3b30' : segment.color} strokeWidth={(highlighted ? strip.widthMm + 2 : strip.widthMm) * mmToSvg} />);
      })}
      {snapshot.interlace.crossings.map(crossing => {
        const top = strips.get(crossing.top === 'warp' ? crossing.warpId : crossing.weftId);
        const lower = strips.get(crossing.top === 'warp' ? crossing.weftId : crossing.warpId);
        if (!top || !lower) return null;
        const alongMm = top.direction === 'warp'
          ? crossing.positionMm.y - top.startMm.y
          : crossing.positionMm.x - top.startMm.x;
        const halfMm = lower.widthMm / 2 + 0.2;
        const highlighted = isStripHighlighted(highlight, top.id);
        return <g key={crossing.id} data-crossing-id={crossing.id}>
          {top.colorSegments.map((segment, index) => {
            const fromMm = Math.max(segment.fromMm, alongMm - halfMm);
            const toMm = Math.min(segment.toMm, alongMm + halfMm);
            if (toMm <= fromMm) return null;
            const color = highlighted ? '#ff3b30' : segment.color;
            const strokeWidth = (highlighted ? top.widthMm + 2 : top.widthMm) * mmToSvg;
            return top.direction === 'warp'
              ? <line key={index} x1={top.axisMm * mmToSvg} x2={top.axisMm * mmToSvg}
                  y1={(top.startMm.y + fromMm) * mmToSvg} y2={(top.startMm.y + toMm) * mmToSvg}
                  stroke={color} strokeWidth={strokeWidth} />
              : <line key={index} y1={top.axisMm * mmToSvg} y2={top.axisMm * mmToSvg}
                  x1={(top.startMm.x + fromMm) * mmToSvg} x2={(top.startMm.x + toMm) * mmToSvg}
                  stroke={color} strokeWidth={strokeWidth} />;
          })}
        </g>;
      })}
    </g>
    <circle cx={circle.centerMm.x * mmToSvg} cy={circle.centerMm.y * mmToSvg} r={circle.radiusMm * mmToSvg}
      fill="none" stroke="#ba8750" strokeWidth="4" />
    {marker && <circle cx={marker.x * mmToSvg} cy={marker.y * mmToSvg} r="8" fill="none" stroke="#ff3b30" strokeWidth="4" />}
    <text x="10" y={height - 10} fontSize="12" fill="#7a5b34">{snapshot.status.label} · revision {snapshot.generatedFromRevision}</text>
  </svg>;
}
