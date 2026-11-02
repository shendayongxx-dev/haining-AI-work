import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=path.resolve('.e-craft-tests/qa');mkdirSync(out,{recursive:true});
const profile=mkdtempSync(path.join(tmpdir(),'bamboo-e-qa-'));
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions',
  '--remote-debugging-port=9227',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;const results=[];const errors=[];
try{
  let response;
  for(let i=0;i<50;i++){try{response=await fetch('http://127.0.0.1:9227/json/version');if(response.ok)break;}catch{}await wait(200);}
  if(!response?.ok)throw new Error('Headless browser unavailable');
  const target=await(await fetch('http://127.0.0.1:9227/json/new?'+encodeURIComponent('http://127.0.0.1:5175/'),{method:'PUT'})).json();
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
    await byText('开始设计');await byText('文字描述');
    await evaluate('(()=>{const e=document.querySelector("textarea");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,'+JSON.stringify(label)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
    await byText('生成候选');await until('[...document.querySelectorAll("button")].some(x=>x.textContent.includes("确认当前结果")&&!x.disabled)');
    await byText('确认当前结果');await byText('十字编（课程版）');await byText('进入编辑预览');
  }
  async function inspect(){await byText('提交工艺检查');await until('!!document.querySelector("[data-testid=craft-status]")');}
  await generate('绿色三角形');await inspect();
  await check('fixed fan enters actual E checks and remains pending',()=>evaluate('document.querySelector("[data-testid=craft-status]").dataset.structure==="passed"&&document.querySelector("[data-testid=craft-status]").dataset.status==="pending"'));
  await check('19-rule summary is visible',()=>evaluate('document.querySelector("[data-testid=rule-summary]").textContent.includes("19")'));
  await check('issues include reasons recommendations and rule references',()=>evaluate('!!document.querySelector(".craft-suggestion")&&!!document.querySelector(".craft-issue details")'));
  await check('formal output entry stays closed',()=>evaluate('![...document.querySelectorAll("button")].some(b=>/导出|查看演示资料|正式材料/.test(b.textContent))'));
  const before=await text('[data-testid=craft-status]');await byText('返回编辑');
  await check('leaving check discards previous visible result',()=>evaluate('!document.querySelector("[data-testid=craft-status]")'));
  const rect=await evaluate('(()=>{const r=document.querySelector("input[type=range]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await wait(150);
  await inspect();
  await check('edited parameters trigger a new revision check',async()=>before!==await text('[data-testid=craft-status]'));
  await byText('返回编辑');await byText('平编演示');await inspect();
  await check('B v1.5 rejects demo plain weave for formal craft checking',()=>evaluate('document.querySelector("[data-testid=craft-status]").dataset.status==="failed"&&document.querySelector(".craft-check").textContent.includes("不在 B v1.5")'));
  await click('.logo');await byText('自定义形状');await generate('叶片');await inspect();
  await check('custom leaf has independent structural checks and pending craft',()=>evaluate('document.querySelector("[data-testid=craft-status]").dataset.structure==="passed"&&document.querySelector("[data-testid=craft-status]").dataset.status==="pending"'));
  await check('B v1.5 custom effective area and handle context are requested',()=>evaluate('document.querySelector(".craft-check").textContent.includes("有效图样区")'));
  await check('custom handle child is counted only once through parent',()=>evaluate('(()=>{const ids=[...document.querySelectorAll(".craft-issue details p:first-of-type")].map(e=>e.textContent);return ids.filter(x=>x==="CUSTOM_CONTEXT_COMPLETE").length===1&&!ids.includes("CUSTOM_HANDLE_CONTEXT");})()'));
  await byText('查看问题位置');
  await check('custom issue locates actual strip on geometry',()=>evaluate('document.querySelector("[data-testid=craft-location]").textContent.includes("mm")&&!!document.querySelector(".craft-locator svg line")'));
  const desktop=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'desktop.png'),Buffer.from(desktop.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(200);
  await check('mobile page has no horizontal overflow',()=>evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'mobile.png'),Buffer.from(mobile.data,'base64'));
  await check('no browser runtime exceptions',async()=>errors.length===0);
  writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));
}catch(e){writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors,failure:String(e)},null,2));console.error(e);process.exitCode=1;}
finally{if(socket?.readyState===1)socket.close();browser.kill();}
