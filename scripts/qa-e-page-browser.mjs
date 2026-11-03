import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=path.resolve('.e-craft-tests/page-qa');mkdirSync(out,{recursive:true});
const profile=mkdtempSync(path.join(tmpdir(),'bamboo-e-qa-'));
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions',
  '--remote-debugging-port=9228',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;const results=[];const errors=[];
try{
  let response;
  for(let i=0;i<50;i++){try{response=await fetch('http://127.0.0.1:9228/json/version');if(response.ok)break;}catch{}await wait(200);}
  if(!response?.ok)throw new Error('Headless browser unavailable');
  const target=await(await fetch('http://127.0.0.1:9228/json/new?'+encodeURIComponent('http://127.0.0.1:5176/'),{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((res,rej)=>{socket.onopen=res;socket.onerror=rej;});
  let seq=0;const pending=new Map();
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(JSON.stringify(m.error)));else p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description??''));};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing selector '+${JSON.stringify(selector)});e.click();return true;})()`);
  const text=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent`);
  const check=async(name,fn)=>{const value=await fn();if(!value)throw new Error('QA failed: '+name);results.push({name,pass:true});console.log('PASS '+name);};

  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  const byText=async label=>{await evaluate('(()=>{const e=[...document.querySelectorAll("button")].find(x=>x.textContent.includes('+JSON.stringify(label)+'));if(!e)throw Error("missing button");e.click();})()');await wait(100);};
  const until=async expr=>{for(let i=0;i<80;i++){if(await evaluate(expr))return;await wait(100);}throw Error('Timeout '+expr);};
  await until('!!document.querySelector(".logo")');
  async function generate(label){
    await byText('开始设计');
    if(label==='绿色三角形')await byText('使用绿色三角形联调样例');
    else {
      const screen=await evaluate('(()=>{const s=document.querySelector(".drawing-pad-custom");s.scrollIntoView({block:"center"});return '+JSON.stringify([[24,148.5],[66,62],[144,66],[186,148.5],[144,231],[66,235],[24,148.5]])+'.map(([x,y])=>{const p=s.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(s.getScreenCTM());return{x:q.x,y:q.y};});})()');
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...screen[0]});
      for(const p of screen.slice(1))await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...p});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...screen.at(-1)});
      await wait(100);
    }
    await byText('生成候选');await until('[...document.querySelectorAll("button")].some(x=>x.textContent.includes("确认当前结果")&&!x.disabled)');
    await byText('确认当前结果');await byText('十字编（课程版）');await byText('进入编辑预览');
  }
  async function inspect(){await byText('提交工艺检查');await until('!!document.querySelector("[data-testid=craft-status]")');}
  await generate('绿色三角形');await wait(650);
  const editShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'edit-reference.png'),Buffer.from(editShot.data,'base64'));
  await inspect();
  await check('fixed fan enters actual E checks and remains pending',()=>evaluate('document.querySelector("[data-testid=craft-status]").dataset.structure==="passed"&&document.querySelector("[data-testid=craft-status]").dataset.status==="pending"'));
  await check('pending craft state is visible without opening technical records',()=>evaluate('document.querySelector("[data-testid=visible-craft-state]").textContent.includes("待验证")&&!document.querySelector(".craft-technical").open'));
  await byText('待补设计资料');
  await check('pending design data can be filtered separately',()=>evaluate('[...document.querySelectorAll("[data-testid=pending-issue]")].length>0&&[...document.querySelectorAll("[data-testid=pending-issue]")].every(e=>e.dataset.category==="context")'));
  await byText('待补工艺依据');
  await check('physical evidence requests can be filtered separately',()=>evaluate('[...document.querySelectorAll("[data-testid=pending-issue]")].length>0&&[...document.querySelectorAll("[data-testid=pending-issue]")].every(e=>e.dataset.category==="evidence")'));
  await byText('全部');
  await check('clear decision and next step are prominent',()=>evaluate('document.querySelector(".craft-verdict h1").textContent.includes("结构检查通过")&&[...document.querySelectorAll("button")].some(b=>b.textContent.includes("进入下一步：结构拆解预览"))'));
  await check('19-rule records are available behind one disclosure',()=>evaluate('document.querySelector(".craft-technical>summary").textContent.includes("19")'));
  await check('issues include reasons recommendations and rule references',()=>evaluate('!!document.querySelector(".craft-suggestion")&&!!document.querySelector(".craft-issue details")'));
  await check('formal output entry stays closed',()=>evaluate('![...document.querySelectorAll("button")].some(b=>/导出|查看演示资料|正式材料/.test(b.textContent))'));
  await wait(650);const clearShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'clear-decision.png'),Buffer.from(clearShot.data,'base64'));
  const before=await evaluate('document.querySelector("[data-testid=craft-status]").dataset.revision');await byText('返回编辑');
  await check('leaving check discards previous visible result',()=>evaluate('!document.querySelector("[data-testid=craft-status]")'));
  const rect=await evaluate('(()=>{const r=document.querySelector("input[type=range]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await wait(150);
  await inspect();
  await check('edited parameters trigger a new revision check',async()=>before!==await evaluate('document.querySelector("[data-testid=craft-status]").dataset.revision'));
  await byText('返回编辑');await byText('平编演示');await inspect();
  await check('unsupported weave has a plain-language reason and recommendation',()=>evaluate('document.querySelector("[data-testid=craft-status]").dataset.status==="failed"&&document.querySelector(".craft-decision h2").textContent.includes("当前编法不在制作检查范围")&&!!document.querySelector("[data-testid=craft-recommendation]")'));
  await wait(650);const blockedShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'blocked-decision.png'),Buffer.from(blockedShot.data,'base64'));
  const rejectedRevision=await evaluate('Number(document.querySelector("[data-testid=craft-status]").dataset.revision)');
  await byText('切换编法并重新检查');await until('!!document.querySelector(".craft-review")');
  await check('adopting recommendation rechecks a new revision before next step',()=>evaluate('document.querySelector(".craft-review .kicker").textContent.includes("版本 "+'+(rejectedRevision+1)+')&&document.querySelector(".craft-facts").textContent.includes("E 检查状态：待验证")'));
  await click('.logo');await byText('自定义形状');await generate('叶片');await inspect();
  await check('custom leaf has independent structural checks and pending craft',()=>evaluate('document.querySelector("[data-testid=craft-status]").dataset.structure==="passed"&&document.querySelector("[data-testid=craft-status]").dataset.status==="pending"'));
  await check('B v1.5 custom effective area and handle context are requested',()=>evaluate('document.querySelector(".craft-check").textContent.includes("有效图样区")'));
  await check('custom handle child is counted only once through parent',()=>evaluate('(()=>{const ids=[...document.querySelectorAll(".craft-issue details p:first-of-type")].map(e=>e.textContent);return ids.filter(x=>x==="CUSTOM_CONTEXT_COMPLETE").length===1&&!ids.includes("CUSTOM_HANDLE_CONTEXT");})()'));
  await check('custom issues retain available location context',()=>evaluate('!!document.querySelector(".craft-locator svg")'));
  const desktop=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'desktop.png'),Buffer.from(desktop.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(200);
  await check('mobile page has no horizontal overflow',()=>evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'mobile.png'),Buffer.from(mobile.data,'base64'));
  await byText('进入下一步：结构拆解预览');await until('!!document.querySelector(".craft-review .craft-steps article")');
  await check('custom shape continues to a current-version structural preview',()=>evaluate('document.querySelector(".craft-review .craft-facts").textContent.includes("段竹条")&&document.querySelector(".craft-review .warning").textContent.includes("正式材料清单")'));

  await send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('(async()=>{const React=(await import("/node_modules/.vite/deps/react.js")).default;const domModule=await import("/node_modules/.vite/deps/react-dom_client.js");const createRoot=domModule.createRoot??domModule.default?.createRoot;const Panel=(await import("/src/modules/e/CraftCheckPanel.tsx")).default;const fixtures=await import("/tests/e-check/fixtures.ts");document.getElementById("root").style.display="none";let root,container;window.__qaBack=0;window.__qaPreview=0;window.__qaRenderCase=async(id)=>{root?.unmount();container?.remove();container=document.createElement("div");container.className="qa-component-root";document.body.append(container);root=createRoot(container);root.render(React.createElement(Panel,{input:id==="no-input"?null:fixtures.makePageCase(id),onBack:()=>{window.__qaBack++},onPreview:()=>{window.__qaPreview++}}));};return true;})()');
  for(const [id,status,structure] of [['normal','pending','passed'],['color-gap','failed','failed'],['crossing-reference','failed','failed'],['weave-matrix','failed','failed'],['missing-source','pending','pending'],['stale-snapshot','failed','failed'],['custom-context','pending','passed'],['custom-self-intersection','failed','failed']]){
    await evaluate('window.__qaRenderCase('+JSON.stringify(id)+')');
    await until('!!document.querySelector(".qa-component-root [data-testid=craft-status]")');
    await check('fixture UI '+id,()=>evaluate('(()=>{const e=document.querySelector(".qa-component-root [data-testid=craft-status]");return e.dataset.status==='+JSON.stringify(status)+'&&e.dataset.structure==='+JSON.stringify(structure)+';})()'));
    if(status==='failed')await check('failed fixture blocks structure preview '+id,()=>evaluate('![...document.querySelectorAll(".qa-component-root button")].some(b=>b.textContent.includes("进入下一步"))'));
    if(id==='color-gap'){
      await evaluate('document.querySelector(".qa-component-root .craft-decision button").click()');await wait(100);
      await check('failed color segment can be located from the main problem card',()=>evaluate('document.querySelector(".qa-component-root .craft-technical").open&&document.querySelector(".qa-component-root [data-testid=craft-location]").textContent.includes("mm")&&!!document.querySelector(".qa-component-root .craft-locator svg line")'));
    }
    if(id==='color-gap')await check('dependent checks say fix structure first instead of claiming missing carrier data',()=>evaluate('[...document.querySelectorAll(".qa-component-root [data-testid=pending-issue]")].some(e=>e.dataset.category==="blocked"&&e.textContent.includes("先处理"))'));
    if(id==='color-gap'||id==='missing-source'){
      await evaluate('window.scrollTo(0,0)');await wait(100);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,id+'.png'),Buffer.from(shot.data,'base64'));
    }
  }
  await evaluate('window.__qaRenderCase("no-input")');await until('!!document.querySelector(".qa-component-root h1")');
  await check('empty input explains missing design without fabricating a result',()=>evaluate('document.querySelector(".qa-component-root h1").textContent.includes("缺少当前设计")&&!document.querySelector(".qa-component-root [data-testid=craft-status]")'));
  await evaluate('(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);window.__qaDigestOriginal=original;window.__qaDelay=500;window.__qaStarted=0;crypto.subtle.digest=async(...args)=>{const delay=window.__qaDelay;window.__qaStarted++;const result=await original(...args);if(delay)await new Promise(r=>setTimeout(r,delay));return result;};})()');
  await evaluate('window.__qaRenderCase("color-gap")');await until('window.__qaStarted>0');await evaluate('window.__qaDelay=0;window.__qaRenderCase("normal")');await until('!!document.querySelector(".qa-component-root [data-testid=craft-status]")');await wait(1100);
  await check('late failed result cannot overwrite a newer design in check component',()=>evaluate('document.querySelector(".qa-component-root [data-testid=craft-status]").dataset.status==="pending"&&document.querySelector(".qa-component-root [data-testid=craft-status]").dataset.structure==="passed"'));
  await evaluate('crypto.subtle.digest=window.__qaDigestOriginal');

  await check('no browser runtime exceptions',async()=>errors.length===0);
  writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));
}catch(e){writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors,failure:String(e)},null,2));console.error(e);process.exitCode=1;}
finally{if(socket?.readyState===1)socket.close();browser.kill();}
