import { Candidate } from '../../model';

export type PreviewProps = { candidate?: Candidate | null; grid?: boolean; density?: number; stripWidth?: number; color?: string; weave?: string; scale?: number };

// D replaces this visual fixture with the authoritative grid, strips,
// interlace snapshot and SVG from one calculation at one design revision.
export default function FanPreview({ candidate, grid = false, density = 65, stripWidth = 3, color, weave = 'plain-demo', scale = 100 }: PreviewProps) {
  const custom = candidate?.resultType === 'carrier_shape';
  const spacing = Math.max(6, Math.round(18 - density / 8));
  const lines = Array.from({ length: Math.ceil(260 / spacing) + 1 }, (_, i) => i * spacing);
  return <svg className="fan" viewBox="0 0 260 170" role="img" aria-label={custom ? '演示自定义形状' : '演示扇面'}>
    <defs><clipPath id="fanClip"><path d="M8 145 Q130 -100 252 145 L130 145 Z"/></clipPath></defs>
    {!custom && <path d="M8 145 Q130 -100 252 145 L130 145 Z" fill="#ead8b5" stroke="#ba8750" strokeWidth="4"/>}
    {!custom && <g clipPath="url(#fanClip)" opacity={grid ? .85 : .3}>{lines.map((x,i) => <g key={i}><path d={`M${x} 0 V170`} stroke="#aa8359" strokeWidth={stripWidth * .65}/><path d={weave==='diagonal-demo'?`M0 ${x} L260 ${x-70}`:`M0 ${x} H260`} stroke="#fff6de" strokeWidth={stripWidth * .65}/></g>)}</g>}
    {candidate && <polygon points={candidate.pointsMm.map(p => `${130+(p.x-130)*scale/100},${75+(p.y-75)*scale/100}`).join(' ')} fill={color ?? candidate.color} stroke="#14543b" strokeWidth="2"/>}
    {!custom && <><path d="M8 145 Q130 -100 252 145" fill="none" stroke="#dfae6e" strokeWidth="5"/><circle cx="130" cy="145" r="8" fill="#b17e4c"/></>}
  </svg>;
}
