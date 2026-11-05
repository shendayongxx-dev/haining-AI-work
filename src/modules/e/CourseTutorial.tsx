import {useState} from 'react';

const steps = [
  {title:'排经与编号', instruction:'将经篾等距平行排列并依次编号，固定经篾后再穿纬。', check:'检查方向、间距和编号是否一致。'},
  {title:'按四行循环穿纬', instruction:'第 1 行先挑二再压二；第 2 行先压一再挑二；第 3 行先压二再挑二；第 4 行先挑一再压二。各行随后交替挑二、压二，第 5 行起重复四行。', check:'逐行对照起始挑压，并检查行间错位。'},
  {title:'校正与裁切', instruction:'编织中逐行推紧，覆盖目标边界后用等比例纸样定位裁切。', check:'先核对覆盖和边线位置，裁切余量按实物试编确认。'},
  {title:'收边与装柄复核', instruction:'参考课程教案完成包边和中轴定位。具体收边与装柄方式由实物试编确定。', check:'检查边缘连续性、扇面平整度和柄口牢固度。'},
] as const;
const pattern = [[1,1,0,0,1,1],[0,1,1,0,0,1],[0,0,1,1,0,0],[1,0,0,1,1,0]];

function CourseDiagram({step}:{step:number}) {
  return <svg className="course-tutorial-diagram" viewBox="0 0 280 162" role="img" aria-label={['等距排经与编号示意','课程十字编四行挑压示意','纸样与目标边界示意','收边与柄口示意'][step]}>
    <rect x="1" y="1" width="278" height="160" rx="12" fill="#f3ead9" stroke="#d8c9a9"/>
    {step<2 ? <>
      {pattern[0].map((_,col)=><g key={col}>
        <rect x={60+col*27} y="30" width="13" height="112" rx="3" fill="#c6a26d"/>
        {step===0&&<text x={66.5+col*27} y="23" textAnchor="middle" fontSize="11" fill="#365748">{col+1}</text>}
      </g>)}
      {step===1&&pattern.map((line,row)=><g key={row}>
        <rect x="45" y={44+row*25} width="183" height="12" rx="3" fill="#2b6956"/>
        {line.map((lifted,col)=>lifted ? <rect key={col} x={60+col*27} y={42+row*25} width="13" height="16" rx="2" fill="#c6a26d"/> : null)}
        <text x="33" y={54+row*25} textAnchor="middle" fontSize="12" fill="#365748">{row+1}</text>
      </g>)}
    </> : <>
      <rect x="72" y="17" width="136" height="126" fill="#e8d3ad" stroke="#c6a26d" strokeDasharray="4 4"/>
      <circle cx="140" cy="79" r="48" fill="#dfc696" stroke="#2b6956" strokeWidth={step===3?7:2} strokeDasharray={step===2?'5 3':undefined}/>
      {step===3&&<path d="M140 118v28" stroke="#2b6956" strokeWidth="10" strokeLinecap="round"/>}
    </>}
  </svg>;
}

export default function CourseTutorial() {
  const [current,setCurrent]=useState(0);
  const step=steps[current];
  return <details className="course-tutorial">
    <summary>查看课程十字编步骤参考</summary>
    <p>来源：B 组 v2.0 交接包《十字编（课程版）步骤》。插图用于说明课程动作，当前设计的备料与连接方式仍需实物复核。</p>
    <nav aria-label="教程步骤">
      {steps.map(({title},i)=><button type="button" key={title} aria-current={i===current?'step':undefined} onClick={()=>setCurrent(i)}>{i+1}. {title}</button>)}
    </nav>
    <div className="course-tutorial-content" aria-live="polite">
      <CourseDiagram step={current}/>
      <div><h3>{current+1} / {steps.length} · {step.title}</h3><p>{step.instruction}</p><p><strong>自查：</strong>{step.check}</p></div>
    </div>
    <div className="course-tutorial-actions">
      <button type="button" disabled={current===0} onClick={()=>setCurrent(current-1)}>上一步</button>
      <button type="button" disabled={current===steps.length-1} onClick={()=>setCurrent(current+1)}>下一步</button>
    </div>
  </details>;
}
