'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.OUT||'docs/easier-launch/browser');
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function startServer(){return new Promise(resolve=>{const server=http.createServer((req,res)=>{let name=decodeURIComponent(req.url.split('?')[0]).replace(/^\/moonbangoo_PinBall\//,'/');if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(data);});}).listen(0,'127.0.0.1',()=>resolve(server));});}

const assert=require('node:assert/strict');
async function pointer(page,touch){
 const cdp=touch?await page.context().newCDPSession(page):null;
 return {
  async down(p){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});else{await page.mouse.move(p.x,p.y);await page.mouse.down();}},
  async move(a,b,steps=20){if(cdp){for(let i=1;i<=steps;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}]});}else await page.mouse.move(b.x,b.y,{steps});},
  async up(){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();},
  async close(){if(cdp)await cdp.detach();}
 };
}
async function pour(page,touch){
 await page.waitForFunction(()=>CosmicPinball.app.handScene.canTilt);
 const a=await page.evaluate(()=>{const s=CosmicPinball.app.handScene,a=s.area(),r=s.rigAt(s.elapsed,a);return {x:a.x+(r.x+r.length*.38)*a.s,y:a.y+r.y*a.s,s:a.s};});
 const input=await pointer(page,touch);await input.down({x:a.x,y:a.y});await input.move(a,{x:a.x-a.s*.12,y:a.y+a.s*.35});await input.up();await input.close();
 await page.waitForFunction(()=>CosmicPinball.app.handScene.ready,null,{timeout:30000});
}
async function finish(page){await page.evaluate(()=>{const p=CosmicPinball.app.physics;while(!p.complete&&p.time<240){p.step();p.drainEvents();}});await page.waitForFunction(()=>document.querySelector('#results-dialog').open);return page.evaluate(()=>CosmicPinball.app.physics.finished.map(m=>[m.id,m.name,m.finishTime]));}
async function main(){
 const server=await startServer(),url=process.env.SITE_URL||'http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({channel:'chrome',headless:true});
 const report={at:new Date().toISOString(),url,browser:browser.version(),cases:[],errors:[],limitations:['Desktop Chrome and CDP touch emulation; physical touch and OS keyboard untested']};
 try{
  for(const [map,n,w,h,touch,reduced]of [['classic',6,1280,800,false,false],['twinfold',50,390,844,true,false],['cascade',1,844,390,true,false],['rhythm',25,1280,800,false,true],['classic',49,1920,1080,false,false]]){
   const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(url);await page.locator('#intro-start-button').click();await page.locator('[data-map='+map+']').click();
   await page.evaluate(({n,reduced})=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*'+n,sound:false,speed:3,reducedMotion:reduced});u.emit('change',u.readSettings());},{n,reduced});
   await page.locator('#name-red').fill('직접입력 '+map+'팀');await page.locator('[data-group-color][data-group=red]').selectOption('blue');
   await page.locator('#start-button').click();await pour(page,touch);
   const positions=await page.evaluate(()=>{const P=CosmicPinball,s=P.app.handScene,a=s.area(),m=P.EDGE_GEOMETRY.opening(P.EDGE_GEOMETRY.bounds(a));return {center:{x:a.x,y:a.y},target:{x:a.x+(m.x-.05*Math.SQRT1_2)*a.s,y:a.y+(m.y+.05*Math.SQRT1_2)*a.s}};});
   const input=await pointer(page,touch);
   // Tapping the highlighted area alone must not start a race.
   await input.down(positions.target);await input.up();assert.equal(await page.evaluate(()=>CosmicPinball.app.status),'mixing');
   // Picking up and dropping in the center is still ordinary shuffling.
   await input.down(positions.center);await input.move(positions.center,{x:positions.center.x+10,y:positions.center.y+5});await input.up();assert.equal(await page.evaluate(()=>CosmicPinball.app.status),'mixing');
   await input.down(positions.center);await input.move(positions.center,positions.target,24);
   await page.waitForFunction(()=>document.querySelector('#cinema-canvas').dataset.releaseReady==='true');
   const armed=await page.evaluate(()=>({status:CosmicPinball.app.status,decision:CosmicPinball.app.handScene.gate.evaluate(performance.now()),hint:document.querySelector('#cinema-canvas').dataset.throwHint}));
   assert.equal(armed.status,'mixing');assert.equal(armed.decision.eligible,false);assert.equal(armed.hint,'놓으면 발사!');
   await page.screenshot({path:path.join(out,map+'-'+n+'-armed.png')});
   await input.up();await input.close();await page.waitForFunction(()=>CosmicPinball.app.status==='running');
   const launched=await page.evaluate(()=>({method:CosmicPinball.app.handScene.launchDecision.method,names:CosmicPinball.app.physics.marbles.map(m=>m.name),colors:CosmicPinball.app.physics.marbles.map(m=>m.groupColor),version:CosmicPinball.app.physics.handStart.version}));
   assert.equal(launched.method,'release-zone');assert(launched.names.every(name=>name==='직접입력 '+map+'팀'));assert(launched.colors.every(color=>color==='blue'));assert.equal(launched.version,2);
   const first=await finish(page);assert.equal(first.length,n);assert((await page.locator('#result-ranking').textContent()).includes('직접입력 '+map+'팀'));
   await page.locator('#replay-button').click();await page.locator('#advanced-settings').evaluate(el=>el.open=true);await page.locator('#seed-previous').click();await page.locator('#start-button').click();await page.waitForFunction(()=>CosmicPinball.app.status==='running');assert.deepEqual(await finish(page),first);
   await page.reload();await page.locator('#intro-start-button').click();assert.equal(await page.locator('#name-red').inputValue(),'직접입력 '+map+'팀');
   report.cases.push({map,n,w,h,touch,reduced,releaseMethod:launched.method,armedInside:true,tapRejected:true,centerReleaseRejected:true,customNameAndColor:true,exactReplay:true,persisted:true});
   await context.close();
  }
  assert.deepEqual(report.errors,[]);
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
