'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.OUT||'docs/easier-launch/replay-handoff');
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function startServer(){return new Promise(resolve=>{const server=http.createServer((req,res)=>{let name=decodeURIComponent(req.url.split('?')[0]).replace(/^\/moonbangoo_PinBall\//,'/');if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(data);});}).listen(0,'127.0.0.1',()=>resolve(server));});}


const assert=require('node:assert/strict'),{pour}=require('../four-maps/browser.cjs');
async function main(){
 const server=await startServer(),local='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({channel:'chrome',headless:true}),url=process.env.SITE_URL||'https://prestige-kim.github.io/moonbangoo_PinBall/';
 const report={at:new Date().toISOString(),url,browser:browser.version(),records:[]};
 try{
  if(process.env.VERIFY_RECORDS)report.records=JSON.parse(fs.readFileSync(process.env.VERIFY_RECORDS)).records;
  else for(const map of ['classic','twinfold','cascade','rhythm']){
   const c=await browser.newContext({viewport:{width:1280,height:800}}),p=await c.newPage();await p.goto(url);await p.locator('#intro-start-button').click();await p.locator('[data-map='+map+']').click();
   await p.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*17,초록*17,파랑*16',sound:false,speed:3});u.emit('change',u.readSettings());});
   await p.locator('#start-button').click();await pour(p);
   const record=await p.evaluate(()=>{const a=CosmicPinball.app,p=a.physics,settings=a.runSettings,record=p.handStart;while(!p.complete&&p.time<240){p.step();p.drainEvents();}return {settings,record,ranking:p.finished.map(m=>[m.id,m.finishTime])};});assert.equal(record.ranking.length,50);report.records.push({map,...record});await c.close();
  }
  const c=await browser.newContext(),p=await c.newPage();await p.goto(process.env.VERIFY_RECORDS?url:local);await p.waitForFunction(()=>window.CosmicPinball?.restoreHandStart);
  const results=await p.evaluate(records=>records.map(r=>{const P=CosmicPinball,s=r.settings,p=new P.Physics({...s,map:P.MAPS[r.map],names:P.parseNames(s.names)});P.restoreHandStart(p,r.record);while(!p.complete&&p.time<240){p.step();p.drainEvents();}return {map:r.map,ranking:p.finished.map(m=>[m.id,m.finishTime])};}),report.records);
  for(let i=0;i<results.length;i++)assert.deepEqual(results[i].ranking,report.records[i].ranking,results[i].map);
  report.exactAcrossSource=true;await c.close();
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
 console.log(JSON.stringify({url,exactAcrossSource:report.exactAcrossSource,maps:report.records.map(r=>r.map)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
