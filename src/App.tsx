import { useEffect, useMemo, useRef, useState } from 'react';
import { Candidate, Carrier, InputChannel, Point, Step } from './model';
import { FORMAL_FAN_CARRIER_V1 } from './data/formalFanCarrier';
import Fan from './modules/d/FanPreview';
import { adaptConfirmedCandidate, calculateFanStructure, StructurePreview } from './modules/d';
import { canConfirmCandidate, generateCandidate } from './modules/c/generateCandidate';
import { validateDemo } from './modules/e/validation';

const steps: { id: Step; label: string }[] = [
  { id: 'carrier', label: '选择载体' }, { id: 'input', label: '输入创意' }, { id: 'generating', label: '生成中' },
  { id: 'confirm', label: '结果确认' }, { id: 'weave', label: '选择编法' }, { id: 'edit', label: '编辑预览' },
  { id: 'check', label: '工艺检查' }, { id: 'materials', label: '制作资料' },
];
type Stroke = Point[];

function Drawing({ strokes, onChange }: { strokes: Stroke[]; onChange: (s: Stroke[]) => void }) {
  const active = useRef<Stroke | null>(null);
  const [live, setLive] = useState<Stroke>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const xy = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 };
  };
  const points = (s: Stroke) => s.map(p => `${p.x},${p.y}`).join(' ');
  const fan = FORMAL_FAN_CARRIER_V1;
  return <div className="drawing"><div className="drawing-tools"><strong>直接绘制</strong><span>鼠标 / 触屏 / 触控笔</span><button onClick={() => { if(strokes.length){setRedo([...redo,strokes.at(-1)!]);onChange(strokes.slice(0,-1));} }}>撤销</button><button onClick={() => { if(redo.length){onChange([...strokes,redo.at(-1)!]);setRedo(redo.slice(0,-1));} }}>重做</button><button onClick={() => {onChange([]);setRedo([]);}}>清空</button></div><svg className="drawing-pad" viewBox="0 0 210 297" style={{touchAction:'none'}} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); active.current=[xy(e)]; setLive(active.current); }} onPointerMove={e => { if(active.current){ active.current=[...active.current,xy(e)];setLive(active.current); } }} onPointerUp={() => { if(active.current && active.current.length>1) onChange([...strokes,active.current]);active.current=null;setLive([]); }} onPointerCancel={()=>{active.current=null;setLive([]);}}><rect width="210" height="297" fill="#f4ead9"/><circle cx={fan.boundary.centerMm.x} cy={fan.boundary.centerMm.y} r={fan.boundary.radiusMm} fill="#ead9b9" stroke="#7f6848" strokeWidth="1.2"/><circle cx={fan.effectivePatternBoundary.centerMm.x} cy={fan.effectivePatternBoundary.centerMm.y} r={fan.effectivePatternBoundary.radiusMm} fill="#fffaf0" stroke="#2f7d68" strokeWidth="0.8" strokeDasharray="3 2"/><rect x={fan.handleReserve.x} y={fan.handleReserve.y} width={fan.handleReserve.width} height={fan.handleReserve.height} fill="#c85c5c" fillOpacity="0.25" stroke="#a43c3c" strokeWidth="0.6"/>{strokes.map((s,i) => <polyline key={i} points={points(s)} fill="none" stroke="#14543b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>)}<polyline points={points(live)} fill="none" stroke="#14543b" strokeWidth="2"/></svg><p>实线为170 mm扇面，绿色虚线内为150 mm有效图样区域；红色区域为扇柄连接保留区。保存坐标直接使用毫米。</p></div>;
}

export default function App() {
  const [step,setStep]=useState<Step>('carrier');
  const [carrier,setCarrier]=useState<Carrier>('fan');
  const [channel,setChannel]=useState<InputChannel>('drawing');
  const [text,setText]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [strokes,setStrokes]=useState<Stroke[]>([]);
  const [candidate,setCandidate]=useState<Candidate|null>(null);
  const [confirmed,setConfirmed]=useState<Candidate|null>(null);
  const [revision,setRevision]=useState(0);
  const [weave,setWeave]=useState('');
  const [density,setDensity]=useState(21);
  const [width,setWidth]=useState(3);
  const [size,setSize]=useState(100);
  const [color,setColor]=useState('#315F3A');
  const [notice,setNotice]=useState('');
  const [heroMotion,setHeroMotion]=useState({x:0,y:0});
  const [activeScene,setActiveScene]=useState(0);
  const homeScrollRef=useRef<HTMLDivElement|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const generationCounter=useRef(0);
  const designId=useRef(`design-${crypto.randomUUID()}`);
  const structure=useMemo(()=>{
    if(!confirmed||confirmed.resultType!=='surface_pattern'||weave!=='CROSS-1X1-V1')return null;
    return calculateFanStructure(adaptConfirmedCandidate(confirmed,{
      status:'confirmed',
      confirmedGenerationId:confirmed.generationId,
      confirmedGenerationRevision:confirmed.generationRevision,
    },{
      designId:designId.current,
      designRevision:revision,
      density,
      stripWidthMm:width,
      baseColor:'#e7cda9',
      patternColor:color,
      patternScale:size/100,
    }));
  },[confirmed,weave,revision,density,width,color,size]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(step!=='carrier'||!homeScrollRef.current)return;
    const root=homeScrollRef.current;
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(entry.isIntersecting)setActiveScene(Number((entry.target as HTMLElement).dataset.scene));}
    },{root,threshold:.55});
    root.querySelectorAll('.home-slide').forEach(slide=>observer.observe(slide));
    return ()=>observer.disconnect();
  },[step]);
  const go=(s:Step)=>{setNotice('');setStep(s);};
  function generate(){
    if(channel==='drawing'&&!strokes.length)return setNotice('请先绘制，或使用绿色三角形联调样例。');
    if(channel==='text'&&!text.trim())return setNotice('请输入创意描述。');
    if(channel==='referenceImage'&&!file)return setNotice('请选择参考图。');
    const inputId=crypto.randomUUID();go('generating');
    const generationRevision=++generationCounter.current;
    timer.current=setTimeout(()=>{
      void generateCandidate({ carrier, channel, inputVersionId: inputId, generationRevision, text, file, strokes })
        .then(result => { setCandidate(result); setStep('confirm'); })
        .catch(() => { setNotice('生成失败，请修改输入后重试。当前已确认设计保持不变。'); setStep('input'); });
    },1300);
  }
  function confirm(){if(!candidate||!canConfirmCandidate(candidate))return;setConfirmed(candidate);setRevision(n=>n+1);setWeave('');go('weave');}
  function update(fn:(v:number)=>void,v:number){fn(v);setRevision(n=>n+1);}
  return <div className={`app ${step==='carrier'?'home':''} ${['edit','check','materials'].includes(step)?'light':''}`}>
    <header className="topbar"><button className="logo" onClick={()=>go('carrier')}>竹编 DIY <span>· 创作实验室</span></button><span>以竹为材 · 编织生活的想象</span></header>
    {step!=='carrier'&&<nav className="flow" aria-label="创作流程">{steps.filter(s=>s.id!=='generating').map((s,i)=><div className={`flow-step ${step===s.id?'on':''} ${steps.findIndex(x=>x.id===step)>steps.findIndex(x=>x.id===s.id)?'done':''}`} key={s.id}><b>{i+1}</b><span>{s.label}</span></div>)}</nav>}
    <main key={step} className="scene">
      {step==='carrier'&&<div className="home-scroll" ref={homeScrollRef}>
        <div className="hero home-slide" data-scene="0" onPointerMove={e=>{if(e.pointerType==='mouse'){const r=e.currentTarget.getBoundingClientRect();setHeroMotion({x:(e.clientX-r.left-r.width/2)/r.width,y:(e.clientY-r.top-r.height/2)/r.height});}}} onPointerLeave={()=>setHeroMotion({x:0,y:0})} style={{'--hero-x':`${heroMotion.x*18}px`,'--hero-y':`${heroMotion.y*12}px`} as React.CSSProperties}>
          <div className="hero-photo" aria-hidden="true"/>
          <section><p className="kicker">以竹为材 · 编织生活的想象</p><h1>开始你的<br/><em>竹编创作</em></h1><p>从一种形态出发，让灵感在竹编中生长。</p><div className="carrier-label">选择创作载体</div><div className="carriers"><button type="button" aria-pressed={carrier==='fan'} className={carrier==='fan'?'selected':''} onClick={()=>setCarrier('fan')}><b>◉</b>扇面<small>表面图样</small></button><button type="button" aria-pressed={carrier==='custom'} className={carrier==='custom'?'selected':''} onClick={()=>setCarrier('custom')}><b>◇</b>自定义形状<small>几何载体</small></button><div aria-disabled="true">♙ 包<small>暂未开放</small></div><div aria-disabled="true">▢ 箱盒<small>暂未开放</small></div></div><button className="primary" onClick={()=>go('input')}>开始设计 <span>→</span></button><p className="muted">下一步，选择你的创作方式</p></section><div className="hero-visual" aria-hidden="true"><span>一篾一织 · 让想象成形</span></div>
          <span className="scroll-cue" aria-hidden="true">向下滑动探索 <b>↓</b></span>
        </div>
        <section className={`story-slide home-slide ${activeScene===1?'is-visible':''}`} data-scene="1">
          <div className="story-photo fan-scene" aria-hidden="true"/>
          <div className="story-content"><p className="story-overline"><span>工艺之美</span><i/>THE MAKING OF BAMBOO</p><h2>一根竹，<br/><em>历经层层工序</em></h2><p className="story-lead">竹编的细腻，始于对材料的理解。以青神竹编为例，从选竹、分层、开丝到编织与整理，每一步都在调整竹篾的柔韧、粗细与纹理。</p><div className="craft-sequence"><div><b>01</b><strong>选竹</strong><span>识材性，取其韧</span></div><div><b>02</b><strong>制篾</strong><span>分竹丝，理其形</span></div><div><b>03</b><strong>编织</strong><span>经纬交错，纹理由此生长</span></div></div><a className="story-source" href="https://www.ihchina.cn/project_details/25825.html" target="_blank" rel="noreferrer">资料参考：中国非物质文化遗产网 · 青神竹编 ↗</a></div>
          <span className="story-side-label" aria-hidden="true">篾 · 纹 · 形</span><span className="story-index">02 / 03</span>
        </section>
        <section className={`story-slide home-slide ${activeScene===2?'is-visible':''}`} data-scene="2">
          <div className="story-photo lantern-scene" aria-hidden="true"/>
          <div className="story-content"><p className="story-overline"><span>活态传承</span><i/>A LIVING HERITAGE</p><h2>手艺流转，<br/><em>生活仍在续写</em></h2><p className="story-lead">编织技艺在日常使用中被学习、改良与传递。它的传承发生在手艺人、家庭与社区之间，也在新的器物和生活场景中延续。</p><div className="heritage-note"><span>传承，不只是保存一件作品</span><strong>更是让一双手的经验，走向下一双手。</strong></div><a className="story-source" href="https://www.ihchina.cn/art/detail/id/27942.html" target="_blank" rel="noreferrer">资料参考：中国非物质文化遗产网 · 编织技艺活态传承 ↗</a></div>
          <span className="story-side-label" aria-hidden="true">竹 · 人 · 生 活</span><span className="story-index">03 / 03</span>
        </section>
      </div>}
      {step==='input'&&<div className="input-page"><div className="heading"><p className="kicker">01 / 输入创意</p><h1>让灵感有形</h1><p>当前载体：{carrier==='fan'?`${FORMAL_FAN_CARRIER_V1.carrierName} · 表面图样`:'自定义形状 · 几何载体'}</p></div><div className="input-box"><div className="channels"><button className={channel==='drawing'?'active':''} onClick={()=>setChannel('drawing')}>✎　直接绘制</button><button className={channel==='text'?'active':''} onClick={()=>setChannel('text')}>T　文字描述</button><button className={channel==='referenceImage'?'active':''} onClick={()=>setChannel('referenceImage')}>▧　参考图</button></div>{channel==='drawing'&&<><Drawing strokes={strokes} onChange={setStrokes}/><button className="link" onClick={()=>setStrokes([[{x:105,y:65},{x:70,y:145},{x:140,y:145},{x:105,y:65}]])}>使用绿色三角形联调样例</button></>}{channel==='text'&&<><textarea maxLength={500} value={text} onChange={e=>setText(e.target.value)} placeholder="描述你想要的竹编图样或形状……"/><p className="muted">{text.length}/500 · 绿色三角形和自定义叶片可做结构化联调；其他描述等待真实模型适配器</p></>}{channel==='referenceImage'&&<label className="upload"><strong>{file?file.name:'选择一张参考图'}</strong><small>PNG / JPEG / WebP · 当前完成格式和候选接口验证，assetRef 与视觉模型待 A 接入</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}{notice&&<p className="notice" role="alert">{notice}</p>}<div className="actions"><button onClick={()=>go('carrier')}>← 返回载体</button><button className="primary" onClick={generate}>生成候选 →</button></div></div></div>}
      {step==='generating'&&<div className="generating"><div className="orbit"><Fan grid/></div><p className="kicker">创意转译</p><h1>正在编织你的 <em>灵感</em></h1><p>正在为你的创意生成候选设计。</p><div className="bar"><i/></div><button className="link" onClick={()=>{if(timer.current)clearTimeout(timer.current);go('input');}}>返回修改</button></div>}
      {step==='confirm'&&candidate&&<div className="confirm"><div className="result-card"><Fan candidate={candidate}/><small>候选结果 · {candidate.resultType}</small></div><section><p className="kicker">02 / 结果确认</p><h1>{carrier==='fan'?'表面图样预览':'候选载体形状'}</h1><p>{candidate.label}</p><div className="detail">坐标单位 <b>mm</b>　生成版本 <b>{candidate.generationRevision}</b>　状态 <b>尚未确认</b></div>{candidate.issues.map(issue=><p key={issue.id} className="notice" role={issue.severity==='blocking'?'alert':'status'}>{issue.message}</p>)}<p className="muted">确认创意结果后选择编法；此确认不代表工艺通过。旧正式设计仅在确认新候选时替换。</p><div className="actions"><button onClick={()=>go('input')}>返回修改</button><button onClick={generate}>重新生成</button><button className="primary" disabled={!canConfirmCandidate(candidate)} onClick={confirm}>确认当前结果 →</button></div></section></div>}
      {step==='weave'&&confirmed&&<div className="weave-page"><div className="heading"><p className="kicker">03 / 选择编法</p><h1>为图样选择织法</h1><p>当前联调规则：CROSS-1X1-V1。</p></div><div className="weaves"><button className={weave?'selected':''} onClick={()=>{if(!weave){setWeave('CROSS-1X1-V1');setRevision(n=>n+1);}}}><b>▦</b><strong>平编</strong><small>CROSS-1X1-V1 · 21×21</small></button><div><b>▧</b><strong>斜纹编</strong><small>待规则确认</small></div><div><b>◇</b><strong>人字纹</strong><small>待规则确认</small></div></div><div className="actions center"><button onClick={()=>go('confirm')}>返回结果</button><button className="primary" disabled={!weave} onClick={()=>go('edit')}>进入编辑预览 →</button></div></div>}
      {step==='edit'&&confirmed&&<div className="studio">
        <aside className="design-sidebar">
          <div className="studio-section"><h2>当前设计</h2><div className="mini"><Fan candidate={confirmed}/><div><strong>{confirmed.label}</strong><small>已确认 · 版本 {revision}</small></div></div></div>
          <div className="studio-section"><h2>载体 <small>切换后重新确认创意</small></h2><div className="option-grid"><button className={carrier==='fan'?'chosen':''} onClick={()=>{if(carrier!=='fan'){setCarrier('fan');go('input');}}}><span>◉</span>扇面</button><button className={carrier==='custom'?'chosen':''} onClick={()=>{if(carrier!=='custom'){setCarrier('custom');go('input');}}}><span>◇</span>自定义形状</button></div><p className="side-note">改变载体将返回输入流程，当前已确认设计会保留到新候选确认。</p></div>
          <div className="studio-section"><h2>基础编法 <small>正式载体联调</small></h2><div className="option-grid weave-options"><button className={weave==='CROSS-1X1-V1'?'chosen':''} onClick={()=>{if(weave!=='CROSS-1X1-V1'){setWeave('CROSS-1X1-V1');setRevision(n=>n+1);}}}><span>▦</span>平编</button><button disabled title="等待 B 提供规则"><span>▨</span>斜纹编</button></div><p className="side-note">当前使用 CROSS-1X1-V1 生成 21经×21纬；实际制作仍待试编验证。</p></div>
        </aside>
        <section className="studio-main"><div className="studio-title"><h2>实时预览</h2><span>圆扇结构示意预览 · 尚未按 top 表现局部压挑 · 工艺 pending</span><small>版本 {revision}</small></div><div className="preview">{structure?<StructurePreview snapshot={structure}/>:<Fan candidate={confirmed}/>}<small>{structure?`D 结构快照 · ${structure.strips.list.length} 根竹条 · ${structure.interlace.crossings.length} 个交织点`:'当前结果尚未进入 D 扇面结构计算'}</small></div></section>
        <aside className="controls"><div className="control-head"><h2>参数调节</h2><button onClick={()=>{setDensity(21);setWidth(3);setSize(100);setColor('#315F3A');setRevision(n=>n+1);}}>↻ 重置</button></div><p>本轮唯一案例固定为 21经×21纬；调整其他设计参数后旧检查与教程失效。</p><label>竹条数量／方向 <b>{density}</b><input type="range" min="21" max="21" value={density} readOnly/></label><label>竹条宽度 <b>{width.toFixed(1)} mm</b><input type="range" min="1" max="5" step="0.5" value={width} onChange={e=>update(setWidth,Number(e.target.value))}/></label><label>图样大小 <b>{size}%</b><input type="range" min="60" max="140" value={size} onChange={e=>update(setSize,Number(e.target.value))}/></label><div className="palette"><b>图样颜色</b><div>{[['#315F3A','C 组原始绿'],['#0e6652','墨竹青'],['#75a78d','青玉绿']].map(([hex,name])=><button key={hex} className={color===hex?'active':''} style={{background:hex}} title={name} aria-label={name} onClick={()=>{if(color!==hex){setColor(hex);setRevision(n=>n+1);}}}/>)}</div></div><div className="actions"><button onClick={()=>go('confirm')}>返回结果</button><button className="primary" onClick={()=>go('check')}>提交工艺检查 →</button></div></aside>
      </div>}
      {step==='check'&&<div className="end"><p className="kicker">05 / 工艺检查</p><div className="end-icon">!</div><h1>工艺状态：{validateDemo(revision).status==='pending'?'待验证':validateDemo(revision).status}</h1><p>当前设计版本 {revision}：{validateDemo(revision).pendingReason}</p><div className="warning">不能宣称可制作，也不能生成正式材料清单或教程。</div><div className="actions center"><button onClick={()=>go('edit')}>返回编辑</button><button className="primary" onClick={()=>go('materials')}>查看演示资料页 →</button></div></div>}
      {step==='materials'&&<div className="end"><p className="kicker">06 / 制作资料</p><div className="end-icon">▤</div><h1>制作资料等待验证</h1><p>材料清单、竹条编号和图文教程必须对应通过检查的当前设计版本。</p><div className="warning">演示页面，未经工艺验证 · 正式生成与导出暂不可用</div><div className="actions center"><button onClick={()=>go('edit')}>返回编辑</button><button onClick={()=>go('check')}>查看检查状态</button></div></div>}
    </main>{step!=='carrier'&&<footer>竹编 DIY · 创作实验室</footer>}
  </div>;
}

