import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import round from '../../../../../examples/d-v03-integration/round-cross-course/structure-snapshot.json';
import oval from '../../../../../examples/d-v03-integration/oval-herring/structure-snapshot.json';
import octagon from '../../../../../examples/d-v03-integration/octagon-square-hole/structure-snapshot.json';
import carrier from '../../../../../data/CARRIER_SPEC_V1_2.json';
import weave from '../../../../../data/WEAVE_SPEC_V1_2.json';
import references from './references.json';
import {consumeV03,sameSource,acceptV03Result,SOURCE_FIELDS} from '../consume.mjs';
import type {ConsumptionResult} from '../consume.mjs';
import {assertBrowserInput} from '../browserInput.mjs';
import {SnapshotView} from './SnapshotView';
import type {Focus} from './SnapshotView';
import type {StructureSnapshotV03} from '../../../d/v03/types';
import './style.css';

const specs={carrier,weave};
const samples=[{id:'round',name:'圆形 · 课程十字编',value:assertBrowserInput(round)},
  {id:'oval',name:'长圆式 · 人字编',value:assertBrowserInput(oval)},
  {id:'octagon',name:'八角式 · 四角孔编',value:assertBrowserInput(octagon)}];
const checkLabels:Record<string,string>={
  'creative-source-contract':'C图样来源合同','source-key-and-specifications':'来源键与规范版本','strip-identities-and-material-fields':'竹条身份与材料字段',
  'segments-colors-and-boundary':'可见段、颜色及边界','crossings-bidirectional-links-and-matrix':'交点双向引用与编法矩阵',
  'weaving-steps-consumption':'穿织操作顺序','engineering-warning-consumption':'工程预警定位','outer-base-and-accounting-contract':'外侧连续编织与计数口径'};
type Tab='checks'|'steps'|'materials'|'warnings'|'reference';
function App(){
  const [snapshot,setSnapshot]=useState<StructureSnapshotV03>(samples[0].value);
  const [result,setResult]=useState<ConsumptionResult|null>(()=>consumeV03(samples[0].value,specs));
  const [stage,setStage]=useState<'raw'|'trimmed'>('trimmed');
  const [tab,setTab]=useState<Tab>('checks');
  const [focus,setFocus]=useState<Focus>(null);
  const [stepIndex,setStepIndex]=useState(0),[opIndex,setOpIndex]=useState(0);
  const [notice,setNotice]=useState('已载入圆扇结构并完成E检查。结构消费通过不等于工艺验证通过。');
  const [error,setError]=useState(''),[running,setRunning]=useState(false);
  const [zoom,setZoom]=useState(100);
  const currentRef=useRef(snapshot.sourceKey);currentRef.current=snapshot.sourceKey;
  const fresh=!!result&&sameSource(result.sourceKey,snapshot.sourceKey);
  const ready=fresh&&!!result?.structuralConsumptionPassed;
  const raw=snapshot.stages.rawBlank;
  const steps=ready?result!.tutorialPreview.steps:[];
  const step=steps[stepIndex],op=step?.operations[opIndex];
  const focusedCrossing=focus?.crossingId?raw.crossings.find(c=>c.crossingId===focus.crossingId):null;
  const focusedStrip=focus?.stripId?snapshot.strips.find(s=>s.stripId===focus.stripId):null;
  const refKey=snapshot.weaveId==='CROSS-COURSE-2X2-V1'?'cross':snapshot.weaveId==='HERRING-3X3-V1'?'herring':'hole';
  const refGroup=references.groups.find(g=>g.key===refKey)!;
  function load(next:StructureSnapshotV03,label:string){currentRef.current=next.sourceKey;setSnapshot(next);setFocus(null);setStepIndex(0);setOpIndex(0);setError('');setNotice(`${label}已载入。来源键变化后旧结果立即过期，请重新检查。`);}
  async function check(){
    const captured=snapshot;setRunning(true);setError('');setNotice('正在执行E检查，可切换案例验证旧结果拒收…');
    await new Promise(resolve=>setTimeout(resolve,900));
    try{const incoming=consumeV03(captured,specs);const accepted=sameSource(currentRef.current,incoming.sourceKey);
      setResult(old=>acceptV03Result(currentRef.current,incoming,old));
      setNotice(accepted?(incoming.structuralConsumptionPassed?'结构消费检查通过；工艺、材料和教程仍待验证。':'发现结构问题，步骤和材料输出已锁定。'):'已拒收迟到的旧来源结果；当前设计未被覆盖。');
    }catch(e){setError(`检查失败：${e instanceof Error?e.message:String(e)}`);}finally{setRunning(false);}
  }
  async function upload(file?:File){if(!file)return;if(file.size>5*1024*1024){setError('文件超过本地联调页5 MB上限。');return;}
    try{const value=assertBrowserInput(JSON.parse(await file.text()));consumeV03(value,specs);load(value,file.name);}
    catch(e){setError(`未载入：${e instanceof Error?e.message:String(e)}。当前设计保持不变。`);}
  }
  function bump(generator=false){const next=structuredClone(snapshot);
    if(generator){next.structureGeneratorVersion=(snapshot.structureGeneratorVersion+'+local') as typeof next.structureGeneratorVersion;next.sourceKey.structureGeneratorVersion=next.structureGeneratorVersion;}
    else{next.designRevision++;next.sourceKey.designRevision=next.designRevision;next.generatedFromRevision++;next.sourceKey.generatedFromRevision=next.generatedFromRevision;}
    load(next,generator?'模拟生成器升级':'模拟设计版本更新');}
  function chooseStep(index:number){setStepIndex(index);setOpIndex(0);const s=steps[index];setFocus({stripId:s.workingStripId});}
  function chooseOperation(index:number){setOpIndex(index);const o=step.operations[index];setFocus({crossingId:o.crossingId});}
  return <div className="e-page">
    <header><a className="brand" href="/">编想成真<span>E模块 · 本地联调</span></a><span className="pending-label">工艺待验证 · 不提供正式导出</span></header>
    <section className="intro"><div><p className="eyebrow">STRUCTURE / MATERIAL / MAKING</p><h1>让每一步，都有依据。</h1><p>从毛坯到可见段，核对竹条、交点和制作顺序。三组真实快照，统一追溯。</p></div><div className="release">接口 v0.3<strong>生成器 {snapshot.structureGeneratorVersion.replace('D-STRUCTURE-','')}</strong><small>实物验证尚未完成</small></div></section>
    <section className="case-bar" aria-label="案例与检查操作"><div className="case-buttons">{samples.map(s=><button key={s.id} data-testid={`case-${s.id}`} className={snapshot.carrierId===s.value.carrierId?'selected':''} onClick={()=>load(s.value,s.name)}>{s.name}</button>)}</div>
      <label className="upload-button">上传JSON<input aria-label="上传v0.3快照" type="file" accept=".json,application/json" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
      <button className="primary" data-testid="run-check" disabled={running} onClick={()=>{void check();}}>{running?'检查中…':'重新检查'}</button>
    </section>
    <p className="notice" role="status" data-testid="notice">{notice}</p>{error&&<p className="error-banner" role="alert">{error}</p>}
    <div className="workbench">
      <section className="viewer"><div className="panel-heading"><h2>结构预览</h2><div className="segmented"><button aria-pressed={stage==='raw'} data-testid="stage-raw" onClick={()=>setStage('raw')}>毛坯</button><button aria-pressed={stage==='trimmed'} data-testid="stage-trimmed" onClick={()=>setStage('trimmed')}>裁剪成品</button></div></div>
        <div className="canvas"><div style={{width:`${zoom}%`}}><SnapshotView snapshot={snapshot} stage={stage} focus={fresh?focus:null} onFocus={f=>{if(fresh)setFocus(f);}}/></div></div>
        <div className="viewer-footer"><span>虚线：有效图样区 · 尺寸单位 mm</span><label>缩放 <input aria-label="预览缩放" type="range" min="80" max="150" step="10" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>{zoom}%</label></div>
        <div className="focus-info" data-testid="focus-info">{!focus?'点击竹条或交点，查看关联位置。':focusedStrip?`${focusedStrip.stripId} · ${focusedStrip.direction==='warp'?'经向':'纬向'} · ${focusedStrip.visibleSegments.length}个可见段 · 毛坯${focusedStrip.rawBlankLengthMm} mm`:focusedCrossing?`${focusedCrossing.crossingId} · 上层${focusedCrossing.topStripId} · ${focusedCrossing.trimmedProduct.visible?'成品可见':'仅毛坯操作'}`:focus.segmentId?`可见段 ${focus.segmentId}`:'工程预警定位'}<button onClick={()=>setFocus(null)}>清除定位</button></div>
        {focusedCrossing&&!focusedCrossing.trimmedProduct.visible&&stage==='trimmed'&&<p className="inline-note">此操作在成品中不可见，但毛坯编织仍需保留。<button onClick={()=>setStage('raw')}>切换到毛坯查看</button></p>}
        {focusedStrip&&<div className="segment-list">{focusedStrip.visibleSegments.length?focusedStrip.visibleSegments.map(seg=><button key={seg.segmentId} onClick={()=>{setStage('trimmed');setFocus({stripId:focusedStrip.stripId,segmentId:seg.segmentId});}}>{seg.segmentId} · {seg.lengthMm} mm</button>):<span>完全裁掉／零长度相切，无成品可见段。</span>}</div>}
        <dl className="metrics"><div><dt>原竹条</dt><dd>{snapshot.strips.length}<small>根</small></dd></div><div><dt>毛坯交点</dt><dd>{raw.crossings.length}</dd></div><div><dt>成品可见</dt><dd>{snapshot.stages.trimmedProduct.visibleCrossingIds.length}</dd></div></dl>
      </section>
      <section className="workspace"><div className="result-heading"><div><p className="eyebrow">E CHECK</p><h2 data-testid="result-state">{!fresh?'结果已过期':running?'检查中':result?.structuralConsumptionPassed?'结构消费通过':'结构检查未通过'}</h2></div><span>工艺 pending</span></div>
        {!fresh&&<p className="stale-banner" data-testid="stale-banner">当前来源键与旧结果不同，旧步骤、材料和预警定位已锁定。请重新检查。</p>}
        <nav className="tabs" aria-label="E功能">{([['checks','检查'],['steps','穿织步骤'],['materials','材料与编号'],['warnings','工程预警'],['reference','B图解参考']] as [Tab,string][]).map(([id,label])=><button key={id} data-testid={`tab-${id}`} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}{id==='warnings'?` ${snapshot.engineeringWarnings.length}`:''}</button>)}</nav>
        {tab==='checks'&&<div className="tab-body"><p>本检查验证结构数据可消费性，不能替代B复审和实物试编。</p>{result&&<ul className="check-list">{result.checks.map(c=><li key={c.id}><span className={c.pass?'check-pass':'check-fail'}>{c.pass?'✓':'!'}</span><span>{checkLabels[c.id]??c.id}</span><small>{!fresh?'旧结果':c.pass?'通过':'需修改'}</small></li>)}</ul>}
          {fresh&&result?.errors.map((e,i)=><div className="issue" key={i}><strong>{e.code}</strong><p>{e.message}</p><code>{e.path}</code><button onClick={()=>{const cross=raw.crossings.find(c=>c.crossingId===e.path);const strip=snapshot.strips.find(s=>s.stripId===e.path);setFocus(cross?{crossingId:cross.crossingId}:strip?{stripId:strip.stripId}:null);}}>定位已有对象</button></div>)}
          <div className="boundary-note"><strong>当前边界</strong><p>来源规范仍待B最终复审；备料与余量未确认。结构通过后可查看操作预览，正式制作资料导出始终禁用。</p></div>
          <details><summary>来源键与失效演示</summary><dl className="source-fields">{SOURCE_FIELDS.map(f=><div key={f}><dt>{f}</dt><dd>{String(snapshot.sourceKey[f as keyof typeof snapshot.sourceKey])}</dd></div>)}</dl><div className="actions"><button data-testid="bump-revision" onClick={()=>bump()}>模拟设计版本 +1</button><button data-testid="bump-generator" onClick={()=>bump(true)}>模拟生成器升级</button></div><p>以上按钮仅修改本页内存，不会修改仓库案例。</p></details>
        </div>}
        {tab==='steps'&&<div className="tab-body">{!ready?<p className="locked">请先完成当前来源的结构检查。</p>:<><p className="helper">工作条从上到下投放；每步内按交点顺序操作。裁剪后不可见的操作也保留。</p><label className="step-select">当前工作条<select data-testid="step-select" value={stepIndex} onChange={e=>chooseStep(Number(e.target.value))}>{steps.map((s,i)=><option key={s.step} value={i}>第{s.step}步 · {s.workingStripId} · {s.operations.length}个交点</option>)}</select></label>
          <div className="operation-feature" data-testid="operation-detail"><span>第{opIndex+1} / {step.operations.length}个交点</span><h3>{op.workingStripId} {op.action==='over'?'从上方经过':'从下方穿过'} {op.referenceStripId}</h3><p>{op.crossingId} · {op.trimmedProduct.visible?'成品可见，关联可见段':'成品不可见，属于毛坯操作'}</p><small>{op.trimmedProduct.workingSegmentId??'工作条无成品段'} / {op.trimmedProduct.referenceSegmentId??'参考条无成品段'}</small><button className="primary" data-testid="locate-operation" onClick={()=>{setFocus({crossingId:op.crossingId});if(!op.trimmedProduct.visible)setStage('raw');}}>定位当前操作</button></div>
          <div className="actions"><button disabled={opIndex===0} onClick={()=>chooseOperation(opIndex-1)}>上一个交点</button><button data-testid="next-operation" disabled={opIndex===step.operations.length-1} onClick={()=>chooseOperation(opIndex+1)}>下一个交点</button><button disabled={stepIndex===steps.length-1} onClick={()=>chooseStep(stepIndex+1)}>下一根工作条</button></div>
          <div className="op-grid">{step.operations.map((o,i)=><button key={o.operationId} aria-pressed={opIndex===i} onClick={()=>chooseOperation(i)} title={o.crossingId}>{o.referenceStripId}<span>{o.action==='over'?'上':'下'}</span></button>)}</div><p className="caption">这是快照驱动的穿织操作预览。准备、收边、加固和装柄仍需结合B原图与实物验证。</p></> }</div>}
        {tab==='materials'&&<div className="tab-body">{!ready?<p className="locked">请先完成当前来源的结构检查。</p>:<><div className="material-summary"><strong>{result!.materials.stripCount} 根原竹条</strong><span data-testid="stock-total">总备料：{result!.materials.totalStockLengthMm===null?'未知，待确认':result!.materials.totalStockLengthMm+' mm'}</span></div><p className="helper">按唯一stripId计数，多段不重复。毛坯和可见长度只用于几何记账，不回退为采购长度。</p><div className="table-scroll"><table><thead><tr><th>编号</th><th>宽/厚 mm</th><th>毛坯 mm</th><th>可见段/长度</th><th>备料 mm</th></tr></thead><tbody>{snapshot.strips.map(s=><tr key={s.stripId}><td><button data-testid={`material-${s.stripId}`} onClick={()=>setFocus({stripId:s.stripId})}>{s.stripId}</button></td><td>{s.widthMm} / {s.thicknessMm}</td><td>{s.rawBlankLengthMm}</td><td>{s.visibleSegments.length}段 / {s.visibleLengthMm}</td><td>{s.stockLengthMm===null?'待确认':s.stockLengthMm}</td></tr>)}</tbody></table></div></>}</div>}
        {tab==='warnings'&&<div className="tab-body">{!ready?<p className="locked">请先完成当前来源的结构检查。</p>:snapshot.engineeringWarnings.length===0?<div className="empty-state"><h3>当前快照未提供工程预警</h3><p>这不代表没有工艺风险，也不等于工艺通过。</p></div>:snapshot.engineeringWarnings.map(w=><article className="warning-item" key={w.warningId}><span>人工复核 · pending</span><h3>{w.message}</h3><code>{w.code}</code>{w.measurement&&<p>{w.measurement.measuredValue} {w.measurement.operator} {w.measurement.referenceValue} {w.measurement.unit}</p>}<p className="caption">{w.ruleSource}</p><button data-testid={`warning-${w.code}`} onClick={()=>{setFocus({stripId:w.stripId??undefined,segmentId:w.segmentId??undefined,crossingId:w.crossingIds?.[0],positionMm:w.positionMm??undefined});setStage('trimmed');}}>定位预警</button></article>)}</div>}
        {tab==='reference'&&<div className="tab-body"><h3>{refGroup.label} · B图解参考</h3><p className="helper">来自B v1.2原始图解。图片与每条自动操作尚未逐项对应，不作为本案例已完成制作的证据。</p><div className="reference-gallery">{refGroup.images.map(image=><a key={image.url} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={image.label} loading="lazy"/><span>{image.label}</span></a>)}</div><details><summary>图片来源记录</summary><p>B提交：{references.sourceCommit}</p>{refGroup.images.map(i=><p className="caption" key={i.url}>{i.originalPath}</p>)}</details></div>}
        <div className="export-bar"><span>正式材料与教程尚未验证</span><button data-testid="formal-export" disabled>正式导出暂不可用</button></div>
      </section>
    </div><footer>本地E模块 v0.3 · 复用D v0.3.4快照 · 未修改A主站入口 · 结构联调不等于实物验收</footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
