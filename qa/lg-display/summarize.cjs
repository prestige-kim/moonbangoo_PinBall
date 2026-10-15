'use strict';
const fs=require('fs'),path=require('path'),dir=path.join(__dirname,'results');
const before=require('./results/before.json'),after=require('./results/after.json');
const summary={at:new Date().toISOString(),cases:after.cases.map((a,i)=>{const b=before.cases[i];return {i,map:a.map,count:a.count,viewport:[a.w,a.h],dpr:a.dpr,seed:a.final.start.seed,phases:Object.fromEntries(Object.keys(a.phases).map(p=>[p,{before:{frames:b.phases[p].frames,calls:b.phases[p].calls,longTasks:b.phases[p].longTasks,cdp:b.phases[p].cdpDelta,inputNextRaf:b.phases[p].inputNextRafMs,heap:b.phases[p].heapBytes},after:{frames:a.phases[p].frames,calls:a.phases[p].calls,longTasks:a.phases[p].longTasks,cdp:a.phases[p].cdpDelta,inputNextRaf:a.phases[p].inputNextRafMs,heap:a.phases[p].heapBytes}}])),loadWallMs:[b.loadWallMs,a.loadWallMs],renderScaleAtEnd:[b.final.diagnostics.renderScale,a.final.diagnostics.renderScale]};})};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
console.log('cases',summary.cases.length);
