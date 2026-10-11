'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,process.argv.find(a=>a.startsWith('--out-dir='))?.slice(10)||'qa/results');
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function startServer(){return new Promise(resolve=>{const server=http.createServer((req,res)=>{let name=decodeURIComponent(req.url.split('?')[0]).replace(/^\/moonbangoo_PinBall\//,'/');if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(data);});}).listen(0,'127.0.0.1',()=>resolve(server));});}
async function pourAndLaunch(page){
  await page.waitForFunction(()=>CosmicPinball.app.handScene.canTilt);
  const tilt=await page.evaluate(()=>{const s=CosmicPinball.app.handScene,a=s.area(),r=s.rigAt(s.elapsed,a);return {x:a.x+(r.x+r.length*.38)*a.s,y:a.y+r.y*a.s,s:a.s};});
  await page.mouse.move(tilt.x,tilt.y);await page.mouse.down();await page.mouse.move(tilt.x-tilt.s*.12,tilt.y+tilt.s*.35,{steps:20});await page.mouse.up();
  await page.waitForFunction(()=>CosmicPinball.app.handScene.ready,{},{timeout:30000});
  const drag=await page.evaluate(()=>{const P=CosmicPinball,s=P.app.handScene,a=s.area(),b=s.shuffle.bodies[Math.floor(s.shuffle.bodies.length/2)],o=P.EDGE_GEOMETRY.opening(P.EDGE_GEOMETRY.bounds(a));return {x:a.x+b.x*s.viewScale*a.s,y:a.y+b.y*s.viewScale*a.s,ex:a.x+o.x*a.s,ey:a.y+o.y*a.s};});
  await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move((drag.x+drag.ex)/2,(drag.y+drag.ey)/2,{steps:12});await page.mouse.move(drag.ex+30,drag.ey-30,{steps:20});await page.mouse.up();
  await page.waitForFunction(()=>['flight','running'].includes(CosmicPinball.app.status),{},{timeout:10000});
  await page.waitForFunction(()=>CosmicPinball.app.status==='running',{},{timeout:10000});
}
async function finishFast(page){await page.evaluate(()=>{const p=CosmicPinball.app.physics;while(!p.complete&&p.time<240){p.step();p.drainEvents();}});await page.waitForFunction(()=>document.querySelector('#results-dialog').open,{},{timeout:10000});}
async function main(){
 const baseline=process.argv.includes('--baseline'),server=await startServer(),base='http://127.0.0.1:'+server.address().port+'/moonbangoo_PinBall/',browser=await chromium.launch({channel:'chrome',headless:true});
 const report={at:new Date().toISOString(),browser:browser.version(),baseline,loads:[],viewports:[],flow:{},storage:[],limitations:['Desktop Chromium emulation only; no physical mobile device','Native OS minimize/restore and tab throttling are not emulated by changing document.hidden']};
 try{
  for(const url of process.argv.includes('--local-only')?[base]:[base,'https://prestige-kim.github.io/moonbangoo_PinBall/']){
   const context=await browser.newContext(),page=await context.newPage(),record={url,console:[],failed:[],httpErrors:[],resources:[]};
   page.on('console',msg=>{if(['error','warning'].includes(msg.type()))record.console.push({type:msg.type(),text:msg.text()});});page.on('pageerror',e=>record.console.push({type:'exception',text:e.message}));page.on('requestfailed',req=>record.failed.push({url:req.url(),error:req.failure()}));
   const cdp=await context.newCDPSession(page);await cdp.send('Log.enable');cdp.on('Log.entryAdded',({entry})=>{if(entry.level==='error')record.console.push({type:'cdp',text:entry.text,url:entry.url});});
   page.on('response',async res=>{if(res.status()>=400)record.httpErrors.push({url:res.url(),status:res.status()});if(/\.(js|css|html)(\?|$)/.test(res.url())||res.url()===url){try{record.resources.push({url:res.url(),status:res.status(),sha256:hash(await res.body()),cache:res.headers()['cache-control']});}catch(e){record.failed.push({url:res.url(),error:e.message});}}});
   try{const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});record.status=response.status();record.title=await page.title();await page.locator('#intro-start-button').click();await page.locator('#start-button').click();await pourAndLaunch(page);record.started=await page.evaluate(()=>({status:CosmicPinball.app.status,count:CosmicPinball.app.physics.marbles.length,seed:CosmicPinball.app.runSettings.seed}));await finishFast(page);record.results=await page.evaluate(()=>({heading:document.querySelector('#winner-heading').textContent,count:CosmicPinball.app.ui.resultData.ranking.length}));}catch(e){record.error=e.message;}
   report.loads.push(record);await context.close();fs.writeFileSync(path.join(out,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(report,null,2));
  }
  const context=await browser.newContext(),page=await context.newPage();await page.goto(base);await page.locator('#intro-start-button').click();await page.locator('#start-button').click();await pourAndLaunch(page);
  report.flow.firstStart=await page.evaluate(()=>({seed:CosmicPinball.app.runSettings.seed,handStart:CosmicPinball.app.physics.handStart,config:CosmicPinball.app.runSettings}));
  await page.mouse.wheel(0,-100);await page.keyboard.press('f');report.flow.camera=await page.evaluate(()=>({follow:CosmicPinball.app.camera.follow,zoom:CosmicPinball.app.camera.zoom}));await finishFast(page);
  report.flow.firstRanking=await page.evaluate(()=>CosmicPinball.app.physics.finished.map(m=>[m.id,m.finishTime]));
  await page.locator('#replay-button').click();await page.locator('#advanced-settings').evaluate(e=>e.open=true);await page.locator('#seed-previous').click();report.flow.restoredConfig=await page.evaluate(()=>CosmicPinball.app.ui.readSettings());await page.locator('#start-button').click();
  report.flow.replayStatus=await page.evaluate(()=>CosmicPinball.app.status);
  if(report.flow.replayStatus==='mixing')await pourAndLaunch(page);else await page.waitForFunction(()=>CosmicPinball.app.status==='running');
  report.flow.replayStart=await page.evaluate(()=>CosmicPinball.app.physics.handStart);await finishFast(page);report.flow.replayRanking=await page.evaluate(()=>CosmicPinball.app.physics.finished.map(m=>[m.id,m.finishTime]));report.flow.exactReplay=JSON.stringify(report.flow.firstRanking)===JSON.stringify(report.flow.replayRanking);
  await page.keyboard.press('Tab');report.flow.modalFocus=await page.evaluate(()=>document.activeElement.closest('dialog')?.id);await page.keyboard.press('Escape');report.flow.escapeClosed=await page.locator('#results-dialog').evaluate(e=>!e.open);await page.reload();report.flow.refresh=await page.evaluate(()=>CosmicPinball.app.status);await context.close();
  for(const [w,h]of [[360,640],[390,844],[768,1024],[1280,720],[1920,1080]])for(const dpr of [1,2,3]){
   const c=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr}),p=await c.newPage();await p.goto(base);await p.locator('#intro-start-button').click();await p.locator('#advanced-settings').evaluate(e=>e.open=true);
   await p.waitForTimeout(700);const metric=await p.evaluate(()=>{const r=id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};return {overflowX:document.documentElement.scrollWidth>innerWidth,bodyH:document.body.scrollHeight,setup:r('setup-panel'),start:r('start-button'),canvas:{width:document.getElementById('game-canvas').width,height:document.getElementById('game-canvas').height},touchAction:getComputedStyle(document.getElementById('cinema-canvas')).touchAction};});
   report.viewports.push({w,h,dpr,...metric});if(dpr===1)await p.screenshot({path:path.join(out,`setup-${w}.png`)});await c.close();
  }
  for(const value of ['{broken','null','[]','{"names":"<img src=x onerror=window.__xss=1>","seed":"evil"}','{"names":"빨강*500","radius":null,"gravity":"bad"}']){
   const c=await browser.newContext(),p=await c.newPage();await p.addInitScript(v=>{localStorage.setItem('mungbanggu-pinball-settings-v2',v);localStorage.setItem('mungbanggu-pinball-last-round',v);},value);let error=null;p.on('pageerror',e=>error=e.message);await p.goto(base);await sleep(150);report.storage.push({value,error,status:await p.evaluate(()=>CosmicPinball.app?.status),xss:await p.evaluate(()=>window.__xss||0)});await c.close();
  }
 }finally{fs.writeFileSync(path.join(out,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
 console.log(JSON.stringify({exactReplay:report.flow.exactReplay,loads:report.loads.map(x=>({url:x.url,status:x.status,error:x.error,console:x.console,failed:x.failed})),storage:report.storage,viewports:report.viewports.length},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
