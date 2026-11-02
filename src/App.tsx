import { useEffect, useMemo, useRef, useState } from 'react';
import { Candidate, Carrier, Point, Step, SurfacePattern } from './model';
import Fan from './modules/d/FanPreview';
import CustomStructurePreview from './modules/d/CustomStructurePreview';
import DrawingCanvas from './DrawingCanvas';
import MaterialColorControls from './MaterialColorControls';
import { adaptConfirmedCandidate, adaptConfirmedCustomCandidate, calculateCustomStructure, calculateFanStructure, StructurePreview } from './modules/d';
import { canConfirmCandidate, generateCandidate } from './modules/c/generateCandidate';
import type { GenerationInput } from './modules/c/generateCandidate';
import { validateDemo } from './modules/e/validation';
import { fixedFanRef, resolveFixedFan, sameFixedFanRef } from './data/fixedFanRegistry';
import type { FixedFanCarrierId } from './data/fixedFanRegistry';
import { isFanWeaveAllowed, weaveForFanPreview } from './data/fanPreviewSelection';
import { calculateStructureV03, renderStructureSvg } from './modules/d/v03';
import type { WeaveId } from './modules/d/v03/types';

const steps: { id: Step; label: string }[] = [
  { id: 'carrier', label: '选择载体' }, { id: 'input', label: '输入创意' }, { id: 'generating', label: '生成中' },
  { id: 'confirm', label: '结果确认' }, { id: 'weave', label: '选择编法' }, { id: 'edit', label: '编辑预览' },
  { id: 'check', label: '工艺检查' }, { id: 'materials', label: '制作资料' },
];
type Stroke = Point[];
type InputMode = 'drawing' | 'imageText' | 'gesture';

const fanVariants = [
  { id: 'FAN-ROUND-170-V1', name: '圆形／月圆式', status: '当前联调' },
  { id: 'FAN-OVAL-150X180-V1', name: '长圆式', status: '结构联调' },
  { id: 'FAN-OCTAGON-170-V1', name: '八角式', status: '结构联调' },
  { id: 'FAN-BANANA-160X180-V1', name: '芭蕉式', status: '待开发' },
  { id: 'FAN-FIVE-LOBED-170-V1', name: '五角海棠型', status: '待开发' },
  { id: 'FAN-PALACE-WAIST-SQUARE-160X180-V1', name: '宫腰方形', status: '待开发' },
] as const;

const targetWeaves = [
  { id: 'CROSS-COURSE-2X2-V1', name: '十字编（课程版）' },
  { id: 'HERRING-3X3-V1', name: '人字编' },
  { id: 'SQUARE-HOLE-1X1-V1', name: '四角孔编' },
] as const;

function FanOutline({ id }: { id: string }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    {id.includes('ROUND') ? <circle cx="50" cy="47" r="37" /> : id.includes('OVAL') ? <ellipse cx="50" cy="47" rx="31" ry="40" /> : id.includes('OCTAGON') ? <polygon points="35,10 65,10 88,33 88,63 65,86 35,86 12,63 12,33" /> : <path d="M50 10 C80 10 91 34 84 60 C78 82 60 88 50 90 C40 88 22 82 16 60 C9 34 20 10 50 10 Z" />}
  </svg>;
}

function FanVariantPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return <div className="home-fan-picker" aria-label="选择扇面形态">
    <strong>选择扇面形态</strong><div>{fanVariants.map(item => <button key={item.id} type="button" disabled={item.status==='待开发'} className={selected===item.id?'selected':''} onClick={()=>onSelect(item.id)} title={`${item.id} · ${item.status}`}>
      <FanOutline id={item.id}/><span>{item.name}</span><small>{item.status}</small>
    </button>)}</div>
  </div>;
}

export default function App() {
  const [step,setStep]=useState<Step>('carrier');
  const [carrier,setCarrier]=useState<Carrier>('fan');
  const [fanVariantId,setFanVariantId]=useState<FixedFanCarrierId>('FAN-ROUND-170-V1');
  const [channel,setChannel]=useState<InputMode>('drawing');
  const [text,setText]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [inputImageUrl,setInputImageUrl]=useState<string|null>(null);
  const [strokes,setStrokes]=useState<Stroke[]>([]);
  const [candidate,setCandidate]=useState<Candidate|null>(null);
  const [confirmed,setConfirmed]=useState<Candidate|null>(null);
  const [revision,setRevision]=useState(0);
  const [weave,setWeave]=useState('');
  const [density,setDensity]=useState(21);
  const [width,setWidth]=useState(9);
  const [size,setSize]=useState(100);
  const [color,setColor]=useState('#315F3A');
  const [paletteOverrides,setPaletteOverrides]=useState<Record<string,string>>({});
  const [baseColor,setBaseColor]=useState('#C4A879');
  const [notice,setNotice]=useState('');
  const [heroMotion,setHeroMotion]=useState({x:0,y:0});
  const [activeScene,setActiveScene]=useState(0);
  const homeScrollRef=useRef<HTMLDivElement|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const generationCounter=useRef(0);
  const designId=useRef(`design-${crypto.randomUUID()}`);
  const customStructure=useMemo(()=>{
    if(!confirmed||confirmed.resultType!=='carrier_shape'||!['CROSS-1X1-V1',...targetWeaves.map(item=>item.id)].includes(weave))return null;
    return calculateCustomStructure(adaptConfirmedCustomCandidate(confirmed,{
      designId:designId.current,weaveId:weave as WeaveId,
      designRevision:revision,
      parameters:{density,stripWidthMm:width,warpColor:baseColor,weftColor:color,shapeScale:size/100},
    }));
  },[confirmed,weave,revision,density,width,color,baseColor,size]);
  const v03Structure=useMemo(()=>{
    if(!confirmed || confirmed.resultType!=='surface_pattern' || !confirmed.carrierRef) return null;
    if(!isFanWeaveAllowed(fanVariantId,weave)) return null;
    return calculateStructureV03({
      designId:designId.current,designRevision:revision,
      creativeSource:{confirmedGenerationId:confirmed.generationId,generationRevision:confirmed.generationRevision,generatorVersion:confirmed.generatorVersion,inputVersionId:confirmed.inputVersionId,generationIssues:confirmed.issues},
      carrierId:fanVariantId,weaveId:weave as WeaveId,
      pattern:{...confirmed.result,palette:confirmed.result.palette.map(entry=>({...entry,color:paletteOverrides[entry.paletteId]??entry.color}))} as SurfacePattern,baseColor,
      gridParameters:{warpCount:density,weftCount:density,stripWidthMm:width,pitchMm:(189-width)/(density-1)},
      patternPlacement:{scale:size/100,rotationDeg:0,offsetMm:{x:0,y:0},pivotMm:{x:105,y:110}},
    });
  },[confirmed,fanVariantId,weave,revision,baseColor,paletteOverrides,density,width,size]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(!file){setInputImageUrl(null);return;}
    const url=URL.createObjectURL(file);
    setInputImageUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);
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
  const patternColors=confirmed?.resultType==='surface_pattern'
    ? confirmed.result.palette.map(entry=>({...entry,color:paletteOverrides[entry.paletteId]??entry.color}))
    : [{paletteId:'custom-weft',color}];
  const changePatternColor=(paletteId:string,next:string)=>{
    const normalized=next.toUpperCase();
    const current=patternColors.find(entry=>entry.paletteId===paletteId)?.color;
    if(!current||current.toUpperCase()===normalized)return;
    if(confirmed?.resultType==='surface_pattern')setPaletteOverrides(previous=>({...previous,[paletteId]:normalized}));
    else setColor(normalized);
    setRevision(value=>value+1);
  };
  const selectWeave=(next:string)=>{if(next===weave)return;const open=next==='SQUARE-HOLE-1X1-V1';setWeave(next);setDensity(open?13:21);setWidth(9);setSize(100);setRevision(n=>n+1);};
  const maxGridCount=Math.max(9,Math.min(25,Math.floor(189/width)-(Math.floor(189/width)%2===0?1:0)));
  const updateGridDensity=(next:number)=>{setDensity(next);setRevision(n=>n+1);};
  const updateGridWidth=(next:number)=>{setWidth(next);setRevision(n=>n+1);};
  const invalidateGeneration=()=>{if(timer.current)clearTimeout(timer.current);generationCounter.current+=1;};
  const chooseCarrier=(next:Carrier)=>{if(next!==carrier){invalidateGeneration();setCarrier(next);setChannel('drawing');setStrokes([]);setFile(null);setText('');setCandidate(null);setWeave('');}};
  const chooseFanVariant=(next:string)=>{
    if(next===fanVariantId)return;
    const nextId=next as FixedFanCarrierId;
    if(step==='edit'&&carrier==='fan'&&confirmed?.resultType==='surface_pattern'){
      setFanVariantId(nextId);
      const nextWeave=weaveForFanPreview(weave,nextId);
      if(nextWeave!==weave)setWeave(nextWeave);
      setRevision(n=>n+1);
      return;
    }
    invalidateGeneration();setFanVariantId(nextId);setStrokes([]);setCandidate(null);setWeave('');
  };
  function generate(){
    if(channel==='drawing'&&!strokes.length)return setNotice('请先绘制，或使用绿色三角形联调样例。');
    if(channel==='gesture')return setNotice('手势控制尚未接入，当前请选择鼠标绘制或图文绘制。');
    if(channel==='imageText'){
      if(!file)return setNotice('请先上传参考图。');
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))return setNotice('参考图仅支持 PNG、JPEG 或 WebP。');
      if(!text.trim())return setNotice('请描述希望从参考图提取、改造或保留的内容。');
      return setNotice('图文生成模型尚未接入：当前无法生成新的纹样参考图或自定义载体形状。输入已保留，可继续编辑。');
    }
    const inputId=crypto.randomUUID();go('generating');
    const generationRevision=++generationCounter.current;
    timer.current=setTimeout(()=>{
      const base={channel:'drawing' as const,inputVersionId:inputId,generationRevision,strokes};
      const request:GenerationInput=carrier==='fan'?{...base,carrier:'fan',carrierRef:fixedFanRef(fanVariantId)}:{...base,carrier:'custom',carrierRef:null};
      void generateCandidate(request)
        .then(result => { if(generationCounter.current!==generationRevision)return;setCandidate(result); setStep('confirm'); })
        .catch(() => { if(generationCounter.current!==generationRevision)return;setNotice('生成失败，请修改输入后重试。当前已确认设计保持不变。'); setStep('input'); });
    },1300);
  }
  function confirm(){if(!candidate||!canConfirmCandidate(candidate))return;if(carrier==='fan'&&!sameFixedFanRef(candidate.carrierRef,fixedFanRef(fanVariantId)))return setNotice('载体已切换，请重新生成候选。');if(carrier==='custom'&&candidate.carrierRef)return setNotice('候选载体不匹配，请重新生成。');setConfirmed(candidate);setPaletteOverrides({});setRevision(n=>n+1);setWeave('');go('weave');}
  function update(fn:(v:number)=>void,v:number){fn(v);setRevision(n=>n+1);}
  return <div className={`app ${step==='carrier'?'home':''} ${['edit','check','materials'].includes(step)?'light':''}`}>
    <header className="topbar"><button className="logo" onClick={()=>go('carrier')}>竹编 DIY <span>· 创作实验室</span></button><span>以竹为材 · 编织生活的想象</span></header>
    {step!=='carrier'&&<nav className="flow" aria-label="创作流程">{steps.filter(s=>s.id!=='generating').map((s,i)=><div className={`flow-step ${step===s.id?'on':''} ${steps.findIndex(x=>x.id===step)>steps.findIndex(x=>x.id===s.id)?'done':''}`} key={s.id}><b>{i+1}</b><span>{s.label}</span></div>)}</nav>}
    <main key={step} className="scene">
      {step==='carrier'&&<div className="home-scroll" ref={homeScrollRef}>
        <div className="hero home-slide" data-scene="0" onPointerMove={e=>{if(e.pointerType==='mouse'){const r=e.currentTarget.getBoundingClientRect();setHeroMotion({x:(e.clientX-r.left-r.width/2)/r.width,y:(e.clientY-r.top-r.height/2)/r.height});}}} onPointerLeave={()=>setHeroMotion({x:0,y:0})} style={{'--hero-x':`${heroMotion.x*18}px`,'--hero-y':`${heroMotion.y*12}px`} as React.CSSProperties}>
          <div className="hero-photo" aria-hidden="true"/>
          <section><p className="kicker">以竹为材 · 编织生活的想象</p><h1>开始你的<br/><em>竹编创作</em></h1><p>从一种形态出发，让灵感在竹编中生长。</p><div className="carrier-label">选择创作载体</div><div className="carriers"><button type="button" aria-pressed={carrier==='fan'} className={carrier==='fan'?'selected':''} onClick={()=>chooseCarrier('fan')}><b>◉</b>扇面<small>表面图样</small></button><button type="button" aria-pressed={carrier==='custom'} className={carrier==='custom'?'selected':''} onClick={()=>chooseCarrier('custom')}><b>◇</b>自定义形状<small>几何载体</small></button><div aria-disabled="true">♙ 包<small>暂未开放</small></div><div aria-disabled="true">▢ 箱盒<small>暂未开放</small></div></div>{carrier==='fan'&&<FanVariantPicker selected={fanVariantId} onSelect={chooseFanVariant}/>}<button className="primary" onClick={()=>go('input')}>开始设计 <span>→</span></button><p className="muted">下一步，选择你的创作方式</p></section><div className="hero-visual" aria-hidden="true"><span>一篾一织 · 让想象成形</span></div>
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
      {step==='input'&&<div className="input-page">
        <div className="heading"><p className="kicker">01 / 输入创意</p><h1>让灵感有形</h1>
          <p>当前载体：{carrier==='fan'?resolveFixedFan(fixedFanRef(fanVariantId)).name+' · 表面图样':'自定义形状 · 几何载体'}</p></div>
        <div className="input-box">
          <div className="channels" role="group" aria-label="创意输入方式">
            <button type="button" className={channel==='drawing'?'active':''} aria-pressed={channel==='drawing'} onClick={()=>{setChannel('drawing');setNotice('');}}>✎　鼠标绘制</button>
            <button type="button" className={channel==='imageText'?'active':''} aria-pressed={channel==='imageText'} onClick={()=>{setChannel('imageText');setNotice('');}}>▧　图文绘制</button>
            {carrier==='custom'&&<button type="button" disabled title="后续接入" aria-label="手势控制，后续接入">◌　手势控制 · 待接入</button>}
          </div>
          {channel==='drawing'&&<><DrawingCanvas carrier={carrier} fanVariantId={fanVariantId} strokes={strokes} onChange={setStrokes}/>
            {carrier==='fan'&&<button className="link" onClick={()=>setStrokes([[{x:105,y:65},{x:70,y:145},{x:140,y:145},{x:105,y:65}]])}>使用绿色三角形联调样例</button>}</>}
          {channel==='imageText'&&<div className="image-text-input">
            <p className="muted">{carrier==='fan'?'上传参考图并描述想提取的物品或纹样；生成结果应是应用于扇面的新图样参考图。':'上传参考图并描述想提取的轮廓；生成结果应是可作为竹编载体的自定义形状。'}</p>
            <label className="upload"><strong>{file?file.name:'选择参考图'}</strong><small>PNG / JPEG / WebP</small>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
            {inputImageUrl&&<img className="input-reference-preview" src={inputImageUrl} alt="已选择的参考图"/>}
            <label className="image-prompt" htmlFor="image-prompt">描述要从参考图提取和调整的内容
              <textarea id="image-prompt" maxLength={500} value={text} onChange={e=>setText(e.target.value)}
                placeholder={carrier==='fan'?'例如：提取照片中的燕子，简化成适合扇面竹编的纹样':'例如：提取叶片外轮廓，生成可编织的自定义载体形状'}/></label>
            <p className="muted">{text.length}/500 · 图文生成模型尚未接入，当前不会用演示图形代替生成结果。</p>
          </div>}
          {notice&&<p className="notice" role="alert">{notice}</p>}
          <div className="actions"><button onClick={()=>go('carrier')}>← 返回载体</button>
            <button className="primary" onClick={generate}>{channel==='imageText'?'生成参考图 →':'生成候选 →'}</button></div>
        </div>
      </div>}
      {step==='generating'&&<div className="generating"><div className="orbit"><Fan grid/></div><p className="kicker">创意转译</p><h1>正在编织你的 <em>灵感</em></h1><p>正在为你的创意生成候选设计。</p><div className="bar"><i/></div><button className="link" onClick={()=>{invalidateGeneration();go('input');}}>返回修改</button></div>}
      {step==='confirm'&&candidate&&<div className="confirm"><div className="result-card"><Fan candidate={candidate}/><small>候选结果 · {candidate.resultType}</small></div><section><p className="kicker">02 / 结果确认</p><h1>{carrier==='fan'?'表面图样预览':'候选载体形状'}</h1><p>{candidate.label}</p><div className="detail">坐标单位 <b>mm</b>　生成版本 <b>{candidate.generationRevision}</b>　状态 <b>尚未确认</b></div>{candidate.issues.map(issue=><p key={issue.id} className="notice" role={issue.severity==='blocking'?'alert':'status'}>{issue.message}</p>)}<p className="muted">确认创意结果后选择编法；此确认不代表工艺通过。旧正式设计仅在确认新候选时替换。</p><div className="actions"><button onClick={()=>go('input')}>返回修改</button><button onClick={generate}>重新生成</button><button className="primary" disabled={!canConfirmCandidate(candidate)} onClick={confirm}>确认当前结果 →</button></div></section></div>}
      {step==='weave'&&confirmed&&<div className="weave-page"><div className="heading"><p className="kicker">03 / 选择编法</p><h1>为图样选择织法</h1><p>三种扇面和自定义形状均可选择四种编法；工艺仍待验证。</p></div><div className="weaves">{<button className={weave==='CROSS-1X1-V1'?'selected':''} onClick={()=>selectWeave('CROSS-1X1-V1')}><b>▦</b><strong>平编演示</strong><small>CROSS-1X1-V1 · 结构联调</small></button>}{targetWeaves.map(item=><button key={item.id} className={weave===item.id?'selected':''} onClick={()=>selectWeave(item.id)}><b>▧</b><strong>{item.name}</strong><small>{item.id} · 结构联调</small></button>)}</div><div className="actions center"><button onClick={()=>go('confirm')}>返回结果</button><button className="primary" disabled={!weave} onClick={()=>go('edit')}>进入编辑预览 →</button></div></div>}
      {step==='edit'&&confirmed&&<div className="studio">
        <aside className="design-sidebar">
          <div className="studio-section"><h2>当前设计</h2><div className="mini"><Fan candidate={confirmed} carrierId={confirmed.resultType==='surface_pattern'?fanVariantId:undefined}/><div><strong>{confirmed.label}</strong><small>已确认 · 版本 {revision}</small></div></div></div>
          <div className="studio-section"><h2>载体类型</h2><div className="option-grid"><button className={carrier==='fan'?'chosen':''} onClick={()=>{if(carrier!=='fan'){chooseCarrier('fan');go('input');}}}><span>◉</span>扇面</button><button className={carrier==='custom'?'chosen':''} onClick={()=>{if(carrier!=='custom'){chooseCarrier('custom');go('input');}}}><span>◇</span>自定义形状</button></div><p className="side-note">扇面与自定义形状的创意结果类型不同。切换这两类需重新输入；同类扇面可在下方直接试换。</p></div>
          {carrier==='fan'&&<div className="studio-section"><h2>扇面形态 <small>直接试换</small></h2><div className="fan-variant-grid">{fanVariants.map(item=><button key={item.id} type="button" className={fanVariantId===item.id?'chosen':''} aria-pressed={fanVariantId===item.id} disabled={item.status==='待开发'} onClick={()=>chooseFanVariant(item.id)} title={`${item.id} · ${item.status}`}><FanOutline id={item.id}/><strong>{item.name}</strong><small>{item.status}</small></button>)}</div><p className="side-note">保留已确认图样并立即重算预览。四种编法均可在已接入扇面直接试换；工艺仍待验证。</p></div>}
          <div className="studio-section"><h2>基础编法</h2><div className="weave-catalog">{<button type="button" className={weave==='CROSS-1X1-V1'?'chosen':''} onClick={()=>selectWeave('CROSS-1X1-V1')}><strong>平编演示</strong><small>结构联调</small></button>}{targetWeaves.map(item=><button key={item.id} type="button" className={weave===item.id?'chosen':''} onClick={()=>selectWeave(item.id)}><strong>{item.name}</strong><small>结构联调</small></button>)}</div><p className="side-note">三种扇面和自定义形状均可选择四种编法，并支持参数调节。工艺检查仍待 E 接入。</p></div>
        </aside>
        <section className="studio-main"><div className="studio-title"><h2>实时预览</h2></div><div className="preview">{v03Structure?<div className="v03-svg" dangerouslySetInnerHTML={{__html:renderStructureSvg(v03Structure)}}/>:customStructure?.status==='ok'?<CustomStructurePreview snapshot={customStructure.snapshot}/>:customStructure?.status==='blocked'?<div className="warning" role="alert">{customStructure.message}<br/><small>{customStructure.code}</small></div>:<Fan candidate={confirmed} carrierId={confirmed.resultType==='surface_pattern'?fanVariantId:undefined}/>}</div></section>
        <aside className="controls">{v03Structure?<><div className="control-head"><h2>扇面结构参数</h2><button onClick={()=>{setDensity(weave==='SQUARE-HOLE-1X1-V1'?13:21);setWidth(9);setSize(100);setBaseColor('#C4A879');setPaletteOverrides({});setRevision(n=>n+1);}}>↻ 重置</button></div><p>调整后同步重算竹条、交点、颜色段与编织顺序；工艺仍待验证。</p><label>经／纬条数 <b>{density}</b><input type="range" min="9" max={maxGridCount} step="2" value={density} onChange={e=>updateGridDensity(Number(e.target.value))}/></label><label>竹条宽度 <b>{width.toFixed(1)} mm</b><input type="range" min="2" max={Math.min(12,189/density)} step="0.5" value={width} onChange={e=>updateGridWidth(Number(e.target.value))}/></label><label>图样大小 <b>{size}%</b><input type="range" min="60" max="140" step="1" value={size} onChange={e=>update(setSize,Number(e.target.value))}/></label><p>自动计算：中心间距 {((189-width)/(density-1)).toFixed(1)} mm · 净孔 {Math.max(0,(189-width)/(density-1)-width).toFixed(1)} mm</p><MaterialColorControls baseColor={baseColor} patternColors={patternColors} onBaseColorChange={next=>{if(next.toUpperCase()!==baseColor.toUpperCase()){setBaseColor(next);setRevision(n=>n+1);}}} onPatternColorChange={changePatternColor}/></>:<><div className="control-head"><h2>参数调节</h2><button onClick={()=>{setDensity(21);setWidth(9);setSize(100);setColor('#315F3A');setBaseColor('#C4A879');setPaletteOverrides({});setRevision(n=>n+1);}}>↻ 重置</button></div><p>默认21经×21纬、9 mm宽，对应B v0.3毛坯规则；调整后仅供结构演示，工艺状态保持待验证。</p><label>竹条数量／方向 <b>{density}</b><input type="range" min="9" max="41" step="1" value={density} onChange={e=>update(setDensity,Number(e.target.value))}/></label><label>竹条宽度 <b>{width.toFixed(1)} mm</b><input type="range" min="1" max="10" step="0.5" value={width} onChange={e=>update(setWidth,Number(e.target.value))}/></label><label>图样大小 <b>{size}%</b><input type="range" min="60" max="140" value={size} onChange={e=>update(setSize,Number(e.target.value))}/></label><MaterialColorControls baseColor={baseColor} patternColors={patternColors} onBaseColorChange={next=>{if(next.toUpperCase()!==baseColor.toUpperCase()){setBaseColor(next);setRevision(n=>n+1);}}} onPatternColorChange={changePatternColor}/></>}<div className="actions"><button onClick={()=>go('input')}>重新输入创意</button><button className="primary" onClick={()=>go('check')}>提交工艺检查 →</button></div></aside>
      </div>}
      {step==='check'&&<div className="end"><p className="kicker">05 / 工艺检查</p><div className="end-icon">!</div><h1>工艺状态：{validateDemo(revision).status==='pending'?'待验证':validateDemo(revision).status}</h1><p>当前设计版本 {revision}：{validateDemo(revision).pendingReason}</p><div className="warning">不能宣称可制作，也不能生成正式材料清单或教程。</div><div className="actions center"><button onClick={()=>go('edit')}>返回编辑</button><button className="primary" onClick={()=>go('materials')}>查看演示资料页 →</button></div></div>}
      {step==='materials'&&<div className="end"><p className="kicker">06 / 制作资料</p><div className="end-icon">▤</div><h1>制作资料等待验证</h1><p>材料清单、竹条编号和图文教程必须对应通过检查的当前设计版本。</p><div className="warning">演示页面，未经工艺验证 · 正式生成与导出暂不可用</div><div className="actions center"><button onClick={()=>go('edit')}>返回编辑</button><button onClick={()=>go('check')}>查看检查状态</button></div></div>}
    </main>{step!=='carrier'&&<footer>竹编 DIY · 创作实验室</footer>}
  </div>;
}

