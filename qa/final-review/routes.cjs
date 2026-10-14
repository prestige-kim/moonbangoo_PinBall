'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{Worker,isMainThread,parentPort}=require('node:worker_threads');
const maps=['classic','twinfold','cascade','rhythm'];
if(!isMainThread){const {P}=require('../four-maps/helpers.cjs');parentPort.on('message',({map,radius,phase,y})=>{let minHits=Infinity,maxFirst=0;const failures=[];
 for(let x=36+radius;x<=964-radius;x++){
  const p=new P.Physics({map:P.MAPS[map],names:P.parseNames('공'),radius,seed:'route-sweep'});Object.assign(p.marbles[0],{x,y,vx:0,vy:0});p.time=phase;p.ticks=Math.round(phase*120);let hits=0;
  while(!p.complete&&p.time-phase<240&&!hits){p.step();for(const e of p.drainEvents())if(e.obstacle&&['hit','bumper'].includes(e.type))hits++;}
  minHits=Math.min(minHits,hits);maxFirst=Math.max(maxFirst,p.time-phase);if(!hits)failures.push({map,radius,phase,y,x,complete:p.complete,time:p.time-phase});
 }
 parentPort.postMessage({map,radius,phase,y,cases:929-2*radius,minHits,maxFirst,failures});});
}else{const jobs=[],rows=[];for(const map of maps)for(const radius of [8,12,16])for(let i=0;i<24;i++)jobs.push({map,radius,phase:i*.4,y:750-radius});const total=jobs.length;let done=0;const hashes=Object.fromEntries(['js/maps.js',...maps.slice(1).map(m=>'js/maps/'+m+'.js')].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
 for(let i=0;i<4;i++){const w=new Worker(__filename);w.on('error',e=>{console.error(e);process.exit(1);});w.on('message',r=>{rows.push(r);done++;if(done%12===0)console.log(JSON.stringify({done,total,map:r.map}));if(jobs.length)w.postMessage(jobs.shift());else w.terminate();if(done===total){const report={at:new Date().toISOString(),hashes,scope:'first solid contact, integer horizontal coordinates, spawn bottom, 24 phase samples, zero velocity; not full-course or continuous proof',cases:rows.reduce((a,b)=>a+b.cases,0),failures:rows.flatMap(r=>r.failures),rows};fs.writeFileSync('docs/final-review/routes.json',JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases,failures:report.failures}));if(report.failures.length)process.exitCode=1;}});w.postMessage(jobs.shift());}
}
