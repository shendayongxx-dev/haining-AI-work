import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {acceptCraftResult,craftInputDigest,validateCraft} from './validation';
import type {CraftInput,CraftIssue,CraftResult} from './craftTypes';
import './craft.css';
import {issuePresentation,categoryNames} from './checkPresentation';
import type {IssueCategory} from './checkPresentation';

const weaveNames:Record<string,string>={'CROSS-1X1-V1':'平编','CROSS-COURSE-2X2-V1':'十字编','HERRING-3X3-V1':'人字编','SQUARE-HOLE-1X1-V1':'四角孔编'};
const carrierNames:Record<string,string>={'FAN-ROUND-170-V1':'圆形扇面','FAN-OVAL-150X180-V1':'长圆扇面','FAN-OCTAGON-170-V1':'八角扇面'};
const labels={passed:'通过',failed:'需修改',pending:'待确认',notApplicable:'不适用'};

export default function CraftCheckPanel({input,preview,onBack,onPreview,onUseSupportedWeave}:{input:CraftInput|null;preview?:ReactNode;onBack:()=>void;onPreview?:(result:CraftResult)=>void;onUseSupportedWeave?:()=>void}){
  const [result,setResult]=useState<CraftResult|null>(null);
  const [error,setError]=useState('');
  const [focus,setFocus]=useState<CraftIssue|null>(null);
  const [pendingFilter,setPendingFilter]=useState<IssueCategory|'all'>('all');
  const [showPending,setShowPending]=useState(false);
  const advanceAfterRecommendation=useRef(false);
  const panelRef=useRef<HTMLDivElement>(null);
  const locateIssue=(issue:CraftIssue)=>{
    setFocus(issue);
    const details=panelRef.current?.querySelector<HTMLDetailsElement>('.craft-technical');if(details)details.open=true;
    requestAnimationFrame(()=>panelRef.current?.querySelector('.craft-locator')?.scrollIntoView({block:'center',behavior:'smooth'}));
  };
  useEffect(()=>{
    let cancelled=false;setResult(null);setError('');setFocus(null);setPendingFilter('all');setShowPending(false);
    if(input)void (async()=>{
      try{
        const incoming=await validateCraft(input),digest=await craftInputDigest(input);
        if(cancelled)return;
        const accepted=acceptCraftResult(digest,incoming);
        if(!accepted){setError('检查结果与当前设计不一致，请重新提交。');advanceAfterRecommendation.current=false;return;}
        setResult(accepted);
        if(advanceAfterRecommendation.current){
          advanceAfterRecommendation.current=false;
          if(accepted.structuralStatus==='passed'&&accepted.status!=='failed'&&onPreview)onPreview(accepted);
        }
      }catch(e){if(!cancelled){setError(e instanceof Error?e.message:String(e));advanceAfterRecommendation.current=false;}}
    })();
    return()=>{cancelled=true;};
  },[input]);

  const weaveId=input?.kind==='fixed-fan'?input.snapshot.weaveId:input?.input.weaveId;
  const carrierName=input?.kind==='fixed-fan'?carrierNames[input.snapshot.carrierId]??'固定扇面':input?'自定义形状':'当前设计';
  const weaveName=weaveId?weaveNames[weaveId]??weaveId:'未选编法';
  const failed=result?.issues.filter(issue=>issue.status==='failed')??[];
  const firstFailure=result&&failed[0]?issuePresentation(failed[0],result):null;
  const pending=result?.issues.filter(issue=>issue.status==='pending').map(issue=>({issue,copy:issuePresentation(issue,result)}))??[];
  const matchingPending=pending.filter(item=>pendingFilter==='all'||item.copy.category===pendingFilter);
  const unsupported=result?.ruleResults.some(row=>row.ruleId==='UNSUPPORTED_WEAVE'&&row.status==='failed')??false;
  const canContinue=!!result&&result.structuralStatus==='passed'&&result.status!=='failed'&&!!onPreview;
  const verdict=error||!input?'unavailable':!result?'checking':failed.length||result.status==='failed'?'blocked':result.structuralStatus==='passed'?'clear':'unavailable';
  const title=error?'检查未完成':!input?'缺少当前设计':!result?'正在检查当前搭配':verdict==='blocked'?'当前搭配未通过检查':verdict==='clear'?'结构检查通过':'暂时无法判断能否制作';
  const explanation=error?'请返回编辑页重新提交。':!input?'请先确认创意结果并选择编法。':!result?'正在核对竹条、交点和工艺规则。':verdict==='blocked'&&unsupported?'平编目前仅供预览，尚无对应的制作检查规则。':verdict==='blocked'?'检查发现了明确的结构或编法问题。请按下方原因修改后重新提交。':verdict==='clear'?'当前竹条和交点的结构关系没有发现阻断问题，可以继续查看结构拆解。':'当前结构资料不足，暂时不能给出可靠结论。';
  const boundary=input?.kind==='fixed-fan'?input.snapshot.carrierGeometry?.boundary as {type:string;cx?:number;cy?:number;r?:number;rx?:number;ry?:number;pointsMm?:number[][]}:null;
  const custom=input?.kind==='custom'&&input.result.status==='ok'?input.result.snapshot:null;
  const fixedStrip=input?.kind==='fixed-fan'?input.snapshot.strips?.find(s=>s.stripId===focus?.location.stripId):null;
  const customStrip=custom?.strips.list.find(s=>s.id===focus?.location.stripId);
  const position=focus?.location.positionMm;
  return <div className="craft-check" data-testid="craft-check" ref={panelRef}>
    <p className="kicker">06 / 工艺检查</p>
    <section className={`craft-verdict craft-verdict-${verdict}`} aria-live="polite">
      <div className="craft-verdict-mark" aria-hidden="true">{verdict==='clear'?'✓':verdict==='blocked'?'!':'?'}</div>
      <div className="craft-verdict-copy">
        <p className="craft-eyebrow">{carrierName} · {weaveName} · 设计版本 {result?.designRevision??(input?.kind==='fixed-fan'?input.current.designRevision:input?.input.designRevision??'—')}</p>
        <h1>{title}</h1><p className="craft-lead">{explanation}</p>
        {result&&<p className={`craft-state-note craft-state-${result.status}`} data-testid="visible-craft-state">工艺检查：{result.status==='pending'?'待验证':labels[result.status]}{result.status==='pending'?' · 还有资料或试编依据需要补齐':''}</p>}
        {verdict==='clear'&&<p className="craft-boundary-note">实物制作还没有完成验证。下一页是结构拆解预览，正式材料清单和制作教程暂未开放。</p>}
      </div>
      {preview&&<div className="craft-preview-card"><span>本次检查的方案</span>{preview}<small>与上一页编辑预览一致</small></div>}
    </section>
    {verdict==='blocked'&&<section className="craft-decision" aria-label="问题与解决方案">
      <span className="craft-section-label">发现的问题</span><h2>{unsupported?'当前编法不在制作检查范围':firstFailure?.title??'当前结构需要修改'}</h2>
      <p>{unsupported?'平编缺少已确认的制作规则，目前不能通过工艺检查。':firstFailure?.reason}</p>
      {!unsupported&&firstFailure&&<p className="craft-suggestion">建议：{firstFailure.suggestion}</p>}
      {!unsupported&&failed[0]&&(failed[0].location.positionMm||failed[0].location.stripId)&&<button type="button" className="craft-pending-more" onClick={()=>locateIssue(failed[0])}>定位首要问题</button>}
      {failed.length>1&&<p className="craft-more-count">另有 {failed.length-1} 项问题，可在下方查看完整记录。</p>}
      {unsupported&&onUseSupportedWeave&&<div className="craft-recommendation" data-testid="craft-recommendation">
        <span>可尝试的结构方案</span><strong>改用十字编</strong>
        <p>保留当前图样，切换后重新计算和检查。结构复核通过后进入拆解预览，工艺状态仍可能待验证。</p>
        <p>这是已接入的结构起点，尚未获得实物制作批准。</p>
        <button className="primary" type="button" onClick={()=>{advanceAfterRecommendation.current=true;onUseSupportedWeave();}}>切换编法并重新检查 →</button>
      </div>}
    </section>}
    {verdict==='clear'&&<section className="craft-decision craft-decision-clear" aria-label="检查结论">
      <span className="craft-section-label">接下来</span><h2>查看当前设计的结构拆解</h2>
      <p>当前编法、竹条和交点可以继续用于结构拆解预览。收边、柄口连接和材料准备还需要实物试编确认。</p>
      {canContinue&&<button className="primary" type="button" onClick={()=>onPreview(result!)}>进入下一步：结构拆解预览 →</button>}
    </section>}
    {verdict==='unavailable'&&!error&&result&&<section className="craft-decision"><h2>还缺少判断依据</h2><p>请返回编辑检查设计数据；缺少的载体或工艺资料会在完整记录中列出。</p></section>}
    {result&&pending.length>0&&<section className="craft-pending-list" aria-label="待验证事项">
      <h2>还有 {pending.length} 项待验证</h2><p>{failed.length?'请先处理需修改的问题；依赖这些结构数据的项目将在重查时复核。':'参数可以尝试调整；设计资料和试编依据需要补齐后再确认。'}</p>
      <div className="craft-pending-filters" aria-label="筛选待验证事项">
        <button type="button" aria-pressed={pendingFilter==='all'} onClick={()=>{setPendingFilter('all');setShowPending(false);}}>全部</button>
        {(['parameters','blocked','context','evidence'] as const).filter(category=>pending.some(item=>item.copy.category===category)).map(category=><button key={category} type="button" aria-pressed={pendingFilter===category} onClick={()=>{setPendingFilter(category);setShowPending(false);}}>{categoryNames[category]}</button>)}
      </div>
      {(showPending?matchingPending:matchingPending.slice(0,3)).map(({issue,copy})=><article className="craft-pending-item" data-testid="pending-issue" data-category={copy.category} key={issue.id}>
        <strong>{copy.title}</strong><span>{categoryNames[copy.category]}</span><p>{copy.reason}</p><p>下一步：{copy.suggestion}</p>
        <small>位置：{copy.locationLabel}</small>
        {(issue.location.positionMm||issue.location.stripId)&&<button type="button" onClick={()=>locateIssue(issue)}>查看问题位置</button>}
      </article>)}
      {!showPending&&matchingPending.length>3&&<button className="craft-pending-more" type="button" onClick={()=>setShowPending(true)}>展开全部 {matchingPending.length} 项待验证事项</button>}
    </section>}
    <div className="craft-secondary-actions"><button type="button" onClick={onBack}>← 返回编辑修改</button></div>
    {result&&<details className="craft-technical"><summary>查看完整检查记录（{result.ruleResults.length} 项）</summary>
      <p data-testid="craft-status" data-status={result.status} data-structure={result.structuralStatus} data-revision={result.designRevision}>结构复核：{labels[result.structuralStatus]} · 工艺状态：{labels[result.status]}</p>
      <p data-testid="rule-summary">通过 {result.summary.passedCount} · 需修改 {result.summary.failedCount} · 待确认 {result.summary.pendingCount} · 不适用 {result.summary.notApplicableCount}</p>
      <div className="craft-technical-grid"><div>
        {result.issues.map(issue=><article className={`craft-issue ${issue.status}`} key={issue.id}>
          <div><strong>{issue.title}</strong><span>{labels[issue.status]}</span></div><p>{issue.reason}</p><p className="craft-suggestion">建议：{issue.suggestion}</p>
          {(issue.location.positionMm||issue.location.stripId)&&<button type="button" onClick={()=>locateIssue(issue)}>查看问题位置</button>}
          <details><summary>规则与依据</summary><p>{issue.ruleId}</p><p>{issue.evidence.reference}</p></details>
        </article>)}
        <details><summary>逐条规则</summary>{result.ruleResults.map(row=><p key={row.ruleId}><code>{row.ruleId}</code>：{labels[row.status]} · {row.reason}</p>)}</details>
      </div><aside><div className="craft-locator"><h3>问题位置</h3><svg viewBox="0 0 210 297" role="img" aria-label="当前结构问题定位示意">
        {boundary?.type==='circle'&&<circle cx={boundary.cx} cy={boundary.cy} r={boundary.r} fill="none" stroke="#557a62"/>}
        {boundary?.type==='ellipse'&&<ellipse cx={boundary.cx} cy={boundary.cy} rx={boundary.rx} ry={boundary.ry} fill="none" stroke="#557a62"/>}
        {boundary?.type==='polygon'&&<polygon points={boundary.pointsMm?.map(p=>p.join(',')).join(' ')} fill="none" stroke="#557a62"/>}
        {custom&&<polygon points={custom.boundary.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#557a62"/>}
        {fixedStrip?.visibleSegments.map(s=><line key={s.segmentId} x1={s.startMm.x} y1={s.startMm.y} x2={s.endMm.x} y2={s.endMm.y} stroke="#ac4b32" strokeWidth="2"/>)}
        {customStrip&&<line x1={customStrip.startMm.x} y1={customStrip.startMm.y} x2={customStrip.endMm.x} y2={customStrip.endMm.y} stroke="#ac4b32" strokeWidth="2"/>}
        {position&&<circle cx={position.x} cy={position.y} r="4" fill="#ac4b32"/>}
      </svg><p data-testid="craft-location">{focus?`${focus.location.stripId??focus.location.crossingId??focus.location.path}${position?` · (${position.x}, ${position.y}) mm`:''}`:'选择一项有位置的问题查看。'}</p></div>
        <details><summary>来源与检查版本</summary><p>{result.engineVersion} / {result.ruleSetVersion}</p><p>输入指纹：{result.inputDigest}</p></details>
      </aside></div>
    </details>}
  </div>;
}
