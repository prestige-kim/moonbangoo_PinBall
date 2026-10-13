'use strict';
const fs=require('node:fs'),{run,P}=require('./helpers.cjs'),{capture}=require('../fairness/model.cjs');
const id=process.argv[2];if(!['twinfold','cascade','rhythm'].includes(id))throw new Error('Choose a new map');
const configs=[{}];for(const radius of [8,16])for(const gravity of [350,1500])for(const restitution of [.35,.92])configs.push({radius,gravity,restitution});
const results=[];for(let seed=0;seed<2;seed++)for(const count of [1,2,6,25,49,50])for(let c=0;c<configs.length;c++){
 const r=run(id,count,'fourmaps-dev-matrix-'+id+'-'+seed+'-'+count+'-'+c,configs[c]);results.push(r);if(!r.complete||Object.values(r.errors).some(n=>n))console.log('FAIL',JSON.stringify(r));
}
const hands=[];for(const protocol of ['B','C','D'])for(const count of [1,2,6,25,49,50]){
 const seed='fourmaps-dev-hand-'+id+'-'+protocol+'-'+count,groups=count===1?[1]:count===2?[1,1]:count===6?[2,2,2]:[Math.floor(count/3),Math.floor(count/3),count-2*Math.floor(count/3)],{p,start}=capture({map:id,groups},seed,protocol);
 // Preserve original mixed groups when replaying this real source capture.
 let events=0;while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())if(['rescue','skill','portal','boost'].includes(e.type))events++;}
 const replay=new P.Physics({map:P.MAPS[id],names:P.parseNames(groups.map((n,i)=>P.COLOR_GROUPS[i].name+'*'+n).join(',')),seed});P.restoreHandStart(replay,start);while(!replay.complete&&replay.time<240){replay.step();replay.drainEvents();}
 const ranking=p.finished.map(m=>[m.id,m.finishTime]);hands.push({seed,protocol,count,time:p.time,complete:p.complete,events,replayEqual:JSON.stringify(ranking)===JSON.stringify(replay.finished.map(m=>[m.id,m.finishTime])),start});
}
const performanceRows=[];for(const count of [50])for(let n=0;n<5;n++)performanceRows.push(run(id,count,'fourmaps-dev-perf-'+id+'-'+count+'-'+n,{},null,[1],true));
const output={map:id,at:new Date().toISOString(),matrix:results,hands,performance:performanceRows,failures:results.filter(r=>!r.complete||Object.values(r.errors).some(n=>n)).length+hands.filter(r=>!r.complete||r.events||!r.replayEqual).length};
fs.mkdirSync('qa/four-maps/results',{recursive:true});fs.writeFileSync('qa/four-maps/results/'+id+'.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({map:id,matrix:results.length,hands:hands.length,failures:output.failures,default50:performanceRows.filter(r=>r.count===50).map(r=>({time:r.time,p95:r.stepP95}))},null,2));if(output.failures)process.exitCode=1;
