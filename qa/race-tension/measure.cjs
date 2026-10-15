'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const sourceFiles=['js/maps.js','js/map-registry.js','js/maps/twinfold.js','js/maps/cascade.js','js/maps/rhythm.js','js/physics.js','js/hand-start.js','js/shuffle.js','js/hand-scene.js','js/throw-gate.js'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function simulate(P,p,meta){
 const hits=new Map(),checkpoints={},changes=[],trace=[],errors={finite:0,bounds:0,forbidden:0};let stable=null,candidate=null,since=0,peak=0;const thresholds=[.25,.5,.75],span=p.map.finish.y-p.map.spawn.y;
 while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents()){if(e.obstacle&&['hit','bumper'].includes(e.type))hits.set(e.id,(hits.get(e.id)||0)+1);if(['rescue','skill','portal','boost'].includes(e.type))errors.forbidden++;}
  if(p.ticks%12===0){for(const m of p.marbles){if(![m.x,m.y,m.vx,m.vy].every(Number.isFinite))errors.finite++;if(m.x-m.r<p.bounds.left-1e-4||m.x+m.r>p.bounds.right+1e-4)errors.bounds++;}
   if(p.finished.length)continue;const ranking=p.getRanking(),lead=ranking[0],second=ranking[1],progress=Math.max(0,Math.min(1,(lead.y-p.map.spawn.y)/span));peak=Math.max(peak,progress);
   const id=second&&Math.abs(lead.y-second.y)<=1e-7?null:lead.id;
   if(peak>=.1){if(id!==candidate){candidate=id;since=p.time;}if(id!==null&&id!==stable&&p.time-since>=.45){if(stable!==null)changes.push({time:p.time,progress:peak,from:stable,to:id,y:lead.y,gap:lead.y-second.y});stable=id;}}
   for(const q of thresholds)if(!checkpoints[q]&&progress>=q)checkpoints[q]={time:p.time,leader:id,top3:ranking.slice(0,3).map(m=>m.id),gap:lead.y-second.y};
   if(p.ticks%60===0)trace.push({time:p.time,progress:peak,leader:id,stable,top3:ranking.slice(0,3).map(m=>m.id),gap:lead.y-second.y});
  }
 }
 const winner=p.finished[0]?.id,first=p.finished[0]?.finishTime;
 return {...meta,complete:p.complete,time:p.time,first,winner,minHits:Math.min(...p.marbles.map(m=>hits.get(m.id)||0)),errors,checkpoints,changes,trace,ranking:p.finished.map(m=>[m.id,m.finishTime]),remaining:p.marbles.filter(m=>!m.finished).map(m=>({id:m.id,x:m.x,y:m.y}))};
}
if(!isMainThread){const {P,capture}=require('../fairness/model.cjs');new Function('window',fs.readFileSync('qa/race-tension/baseline-twinfold.js','utf8'))({CosmicPinball:P});if(workerData.plugin)require(path.resolve(workerData.plugin))(P);
 parentPort.on('message',t=>{const groups=[Math.floor(t.count/3),Math.floor(t.count/3),t.count-2*Math.floor(t.count/3)],seed='final-holdout-v2-0-'+t.count+'-'+t.protocol+'-'+t.index,{p:base,start}=capture({map:'classic',groups,skills:false},seed,t.protocol),rows=[];
 for(const id of workerData.maps){const p=new P.Physics({map:P.MAPS[id],names:base.marbles.map(m=>({id:m.id,name:m.name})),seed,radius:12,gravity:620,restitution:.72,skills:false});P.commitHandStart(p,start.source);assert.deepEqual(p.handStart.starts,start.starts);const before=Date.now(),r=simulate(P,p,{map:id,count:t.count,seed,protocol:t.protocol,index:t.index,version:p.map.version,start:p.handStart});r.cpuMs=Date.now()-before;rows.push(r);}parentPort.postMessage(rows);});
}else{
 const count=+(process.env.SEEDS||6),maps=(process.env.MAPS||'classic,twinfold,cascade,rhythm').split(','),counts=(process.env.COUNTS||'6,25,50').split(',').map(Number),output=process.env.OUT||'docs/race-tension/baseline.json',plugin=process.env.PLUGIN||null,files=sourceFiles.concat(['qa/race-tension/measure.cjs'],plugin?[plugin]:[]),hashes=Object.fromEntries(files.map(f=>[f,hash(f)])),tasks=[];for(const n of counts)for(const protocol of ['B','C','D'])for(let i=0;i<count;i++)tasks.push({count:n,protocol,index:i});
 const total=tasks.length,rows=[],started=Date.now();let done=0;
 for(let i=0;i<Math.min(3,total);i++){const w=new Worker(__filename,{workerData:{maps,plugin}});w.on('error',e=>{console.error(e);process.exit(1);});w.on('message',r=>{rows.push(...r);done++;console.log(JSON.stringify({done,total,cases:rows.length,elapsedMs:Date.now()-started}));if(tasks.length)w.postMessage(tasks.shift());else w.terminate();if(done===total){for(const f of files)assert.equal(hash(f),hashes[f],'Source changed during measurement '+f);rows.sort((a,b)=>a.map.localeCompare(b.map)||a.count-b.count||a.protocol.localeCompare(b.protocol)||a.index-b.index);const result={at:new Date().toISOString(),elapsedMs:Date.now()-started,hashes,plugin,maps,counts,seedsPerProtocol:count,settings:{radius:12,gravity:620,restitution:.72,skills:false},criteria:{rankSampleHz:10,stableLeaderSeconds:.45,rankCountStartsAtProgress:.1,checkpointProgress:thresholdsDescription(),timeout:240},rows};fs.writeFileSync(output,JSON.stringify(result,null,2));console.log('DONE '+rows.length+' '+result.elapsedMs+'ms');}});w.postMessage(tasks.shift());}
}
function thresholdsDescription(){return [.25,.5,.75];}
module.exports={simulate};
