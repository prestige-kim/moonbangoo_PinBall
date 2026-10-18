'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/group-names/browser');
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

const assert=require('node:assert/strict');
async function main(){
 const server=await startServer(),base='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({channel:'chrome',headless:true});
 const report={at:new Date().toISOString(),checks:[],errors:[],limitations:['Chromium desktop and touch emulation; physical OS keyboards and touch displays untested']};
 try{
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
   const context=await browser.newContext({viewport,hasTouch:viewport.width<1000}),page=await context.newPage();
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base);await page.locator('#intro-start-button').click();
   const input=page.locator('#name-red');await input.fill('1반, A*팀');await input.evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));await page.keyboard.type('!');
   assert.equal(await input.inputValue(),'1반, A*팀!');assert.equal(await page.evaluate(()=>CosmicPinball.app.physics.marbles[0].name),'1반, A*팀!');
   // A composition update must retain the same DOM input and suppress form launch.
   await input.evaluate(el=>{window.__nameNode=el;el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='한글팀';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});
   assert(await input.evaluate(el=>el===window.__nameNode));
   assert.equal(await page.evaluate(()=>CosmicPinball.app.status),'setup');
   await input.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
   assert.equal(await page.evaluate(()=>CosmicPinball.app.physics.marbles[0].name),'한글팀');
   await input.press('Enter');assert.equal(await page.evaluate(()=>CosmicPinball.app.status),'setup');
   await input.fill('초록');assert.equal(await page.locator('#input-error').isVisible(),true);
   await page.locator('#start-button').click();assert.equal(await page.evaluate(()=>CosmicPinball.app.status),'setup');
   await input.fill('');await page.locator('#start-button').click();assert.equal(await page.evaluate(()=>CosmicPinball.app.status),'setup');
   await input.fill('선생님팀');await page.locator('[data-group-color][data-group=red]').selectOption('blue');
   assert.equal(await page.evaluate(()=>{const P=CosmicPinball;P.Pinball.configureGroups(P.app.physics.marbles);return P.Pinball.group('선생님팀').color;}),'#7e96b6');
   await page.locator('#add-group').click();assert.equal(await page.locator('[data-group-name]').count(),4);
   const added=page.locator('[data-group-name]').last();await added.fill('추가팀');await added.press('Tab');
   await page.reload();await page.locator('#intro-start-button').click();assert.equal(await page.locator('#name-red').inputValue(),'선생님팀');assert.equal(await page.locator('[data-group-name]').last().inputValue(),'추가팀');
   await page.locator('[data-remove-group]').last().click();assert.equal(await page.locator('[data-group-name]').count(),3);
   await page.locator('#quantity-red').selectOption('46');assert.equal(await page.locator('#participant-count').textContent(),'50');assert(await page.locator('#add-group').isDisabled());
   await page.locator('#quantity-red').selectOption('2');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(out,'setup-'+viewport.width+'.png')});
   if(viewport.width===390){
    await page.setViewportSize({width:390,height:300});await page.locator('#name-red').focus();
    const visible=await page.locator('#name-red').evaluate(el=>{const r=el.getBoundingClientRect(),f=document.querySelector('#start-button').getBoundingClientRect();return {top:r.top,bottom:r.bottom,footer:f.bottom,height:visualViewport.height};});
    assert(visible.top>=0&&visible.bottom<=visible.height&&visible.footer<=visible.height,JSON.stringify(visible));
    report.checks.push('Reduced 300px viewport leaves focused name and start button visible');
    await page.setViewportSize(viewport);
   }
   if(viewport.width===1280){
    await page.locator('#start-button').click();await pourAndLaunch(page);await finishFast(page);
    const first=await page.evaluate(()=>CosmicPinball.app.physics.finished.map(m=>[m.id,m.name,m.finishTime]));
    assert((await page.locator('#result-ranking').textContent()).includes('선생님팀'));
    await page.locator('#replay-button').click();await page.locator('#advanced-settings').evaluate(el=>el.open=true);await page.locator('#seed-previous').click();
    assert.equal(await page.locator('#name-red').inputValue(),'선생님팀');
    await page.locator('#start-button').click();await page.waitForFunction(()=>CosmicPinball.app.status==='running');await finishFast(page);
    assert.deepEqual(await page.evaluate(()=>CosmicPinball.app.physics.finished.map(m=>[m.id,m.name,m.finishTime])),first);
    report.checks.push('Custom labels and colors survive real pour/shuffle/launch, results and exact replay');
   }
   report.checks.push('Typing, IME, Enter, validation, colors, add/remove, save/reload, 50-ball cap and layout '+viewport.width+'x'+viewport.height);
   await context.close();
  }

  for(const [label,names,expected] of [
   ['legacy names','기존반*3,교사*2',5],
   ['50 named groups',JSON.stringify({groupVersion:1,groups:Array.from({length:50},(_,i)=>({id:'custom-'+i,name:('가'.repeat(35))+String(i),color:'blue',count:1}))}),50],
   ['corrupt saved group',JSON.stringify({groupVersion:1,groups:[{id:'red',name:'',color:'red',count:2}]}),6]
  ]){
   const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
   await p.addInitScript(names=>localStorage.setItem('mungbanggu-pinball-settings-v2',JSON.stringify({names})),names);await p.goto(base);await p.locator('#intro-start-button').click();
   assert.equal(await p.locator('#participant-count').textContent(),String(expected));
   if(expected===50){assert.equal(await p.locator('[data-group-name]').count(),50);assert(await p.locator('#add-group').isDisabled());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   if(label==='legacy names'){
    assert.equal(await p.locator('[data-group-name]').first().inputValue(),'기존반');
    await p.locator('[data-group-name]').first().fill('');await p.locator('#advanced-settings').evaluate(el=>el.open=true);await p.locator('#sound').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
    await p.reload();await p.locator('#intro-start-button').click();assert.equal(await p.locator('[data-group-name]').first().inputValue(),'기존반');
   }
   report.checks.push(label+' load, validation and preservation');await c.close();
  }
  assert.deepEqual(report.errors,[]);
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
