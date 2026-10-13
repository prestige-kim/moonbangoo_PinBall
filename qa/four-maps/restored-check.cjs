'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{capture,P}=require('../fairness/model.cjs');
const rows=[];
for(const map of ['classic','twinfold','cascade','rhythm'])for(const count of [1,2,6,25,49,50])for(const protocol of ['B','C','D']){
 const seed='restored-circle-v2-'+map+'-'+count+'-'+protocol,groups=count===1?[1]:count===2?[1,1]:[Math.floor(count/3),Math.floor(count/3),count-2*Math.floor(count/3)];
 const {p,start}=capture({map,groups},seed,protocol);assert.equal(start.version,2);let forces=0;
 while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())if(['skill','rescue','portal','boost'].includes(e.type))forces++;}
 assert(p.complete,seed);assert.equal(new Set(p.finished.map(m=>m.id)).size,count);if(map!=='classic')assert.equal(forces,0);
 const replay=new P.Physics({map:P.MAPS[map],names:P.parseNames(groups.map((n,i)=>P.COLOR_GROUPS[i].name+'*'+n).join(',')),seed});P.restoreHandStart(replay,start);while(!replay.complete&&replay.time<240){replay.step();replay.drainEvents();}
 assert.deepEqual(p.finished.map(m=>[m.id,m.finishTime]),replay.finished.map(m=>[m.id,m.finishTime]));rows.push({map,count,protocol,seed,time:p.time,forces,replayEqual:true,startVersion:start.version});
}
fs.writeFileSync('qa/four-maps/results/restored-hands.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({cases:rows.length,failures:0}));
