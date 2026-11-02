import {useId} from 'react';
import type {StructureSnapshotV03,StripV03,VisibleSegmentV03} from '../../../d/v03/types';
export type Focus = {stripId?:string;segmentId?:string;crossingId?:string;positionMm?:{x:number;y:number}}|null;
type Shape = {type:'circle';cx:number;cy:number;r:number}|{type:'ellipse';cx:number;cy:number;rx:number;ry:number}|{type:'polygon';pointsMm:number[][]};
const color = (value:string) => /^#[0-9a-f]{6}$/i.test(value)?value:'#D9BC83';
function Outline({value,...props}:{value:unknown;[key:string]:unknown}){
  const b=value as Shape;
  return b.type==='circle'?<circle cx={b.cx} cy={b.cy} r={b.r} {...props}/>:b.type==='ellipse'?<ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} {...props}/>:<polygon points={b.pointsMm.map(p=>p.join(',')).join(' ')} {...props}/>;
}
function segmentPoint(s:StripV03,offset:number){return s.direction==='warp'?{x:s.axisMm,y:s.rawBlankSegment.startMm.y+offset}:{x:s.rawBlankSegment.startMm.x+offset,y:s.axisMm};}
function Line({start,end,...props}:{start:{x:number;y:number};end:{x:number;y:number};[key:string]:unknown}){
  return <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...props}/>;
}
export function SnapshotView({snapshot,stage,focus,onFocus}:{snapshot:StructureSnapshotV03;stage:'raw'|'trimmed';focus:Focus;onFocus:(f:Focus)=>void}){
  const clip='e-'+useId().replace(/[^a-z0-9]/gi,'');
  const raw=snapshot.stages.rawBlank, byId=new Map(snapshot.strips.map(s=>[s.stripId,s]));
  const crossing=focus?.crossingId?raw.crossings.find(c=>c.crossingId===focus.crossingId):null;
  const marker=crossing?.positionMm??focus?.positionMm;
  function at(s:StripV03,p:{x:number;y:number}){
    const offset=s.direction==='warp'?p.y-s.rawBlankSegment.startMm.y:p.x-s.rawBlankSegment.startMm.x;
    const part=s.visibleSegments.flatMap(v=>v.colorSegments).find(c=>offset>=c.stripOffsetStartMm-.01&&offset<=c.stripOffsetEndMm+.01);
    return color(part?.color??'#D9BC83');
  }
  const selected=focus?.stripId?byId.get(focus.stripId):null;
  const activeSegments=selected?(focus?.segmentId?selected.visibleSegments.filter(s=>s.segmentId===focus.segmentId):selected.visibleSegments):[];
  const rawBox=raw.boundary as {x:number;y:number;width:number;height:number};
  return <svg className="snapshot-svg" viewBox="0 0 210 235" role="img" aria-label={stage==='raw'?'毛坯竹条及穿织关系':'裁剪后成品竹条及可见段'}>
    <defs><clipPath id={clip}><Outline value={snapshot.carrierGeometry.boundary}/></clipPath></defs>
    <rect width="210" height="235" fill="#f7f1e3"/>
    {stage==='raw'?<rect x={rawBox.x} y={rawBox.y} width={rawBox.width} height={rawBox.height} fill="#eee1c8"/>:<Outline value={snapshot.carrierGeometry.boundary} fill="#eee1c8"/>}
    <g clipPath={stage==='trimmed'?`url(#${clip})`:undefined}>
      {snapshot.strips.map(s=><g key={s.stripId} onClick={()=>onFocus({stripId:s.stripId})} data-strip-id={s.stripId}>
        {stage==='raw'?<Line start={s.rawBlankSegment.startMm} end={s.rawBlankSegment.endMm} stroke={s.direction==='warp'?'#deca9f':'#c3a370'} strokeWidth={s.widthMm}/>:s.visibleSegments.flatMap(seg=>seg.colorSegments.map((c,i)=><Line key={seg.segmentId+'-'+i} start={segmentPoint(s,c.stripOffsetStartMm)} end={segmentPoint(s,c.stripOffsetEndMm)} stroke={color(c.color)} strokeWidth={s.widthMm}/>))}
      </g>)}
      {raw.crossings.filter(c=>stage==='raw'||c.trimmedProduct.visible).map(c=>{
        const s=byId.get(c.topStripId);if(!s)return null;
        const half=s.widthMm*.56, p=c.positionMm;
        const a=s.direction==='warp'?{x:p.x,y:p.y-half}:{x:p.x-half,y:p.y};
        const b=s.direction==='warp'?{x:p.x,y:p.y+half}:{x:p.x+half,y:p.y};
        return <g key={c.crossingId} onClick={()=>onFocus({crossingId:c.crossingId})} data-crossing-id={c.crossingId}>
          <Line start={a} end={b} stroke="#695334" strokeWidth={s.widthMm+.4} opacity={.4}/>
          <Line start={a} end={b} stroke={stage==='raw'?(s.direction==='warp'?'#deca9f':'#c3a370'):at(s,p)} strokeWidth={s.widthMm-.25}/>
        </g>;
      })}
      {selected&&(stage==='raw'?<Line start={selected.rawBlankSegment.startMm} end={selected.rawBlankSegment.endMm} stroke="#d65532" strokeWidth={selected.widthMm} opacity={.8} pointerEvents="none"/>:activeSegments.map((s:VisibleSegmentV03)=><Line key={s.segmentId} start={s.startMm} end={s.endMm} stroke="#d65532" strokeWidth={selected.widthMm} opacity={.8} pointerEvents="none"/>))}
    </g>
    <Outline value={snapshot.carrierGeometry.boundary} fill="none" stroke="#765d3b" strokeWidth={.8}/>
    <Outline value={snapshot.carrierGeometry.effectivePatternBoundary} fill="none" stroke="#31664b" strokeWidth={.6} strokeDasharray="2 2"/>
    {marker&&<g pointerEvents="none"><circle cx={marker.x} cy={marker.y} r={4} fill="none" stroke="#c43f28" strokeWidth={1}/><circle cx={marker.x} cy={marker.y} r={1} fill="#c43f28"/></g>}
    <text x="105" y="222" textAnchor="middle" fontSize="4.2" fill="#5c573f">{stage==='raw'?'毛坯：包含裁剪后不可见的操作':'成品：按可见段显示，未填造几何'} · mm</text>
  </svg>;
}
