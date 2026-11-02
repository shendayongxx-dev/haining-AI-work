import {useEffect,useState} from 'react';
import {acceptCraftResult,craftInputDigest,validateCraft} from './validation';
import type {CraftInput,CraftIssue,CraftResult} from './craftTypes';
import './craft.css';
const labels={passed:'通过',failed:'需修改',pending:'待验证'};
export default function CraftCheckPanel({input,onBack}:{input:CraftInput|null;onBack:()=>void}){
  const [result,setResult]=useState<CraftResult|null>(null),[error,setError]=useState('');
  const [focus,setFocus]=useState<CraftIssue|null>(null),[showAll,setShowAll]=useState(false);
  useEffect(()=>{
    let cancelled=false;setResult(null);setError('');setFocus(null);setShowAll(false);
    if(input)void (async()=>{
      try{const incoming=await validateCraft(input),digest=await craftInputDigest(input);
        if(!cancelled)setResult(acceptCraftResult(digest,incoming));
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e));}
    })();
    return()=>{cancelled=true;};
  },[input]);
  const ordered=result?[...result.issues].sort((a,b)=>Number(b.status==='failed')-Number(a.status==='failed')):[];
  const issues=showAll?ordered:ordered.slice(0,30);
  const position=focus?.location.positionMm;
  const boundary=input?.kind==='fixed-fan'?input.snapshot.carrierGeometry.boundary as {type:string;cx?:number;cy?:number;r?:number;rx?:number;ry?:number;pointsMm?:number[][]}:null;
  const custom=input?.kind==='custom'&&input.result.status==='ok'?input.result.snapshot:null;
  const fixedStrip=input?.kind==='fixed-fan'?input.snapshot.strips.find(s=>s.stripId===focus?.location.stripId):null;
  const customStrip=custom?.strips.list.find(s=>s.id===focus?.location.stripId);
  return <div className="craft-check" data-testid="craft-check">
    <header><p className="kicker">05 / 工艺检查</p><h1>工艺状态：{error?'检查异常':!input?'尚无可检查结构':result?labels[result.status]:'检查中'}</h1>
      <p>固定扇面与自定义形状均进入同一检查流程。结构复核通过不代表实物可制作。</p>
      {result&&<p data-testid="craft-status" data-status={result.status} data-structure={result.structuralStatus}>设计版本 {result.designRevision} · 结构复核：{labels[result.structuralStatus]} · 工艺：{labels[result.status]}</p>}
      {result&&<p data-testid="rule-summary">规则记录 {result.ruleResults.length} 项：通过 {result.summary.passedCount} · 需修改 {result.summary.failedCount} · 待验证 {result.summary.pendingCount} · 不适用 {result.summary.notApplicableCount}</p>}
      {error&&<p role="alert">{error}，请返回编辑后重新检查。</p>}
      {!input&&<p role="alert">请先确认创意结果并选择编法，再提交检查。</p>}
    </header>
    <div className="craft-grid"><section aria-label="检查项目">
      {issues.map(issue=><article className={'craft-issue '+issue.status} key={issue.id}>
        <div><strong>{issue.title}</strong><span>{labels[issue.status]}</span></div><p>{issue.reason}</p>
        <p className="craft-suggestion">建议：{issue.suggestion}</p>
        <small>位置：{issue.location.stripId??issue.location.crossingId??issue.location.path}</small>
        <details><summary>规则与依据</summary><p>{issue.ruleId}</p><p>{issue.evidence.reference}</p><p>依据状态：{issue.evidence.verification==='missing'?'尚缺依据':issue.evidence.verification==='engineering-only'?'工程复核，非实物验证':'已验证'}</p></details>
        {(issue.location.positionMm||issue.location.stripId)&&<button type="button" onClick={()=>setFocus(issue)}>查看问题位置</button>}
      </article>)}
      {!showAll&&ordered.length>30&&<button onClick={()=>setShowAll(true)}>展开全部 {ordered.length} 项</button>}
    </section><aside>
      <div className="craft-locator"><h2>问题位置</h2><svg viewBox="0 0 210 297" role="img" aria-label="当前结构问题定位示意">
        {boundary?.type==='circle'&&<circle cx={boundary.cx} cy={boundary.cy} r={boundary.r} fill="none" stroke="#557a62"/>}
        {boundary?.type==='ellipse'&&<ellipse cx={boundary.cx} cy={boundary.cy} rx={boundary.rx} ry={boundary.ry} fill="none" stroke="#557a62"/>}
        {boundary?.type==='polygon'&&<polygon points={boundary.pointsMm?.map(p=>p.join(',')).join(' ')} fill="none" stroke="#557a62"/>}
        {custom&&<polygon points={custom.boundary.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#557a62"/>}
        {fixedStrip?.visibleSegments.map(s=><line key={s.segmentId} x1={s.startMm.x} y1={s.startMm.y} x2={s.endMm.x} y2={s.endMm.y} stroke="#ac4b32" strokeWidth="2"/>)}
        {customStrip&&<line x1={customStrip.startMm.x} y1={customStrip.startMm.y} x2={customStrip.endMm.x} y2={customStrip.endMm.y} stroke="#ac4b32" strokeWidth="2"/>}
        {position&&<circle cx={position.x} cy={position.y} r="4" fill="#ac4b32"/>}
      </svg><p data-testid="craft-location">{focus?`${focus.location.stripId??focus.location.crossingId??focus.location.path}${position?` · (${position.x}, ${position.y}) mm`:''}`:'选择检查项目，查看对应竹条或坐标。'}</p></div>
      <p className="warning">本阶段只开发工艺检查。制作流程转换、正式材料清单、教程及导出尚未开放。</p>
      <details><summary>来源与检查版本</summary><p>{result?.engineVersion} / {result?.ruleSetVersion}</p><p>本次输入指纹：{result?.inputDigest}</p>
        <p>{input?.kind==='custom'?'自定义快照仍是 v0.2，没有完整 D sourceKey；E 使用当前输入与完整快照指纹防止结果复用。':'固定扇面沿用完整 D sourceKey（含 patternPlacementKey）。'}</p></details>
      {result&&<details><summary>逐条规则记录</summary>{result.ruleResults.map(r=><p key={r.ruleId}><code>{r.ruleId}</code>：{r.status==='notApplicable'?'不适用':labels[r.status]}<br/>{r.reason}</p>)}</details>}
    </aside></div><div className="actions center"><button onClick={onBack}>返回编辑</button></div>
  </div>;
}
