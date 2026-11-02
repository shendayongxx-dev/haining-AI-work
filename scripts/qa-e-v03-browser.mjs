import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=path.resolve('.e-qa');mkdirSync(out,{recursive:true});
const profile=mkdtempSync(path.join(tmpdir(),'bamboo-e-qa-'));
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions',
  '--remote-debugging-port=9226',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;const results=[];const errors=[];
try{
  let response;
  for(let i=0;i<50;i++){try{response=await fetch('http://127.0.0.1:9226/json/version');if(response.ok)break;}catch{}await wait(200);}
  if(!response?.ok)throw new Error('Headless browser unavailable');
  const target=await(await fetch('http://127.0.0.1:9226/json/new?'+encodeURIComponent('http://127.0.0.1:5174/e-preview.html'),{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((res,rej)=>{socket.onopen=res;socket.onerror=rej;});
  let seq=0;const pending=new Map();
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(JSON.stringify(m.error)));else p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description??''));};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing selector '+${JSON.stringify(selector)});e.click();return true;})()`);
  const text=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent`);
  const check=async(name,fn)=>{const value=await fn();if(!value)throw new Error('QA failed: '+name);results.push({name,pass:true});console.log('PASS '+name);};
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await evaluate(`!!document.querySelector('[data-testid="result-state"]')`))break;await wait(200);}
  await check('initial round result renders',async()=>String(await text('[data-testid="result-state"]')).includes('结构消费通过'));
  await click('[data-testid="tab-materials"]');await wait(80);
  await check('unknown stock is not replaced by geometric length',async()=>String(await text('[data-testid="stock-total"]')).includes('未知'));
  await click('[data-testid="material-V005"]');await wait(80);
  await check('strip ID click locates actual snapshot',async()=>String(await text('[data-testid="focus-info"]')).includes('V005'));
  await click('[data-testid="tab-steps"]');await wait(80);await click('[data-testid="locate-operation"]');await wait(80);
  await check('invisible operation switches to raw blank',()=>evaluate(`document.querySelector('[data-testid="stage-raw"]').getAttribute('aria-pressed')==='true'`));
  await click('[data-testid="next-operation"]');await wait(80);
  await check('operation sequence advances',async()=>String(await text('[data-testid="operation-detail"]')).includes('V002'));
  await click('[data-testid="case-oval"]');await wait(80);
  await check('case change expires previous results',()=>evaluate(`!!document.querySelector('[data-testid="stale-banner"]')&&document.querySelector('[data-testid="formal-export"]').disabled`));
  await click('[data-testid="run-check"]');await wait(1150);
  await check('oval inspection reads corrected snapshot',async()=>String(await text('[data-testid="result-state"]')).includes('结构消费通过'));
  await click('[data-testid="tab-warnings"]');await wait(80);
  await check('no warnings does not imply craft pass',()=>evaluate(`document.body.textContent.includes('这不代表没有工艺风险')`));
  await click('[data-testid="case-octagon"]');await wait(80);await click('[data-testid="run-check"]');await wait(1150);
  await check('octagon case consumes correctly',async()=>String(await text('[data-testid="result-state"]')).includes('结构消费通过'));
  await click('[data-testid="tab-warnings"]');await wait(80);await click('[data-testid="warning-OPEN_HALF_HOLE_AT_EDGE"]');await wait(80);
  await check('engineering warning locates snapshot data',async()=>String(await text('[data-testid="focus-info"]')).includes('V002'));
  await click('[data-testid="tab-reference"]');await wait(900);
  await check('B reference images load',()=>evaluate(`document.querySelectorAll('.reference-gallery img').length===3&&document.querySelector('.reference-gallery img').naturalWidth>0`));
  await click('[data-testid="tab-checks"]');await wait(80);await click('.tab-body details summary');await wait(80);await click('[data-testid="bump-generator"]');await wait(80);
  await check('generator-only change expires results',()=>evaluate(`!!document.querySelector('[data-testid="stale-banner"]')`));
  await click('[data-testid="case-round"]');await wait(50);await click('[data-testid="run-check"]');await wait(80);await click('[data-testid="case-oval"]');await wait(1100);
  await check('late result is rejected in browser',async()=>String(await text('[data-testid="notice"]')).includes('拒收'));
  await click('[data-testid="run-check"]');await wait(1150);
  writeFileSync(path.join(out,'invalid.json'),'{invalid');
  const dom=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});
  await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path.join(out,'invalid.json')]});await wait(200);
  await check('invalid JSON reports error without blanking current design',()=>evaluate(`!!document.querySelector('[role="alert"]')&&!!document.querySelector('.snapshot-svg')`));
  await click('[data-testid="case-round"]');await wait(50);await click('[data-testid="run-check"]');await wait(1150);
  const desktop=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'e-v03-desktop.png'),Buffer.from(desktop.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(300);
  await check('mobile has no page-level horizontal overflow',()=>evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(path.join(out,'e-v03-mobile.png'),Buffer.from(mobile.data,'base64'));
  await check('no browser runtime exceptions',async()=>errors.length===0);
  writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));
}catch(e){writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,errors,failure:String(e)},null,2));console.error(e);process.exitCode=1;}
finally{if(socket?.readyState===1)socket.close();browser.kill();}
