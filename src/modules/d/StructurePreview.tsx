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
  const crossings = new Map(snapshot.interlace.crossings.map(value => [value.id, value]));
  const crossing = highlight?.kind === 'crossing' ? crossings.get(highlight.id) : undefined;
  const marker = highlight?.kind === 'position' ? highlight.positionMm : crossing?.positionMm;
  return <svg viewBox="0 0 520 300" role="img" aria-label="D 组竹条结构演示预览">
    <defs>
      <clipPath id={`fan-${snapshot.designRevision}`}>
        <polygon points={snapshot.activeArea.pointsMm.map(p => `${p.x * mmToSvg},${p.y * mmToSvg}`).join(' ')} />
      </clipPath>
    </defs>
    <polygon points={snapshot.activeArea.pointsMm.map(p => `${p.x * mmToSvg},${p.y * mmToSvg}`).join(' ')} fill="#ead8b5" />
    <g clipPath={`url(#fan-${snapshot.designRevision})`}>
      {snapshot.strips.list.map(strip => {
        const highlighted = isStripHighlighted(highlight, strip.id);
        return strip.colorSegments.map((segment, index) => strip.direction === 'warp'
          ? <line key={`${strip.id}-${index}`} data-strip-id={strip.id} x1={strip.axisMm * mmToSvg}
              x2={strip.axisMm * mmToSvg} y1={segment.fromMm * mmToSvg} y2={segment.toMm * mmToSvg}
              stroke={highlighted ? '#ff3b30' : segment.color} strokeWidth={(highlighted ? strip.widthMm + 2 : strip.widthMm) * mmToSvg} />
          : <line key={`${strip.id}-${index}`} data-strip-id={strip.id} y1={strip.axisMm * mmToSvg}
              y2={strip.axisMm * mmToSvg} x1={segment.fromMm * mmToSvg} x2={segment.toMm * mmToSvg}
              stroke={highlighted ? '#ff3b30' : segment.color} strokeWidth={(highlighted ? strip.widthMm + 2 : strip.widthMm) * mmToSvg} />);
      })}
    </g>
    <polygon points={snapshot.activeArea.pointsMm.map(p => `${p.x * mmToSvg},${p.y * mmToSvg}`).join(' ')} fill="none" stroke="#ba8750" strokeWidth="4" />
    {marker && <circle cx={marker.x * mmToSvg} cy={marker.y * mmToSvg} r="8" fill="none" stroke="#ff3b30" strokeWidth="4" />}
    <text x="10" y="290" fontSize="12" fill="#7a5b34">{snapshot.status.label} · revision {snapshot.generatedFromRevision}</text>
  </svg>;
}
