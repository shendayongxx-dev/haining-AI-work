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
      <filter id={`weave-shadow-${snapshot.designRevision}`} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="1.2" dy="1.5" stdDeviation="1.1" floodColor="#25170d" floodOpacity=".5" />
      </filter>
    </defs>
    <circle cx={circle.centerMm.x * mmToSvg} cy={circle.centerMm.y * mmToSvg} r={circle.radiusMm * mmToSvg} fill="#cfb98f" />
    <g clipPath={`url(#fan-${snapshot.designRevision})`}>
      {snapshot.strips.list.map(strip => {
        const highlighted = isStripHighlighted(highlight, strip.id);
        return strip.colorSegments.map((segment, index) => {
          const color = highlighted ? '#ff3b30' : segment.color;
          const stripWidth = (highlighted ? strip.widthMm + 2 : strip.widthMm) * mmToSvg;
          const coordinates = strip.direction === 'warp'
            ? { x1: strip.axisMm * mmToSvg, x2: strip.axisMm * mmToSvg, y1: (strip.startMm.y + segment.fromMm) * mmToSvg, y2: (strip.startMm.y + segment.toMm) * mmToSvg }
            : { y1: strip.axisMm * mmToSvg, y2: strip.axisMm * mmToSvg, x1: (strip.startMm.x + segment.fromMm) * mmToSvg, x2: (strip.startMm.x + segment.toMm) * mmToSvg };
          return <g key={`${strip.id}-${index}`} data-strip-id={strip.id}>
            <line {...coordinates} stroke="#3c291b" strokeOpacity=".36" strokeWidth={stripWidth + 1.2} />
            <line {...coordinates} stroke={color} strokeWidth={stripWidth} />
          </g>;
        });
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
        return <g key={crossing.id} data-crossing-id={crossing.id} className="weave-crossing">
          <title>{`${crossing.id} · ${top.id} 在上（压） · ${lower.id} 在下（挑）`}</title>
          {top.colorSegments.map((segment, index) => {
            const fromMm = Math.max(segment.fromMm, alongMm - halfMm);
            const toMm = Math.min(segment.toMm, alongMm + halfMm);
            if (toMm <= fromMm) return null;
            const color = highlighted ? '#ff3b30' : segment.color;
            const strokeWidth = (highlighted ? top.widthMm + 2 : top.widthMm) * mmToSvg;
            const coordinates = top.direction === 'warp'
              ? { x1: top.axisMm * mmToSvg, x2: top.axisMm * mmToSvg, y1: (top.startMm.y + fromMm) * mmToSvg, y2: (top.startMm.y + toMm) * mmToSvg }
              : { y1: top.axisMm * mmToSvg, y2: top.axisMm * mmToSvg, x1: (top.startMm.x + fromMm) * mmToSvg, x2: (top.startMm.x + toMm) * mmToSvg };
            const highlightCoordinates = top.direction === 'warp'
              ? { ...coordinates, x1: coordinates.x1 - .45 * mmToSvg, x2: coordinates.x2 - .45 * mmToSvg }
              : { ...coordinates, y1: coordinates.y1 - .45 * mmToSvg, y2: coordinates.y2 - .45 * mmToSvg };
            return <g key={index}>
              <line {...coordinates} stroke="#cfb98f" strokeWidth={strokeWidth + 3.2} />
              <line {...coordinates} stroke="#2f2117" strokeOpacity=".55" strokeWidth={strokeWidth + 1.5}
                filter={`url(#weave-shadow-${snapshot.designRevision})`} />
              <line {...coordinates} className="weave-top" stroke={color} strokeWidth={strokeWidth} />
              <line {...highlightCoordinates} stroke="#fff8e8" strokeOpacity=".28" strokeWidth={Math.max(0.6, mmToSvg * .35)} />
            </g>;
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
