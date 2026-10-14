'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'qa/four-maps/results/'+(process.env.MAP_ONLY?'personality-'+process.env.MAP_ONLY+'-browser':'max50-browser'));fs.mkdirSync(out,{recursive:true});
async function pour(page,touch=false){
 await page.waitForFunction(()=>CosmicPinball.app.handScene.canTilt);
 const t=await page.evaluate(()=>{const s=CosmicPinball.app.handScene,a=s.area(),r=s.rigAt(s.elapsed,a);return {x:a.x+(r.x+r.length*.38)*a.s,y:a.y+r.y*a.s,s:a.s};});
 if(touch){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:t.x,y:t.y}]});for(let i=1;i<=20;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:t.x-t.s*.12*i/20,y:t.y+t.s*.35*i/20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else{await page.mouse.move(t.x,t.y);await page.mouse.down();await page.mouse.move(t.x-t.s*.12,t.y+t.s*.35,{steps:20});await page.mouse.up();}
 await page.waitForFunction(()=>CosmicPinball.app.handScene.ready,{},{timeout:30000});
 if(!touch){
  const a=await page.evaluate(()=>CosmicPinball.app.handScene.area());await page.mouse.move(a.x,a.y);await page.mouse.down();
  for(let i=1;i<=45;i++){await page.mouse.move(a.x+Math.cos(i*.25)*a.s*.10,a.y+Math.sin(i*.25)*a.s*.10);await page.waitForTimeout(9);}
  const circle=await page.evaluate(()=>{const s=CosmicPinball.app.handScene.shuffle;return {enabled:s.circleGrabEnabled,grab:!!s.grab,contained:s.bodies.every(b=>Math.hypot(b.x-s.grab.x,b.y-s.grab.y)+b.r<=s.pointerRadius+1e-7),wallHits:s.wallHits,count:s.bodies.length,map:CosmicPinball.app.settings.map};});
  assert(circle.enabled&&circle.grab&&circle.contained);assert(circle.wallHits>0);await page.screenshot({path:path.join(out,circle.map+'-circle-'+circle.count+'.png')});await page.mouse.up();
 }

 const d=await page.evaluate(()=>{const P=CosmicPinball,s=P.app.handScene,a=s.area(),b=s.shuffle.bodies[Math.floor(s.shuffle.bodies.length/2)],o=P.EDGE_GEOMETRY.opening(P.EDGE_GEOMETRY.bounds(a));return {x:a.x+b.x*s.viewScale*a.s,y:a.y+b.y*s.viewScale*a.s,ex:a.x+o.x*a.s+30,ey:a.y+o.y*a.s-30};});
 if(touch){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:d.x,y:d.y}]});for(let i=1;i<=32;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:d.x+(d.ex-d.x)*i/32,y:d.y+(d.ey-d.y)*i/32}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else{await page.mouse.move(d.x,d.y);await page.mouse.down();await page.mouse.move(d.ex,d.ey,{steps:32});await page.mouse.up();}
 await page.waitForFunction(()=>CosmicPinball.app.status==='running',{},{timeout:15000});
}
async function musicState(page,track){
 await page.waitForFunction(expected=>{const a=CosmicPinball.app.audio;return a.musicTrack===expected&&a.music&&!a.music.paused&&a.music.readyState>=2&&a.music.currentTime>.05;},track,{timeout:10000});
 return page.evaluate(()=>{const a=CosmicPinball.app.audio;return {scene:a.musicScene,track:a.musicTrack,readyState:a.music.readyState,time:a.music.currentTime,paused:a.music.paused,error:a.music.error?.code||null,context:a.context?.state,decks:[...a.musicDecks.values()].map(d=>({track:d.track,level:d.level,paused:d.media.paused}))};});
}
async function main(){
 const server=http.createServer((q,s)=>{const f=path.resolve(root,'.'+q.url.split('?')[0].replace(/\/$/,'/index.html'));if(!f.startsWith(root+path.sep))return s.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return s.writeHead(404).end();s.setHeader('Cache-Control','no-store');s.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');s.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true}),url='http://127.0.0.1:'+server.address().port+'/',report={browser:browser.version(),maps:[],layouts:[],errors:[],limitations:['Chromium desktop and touch emulation; no physical handset tested','Screenshot and FPS checks use this local machine only']};
 try{
  for(const map of ['classic','twinfold','cascade','rhythm'].filter(id=>!process.env.MAP_ONLY||id===process.env.MAP_ONLY)){
   const context=await browser.newContext({viewport:{width:1280,height:720}});if(map==='classic')await context.addInitScript(()=>{if(localStorage.getItem('max50-migration-tested'))return;localStorage.setItem('max50-migration-tested','true');localStorage.setItem('mungbanggu-pinball-settings-v2',JSON.stringify({map:'classic',names:'빨강*500',seed:'old-large',sound:true}));localStorage.setItem('mungbanggu-pinball-last-round',JSON.stringify({map:'classic',names:'빨강*500',seed:'old-large',replayStart:{version:2}}));});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await page.locator('#intro-start-button').click();await page.locator('[data-map="'+map+'"]').click();
   assert.equal(await page.locator('[data-map="'+map+'"]').getAttribute('aria-pressed'),'true');if(map==='classic'){assert.equal(await page.locator('#participant-count').textContent(),'6');assert((await page.locator('#names-help').textContent()).includes('기본 6개'));assert.equal(await page.locator('#seed').inputValue(),'');assert.equal(await page.locator('#seed-previous').isDisabled(),true);}
   if(map==='classic'){await page.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),skills:true,classicSkills:true,seed:''});u.emit('change',u.readSettings());});await page.locator('[data-map="classic"]').click();await page.locator('[data-map="twinfold"]').click();await page.reload();await page.locator('#intro-start-button').click();await page.locator('[data-map="classic"]').click();assert.equal(await page.locator('#skills').isChecked(),true);await page.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),skills:false,classicSkills:false});u.emit('change',u.readSettings());});}
   await page.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*17,초록*17,파랑*16',speed:3,sound:true,volume:.35});u.emit('change',u.readSettings());});
   const music={setup:await musicState(page,'chipper-doodle-v2')};
   await page.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),sound:false});u.emit('change',u.readSettings());});assert(await page.evaluate(()=>[...CosmicPinball.app.audio.musicDecks.values()].every(d=>d.media.paused)));await page.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),sound:true});u.emit('change',u.readSettings());});await musicState(page,'chipper-doodle-v2');music.muteResume=true;
   assert.equal(await page.locator('#participant-count').textContent(),'50');assert((await page.locator('#names-help').textContent()).includes('최대 50개'));assert.equal(await page.locator('[data-quantity="1"]:enabled').count(),0);await page.evaluate(()=>{const select=document.getElementById('quantity-red');select.add(new Option('51','51'));select.value='51';select.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await page.locator('#participant-count').textContent(),'50');assert.equal(await page.locator('#quantity-red option[value="51"]').count(),0);
   if(map!=='classic')assert.equal(await page.locator('#skills').isDisabled(),true);
   await page.locator('#start-button').click();music.mixing=await musicState(page,'electrodoodle');await pour(page);music.running=await musicState(page,'bit-quest');assert.equal(await page.locator('[data-map="'+map+'"]').isDisabled(),true);
   const start=await page.evaluate(()=>({settings:CosmicPinball.app.runSettings,record:CosmicPinball.app.physics.handStart}));
   await page.waitForFunction(()=>CosmicPinball.app.physics.time>3);await page.screenshot({path:path.join(out,map+'-play.png')});
   await page.waitForFunction(()=>document.querySelector('#results-dialog').open,{},{timeout:120000});
   music.result=await musicState(page,'winner-winner');
   const first=await page.evaluate(()=>({ranking:CosmicPinball.app.physics.finished.map(m=>[m.id,m.finishTime]),time:CosmicPinball.app.physics.time,map:document.getElementById('result-map').textContent,events:CosmicPinball.app.diagnostics.events}));assert.equal(first.ranking.length,50);assert.equal(first.map,start.settings.map==='classic'?'자개 핀 보드':start.settings.map==='twinfold'?'갈래 서가':start.settings.map==='cascade'?'빗살 낙하':'박자 분배기');
   await page.screenshot({path:path.join(out,map+'-result.png')});await page.locator('#replay-button').click();await page.locator('#advanced-settings').evaluate(e=>e.open=true);await page.locator('#seed-previous').click();const replaySeed=await page.locator('#seed').inputValue();await page.locator('[data-map="'+map+'"]').click();assert.equal(await page.locator('#seed').inputValue(),replaySeed);assert(replaySeed);
   assert.equal(await page.locator('[data-map="'+map+'"]').getAttribute('aria-pressed'),'true');
   await page.locator('#start-button').click();await page.waitForFunction(()=>CosmicPinball.app.status==='running');
   await page.evaluate(()=>{const p=CosmicPinball.app.physics;while(!p.complete&&p.time<240){p.step();p.drainEvents();}});await page.waitForFunction(()=>document.querySelector('#results-dialog').open,{},{timeout:10000});const replay=await page.evaluate(()=>CosmicPinball.app.physics.finished.map(m=>[m.id,m.finishTime]));assert.deepEqual(replay,first.ranking);
   await page.locator('#restart-button').click();assert.equal(await page.evaluate(()=>CosmicPinball.app.runSettings.map),map);await page.reload();assert.equal(await page.evaluate(()=>CosmicPinball.app.settings.map),map);
   // Selecting a different map must leave replay mode and cannot carry its start.
   await page.locator('#intro-start-button').click();const other=map==='classic'?'twinfold':'classic';await page.locator('[data-map="'+other+'"]').click();assert.equal(await page.evaluate(()=>CosmicPinball.app.ui.readSettings().replayStart),null);
   report.maps.push({map,start,first,music,exactReplay:true,persisted:true,restart:true});await context.close();
  }
  if(!process.env.MAP_ONLY)for(const [width,height]of [[360,640],[390,844],[768,1024],[1280,720],[1920,1080]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:width<850,hasTouch:width<850}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await page.locator('#intro-start-button').click();await page.locator('[data-map="rhythm"]').click();await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('setup-panel')).opacity)>.999);await page.screenshot({path:path.join(out,'setup-'+width+'.png')});
   const bounds=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,cards:[...document.querySelectorAll('[data-map]')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})}));assert.equal(bounds.overflow,false);assert.equal(bounds.cards.length,4);
   await page.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*17,초록*17,파랑*16',speed:3,sound:false});u.emit('change',u.readSettings());});await page.locator('#start-button').click();await pour(page,width<850);await page.waitForFunction(()=>CosmicPinball.app.physics.time>3);await page.screenshot({path:path.join(out,'rhythm-'+width+'-play.png')});report.layouts.push({width,height,input:width<850?'emulated touch':'mouse',...bounds});await context.close();
  }
  for(const map of ['classic','twinfold','cascade','rhythm'].filter(id=>!process.env.MAP_ONLY||id===process.env.MAP_ONLY))for(const count of [50]){
   const c=await browser.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();await p.goto(url);await p.locator('#intro-start-button').click();await p.locator('[data-map="'+map+'"]').click();await p.evaluate(n=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*'+n,speed:1,sound:false});u.emit('change',u.readSettings());},count);await p.locator('#start-button').click();await pour(p);await p.waitForFunction(()=>CosmicPinball.app.physics.time>=6);const performance=await p.evaluate(()=>({fps:Number(document.getElementById('fps').textContent),quality:CosmicPinball.app.settings.quality,time:CosmicPinball.app.physics.time}));(report.performance||(report.performance=[])).push({map,count,...performance});await c.close();
  }
  assert.equal(report.errors.length,0);
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
 console.log(JSON.stringify({maps:report.maps.map(r=>({map:r.map,time:r.first.time,exactReplay:r.exactReplay})),layouts:report.layouts.map(r=>({width:r.width,input:r.input})),performance:report.performance,errors:report.errors},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
else module.exports={pour};
