'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const maps=['classic','twinfold','cascade','rhythm'],files=['js/maps.js','js/physics.js','js/hand-start.js',...maps.slice(1).map(m=>'js/maps/'+m+'.js')];
if(!isMainThread){
 const {capture,P}=require('../fairness/model.cjs');
 parentPort.on('message',task=>{
  const {count,config,ci,n,prefix}=task,groups=count<3?[count]:[Math.floor(count/3),Math.floor(count/3),count-2*Math.floor(count/3)],rows=[];
  for(const protocol of ['B','C','D'])for(let i=0;i<n;i++){
   const seed=prefix+'-'+ci+'-'+count+'-'+protocol+'-'+i,{p:base,start}=capture({map:'classic',groups,skills:false,...config},seed,protocol);
   for(const map of maps){const p=map==='classic'?base:new P.Physics({map:P.MAPS[map],names:base.marbles.map(m=>({id:m.id,name:m.name})),seed,...config});if(map!=='classic'){P.commitHandStart(p,start.source);if(JSON.stringify(p.handStart.starts)!==JSON.stringify(start.starts))throw Error('Different starts');}
    const hits=new Map(),roles={},errors={finite:0,bounds:0,forbidden:0};
    while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents()){if(e.obstacle&&['hit','bumper'].includes(e.type)){hits.set(e.id,(hits.get(e.id)||0)+1);const role=e.obstacle.role||e.obstacle.type;roles[role]=(roles[role]||0)+1;}if(map!=='classic'&&['rescue','skill','portal','boost'].includes(e.type))errors.forbidden++;}if(p.ticks%120===0)for(const m of p.marbles){if(![m.x,m.y,m.vx,m.vy].every(Number.isFinite))errors.finite++;if(m.x-m.r<36-1e-4||m.x+m.r>964+1e-4)errors.bounds++;}}
    rows.push({map,ci,count,protocol,seed,time:p.time,first:p.finished[0]?.finishTime,complete:p.complete,minHits:Math.min(...p.marbles.map(m=>hits.get(m.id)||0)),roles,errors,remaining:p.marbles.filter(m=>!m.finished).map(m=>({id:m.id,x:m.x,y:m.y}))});
   }
  }
  parentPort.postMessage({ci,count,rows});
 });
}else{
 const mode=process.argv[2]||'pace',prefix=process.argv[3]||'final-holdout-v2',n=+(process.env.AUDIT_SEEDS||10),configs=mode==='pace'?[{}]:[...function*(){for(const radius of [8,12,16])for(const gravity of [350,620,1500])for(const restitution of [.35,.72,.92])yield {radius,gravity,restitution};}()],counts=mode==='pace'?Array.from({length:50},(_,i)=>i+1):[1,2,6,25,49,50],tasks=[],rows=[],summary=[],started=new Date().toISOString();
 for(let ci=0;ci<configs.length;ci++)for(const count of counts)tasks.push({ci,count,config:configs[ci],n:mode==='pace'?n:1,prefix});
 const total=tasks.length,hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),hashes=Object.fromEntries(files.map(f=>[f,hash(f)])),quantile=(a,q)=>a.slice().sort((a,b)=>a-b)[Math.ceil(a.length*q)-1];let done=0;
 function finish(){for(const f of files)if(hash(f)!==hashes[f])throw Error('Source changed during audit: '+f);for(const count of counts){const a=rows.filter(r=>r.map==='classic'&&r.count===count);for(const map of maps.slice(1)){const b=rows.filter(r=>r.map===map&&r.count===count),median=quantile(b.map(r=>r.time),.5),p95=quantile(b.map(r=>r.time),.95),classicMedian=quantile(a.map(r=>r.time),.5),classicP95=quantile(a.map(r=>r.time),.95),medianRatio=median/classicMedian,p95Ratio=p95/classicP95;summary.push({map,count,n:b.length,median,p95,classicMedian,classicP95,medianRatio,p95Ratio,pass:medianRatio>=.9&&medianRatio<=1.1&&p95Ratio>=.9&&p95Ratio<=1.1});}}
  const runFailures=rows.filter(r=>!r.complete||r.minHits<1||Object.values(r.errors).some(Boolean)),failedCells=mode==='pace'?summary.filter(s=>!s.pass):[],report={started,at:new Date().toISOString(),mode,prefix,hashes,criteria:{duration:mode==='pace'?{median:[.9,1.1],p95:[.9,1.1]}:'not a gate for extreme settings',timeout:240,everyBallHits:true},configs,counts,cases:rows.length,runFailures,failedCells,summary,rows};fs.writeFileSync('docs/final-review/audit-'+mode+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({mode,cases:rows.length,runFailures,failedCells},null,2));if(runFailures.length||failedCells.length)process.exitCode=1;
 }
 for(let i=0;i<Math.min(6,total);i++){const w=new Worker(__filename);w.on('error',e=>{console.error(e);process.exit(1);});w.on('message',r=>{rows.push(...r.rows);done++;console.log(JSON.stringify({mode,done,total,ci:r.ci,count:r.count}));if(tasks.length)w.postMessage(tasks.shift());else w.terminate();if(done===total)finish();});w.postMessage(tasks.shift());}
}
