'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{quantile}=require('../sim/stats.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../..'),server=http.createServer((q,s)=>{const name=q.url.split('?')[0].replace(/^\/moonbangoo_PinBall\//,'/'),file=path.join(root,name==='/'?'index.html':name);fs.readFile(file,(e,d)=>{if(e){s.writeHead(404).end();return;}s.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');s.end(d);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1280,height:720}}),p=await context.newPage(),cdp=await context.newCDPSession(p),report={at:new Date().toISOString(),browser:browser.version(),conditions:'Desktop headless Chrome; concurrent Node simulation CPU load; 500 balls, default physics, speed 3, high quality with auto fallback; real rAF, no accelerated stepping',rounds:[],console:[],networkErrors:[],quality:[]};
 p.on('pageerror',e=>report.console.push(e.message));p.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push(m.text());});p.on('requestfailed',r=>report.networkErrors.push({url:r.url(),error:r.failure()}));p.on('response',r=>{if(r.status()>=400)report.networkErrors.push({url:r.url(),status:r.status()});});
 await p.addInitScript(()=>{
  window.__qa={listeners:0,rafPending:0,maxRaf:0,contexts:0,frames:[],last:0};const q=window.__qa;
  const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(...args){q.listeners++;return add.apply(this,args);};
  const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),pending=new Set();
  window.requestAnimationFrame=cb=>{const id=raf(t=>{pending.delete(id);q.rafPending=pending.size;if(t!==q.last){if(q.last)q.frames.push({dt:t-q.last,scene:document.body.dataset.scene});q.last=t;}cb(t);});pending.add(id);q.rafPending=pending.size;q.maxRaf=Math.max(q.maxRaf,q.rafPending);return id;};
  window.cancelAnimationFrame=id=>{pending.delete(id);q.rafPending=pending.size;cancel(id);};
  const Audio=window.AudioContext;window.AudioContext=class extends Audio{constructor(...args){super(...args);q.contexts++;}};
 });
 try{
  await p.goto('http://127.0.0.1:'+server.address().port+'/moonbangoo_PinBall/');await p.locator('#intro-start-button').click();
  // Setup through the public UI adapter; actual browser mouse launches every round.
  await p.evaluate(()=>{const a=CosmicPinball.app;a.ui.load({...a.settings,names:'빨강*500',speed:3,seed:'',quality:'high'});a.ui.emit('change');});
  for(let i=0;i<10;i++){
   const started=Date.now();if(i===0)await p.locator('#start-button').click();else await p.locator('#restart-button').click();
   await p.waitForFunction(()=>CosmicPinball.app.handScene.canTilt,{},{timeout:30000});await require('../fairness/browser.cjs').launch(p,'mouse');await p.waitForFunction(()=>document.querySelector('dialog').open,{},{timeout:240000});
   await p.locator('#show-all-results').click();
   const round=await p.evaluate(()=>{const a=CosmicPinball.app,p=a.physics,q=window.__qa,f=q.frames.splice(0);return {time:p.time,seed:a.runSettings.seed,count:p.finished.length,unique:new Set(p.finished.map(m=>m.id)).size,shown:document.querySelectorAll('#result-ranking>li').length,quality:a.settings.quality,listeners:q.listeners,contexts:q.contexts,rafPending:q.rafPending,maxRaf:q.maxRaf,canvasInDOM:document.querySelectorAll('canvas').length,caches:{sprites:a.renderer.sprites.size,spriteKeys:Array.from(a.renderer.sprites.keys()),names:a.renderer.nameSprites.size,labels:a.cinematic.labels.size},voices:a.audio.voices,frames:f};});
   const frames=round.frames;delete round.frames;round.frameTime={};for(const scene of ['mixing','flight','running']){const values=frames.filter(f=>f.scene===scene).map(f=>f.dt);round.frameTime[scene]={samples:values.length,p50:quantile(values,.5),p95:quantile(values,.95),max:Math.max(...values)};}round.wallSeconds=(Date.now()-started)/1000;
   await cdp.send('HeapProfiler.collectGarbage');round.heap=await cdp.send('Runtime.getHeapUsage');report.rounds.push(round);assert.equal(round.count,500);assert.equal(round.unique,500);assert.equal(round.shown,500);fs.writeFileSync('qa/results/lifecycle.json',JSON.stringify(report,null,2));console.log('browser 500 round',i+1,'wall',round.wallSeconds,'quality',round.quality,'heap',round.heap.usedSize);
  }
 }finally{fs.writeFileSync('qa/results/lifecycle.json',JSON.stringify(report,null,2));await context.close();await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
