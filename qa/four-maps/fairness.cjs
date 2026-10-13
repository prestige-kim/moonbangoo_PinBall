'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{capture,P}=require('../fairness/model.cjs'),{chiSquare}=require('../sim/stats.cjs');
const phase=process.argv[2]||'dev',id=process.argv[3];if(!['dev','final'].includes(phase)||!['twinfold','cascade','rhythm'].includes(id))throw new Error('Use dev|final map');
const series=process.env.FOUR_MAPS_SERIES||'';if(series&&!/^[a-z0-9-]+$/.test(series))throw new Error('Invalid series');
const count=phase==='dev'?40:300,rows=[],cases=[];
const files=['js/maps/'+id+'.js','js/shuffle.js','js/hand-scene.js','js/hand-start.js'],sourceHashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
function intervals(counts){const n=counts.reduce((a,b)=>a+b,0),z=1.959963984540054;return counts.map(k=>{const p=k/n,d=1+z*z/n,m=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return {count:k,rate:p,low:m-h,high:m+h};});}
for(const protocol of ['B','C','D']){
 const ids=Array(6).fill(0),groups=Array(3).fill(0),slots=Array(6).fill(0);let failures=0;
 for(let i=0;i<count;i++){
  const seed='fourmaps-'+(series?series+'-':'')+phase+(phase==='final'&&P.MAPS[id].version>1?'-v'+P.MAPS[id].version:'')+'-fair-'+id+'-'+protocol+'-'+String(i).padStart(4,'0');
  try{const {p}=capture({map:id,groups:[2,2,2]},seed,protocol),order=p.marbles.slice().sort((a,b)=>a.y-b.y||a.x-b.x).map(m=>m.id);let forces=0;while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())if(['skill','rescue','boost','portal'].includes(e.type))forces++;}
   const winner=p.finished[0],index=winner?Number(winner.id.slice(7))-1:null,ok=p.complete&&p.finished.length===6&&new Set(p.finished.map(m=>m.id)).size===6&&!forces;if(!ok)failures++;if(ok){ids[index]++;groups[Math.floor(index/2)]++;slots[order.indexOf(winner.id)]++;}rows.push({seed,protocol,complete:p.complete,time:p.time,winner:ok?winner.id:null,slot:ok?order.indexOf(winner.id):null,forces});
  }catch(error){failures++;rows.push({seed,protocol,error:error.message});}
 }
 const measure=counts=>({...chiSquare(counts),intervals:intervals(counts)}),a=measure(ids),b=measure(groups),c=measure(slots);
 cases.push({protocol,requested:count,failures,id:a,group:b,slot:c,screenPass:!failures&&a.pValue>=.01&&b.pValue>=.01,priorAuditDeviationPass:a.maxDeviationPercentagePoints<=1.5&&b.maxDeviationPercentagePoints<=1.5});
}
for(const f of files)if(sourceHashes[f]!==crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'))throw new Error('Geometry changed during final sampling');
fs.mkdirSync('qa/four-maps/results',{recursive:true});fs.writeFileSync('qa/four-maps/results/fair-'+(series?series+'-':'')+phase+'-'+id+'.json',JSON.stringify({phase,map:id,samplesPerProtocol:count,sourceHashes,cases,rows,limitation:'Exploratory sample; not a certification of 1.5 percentage point equivalence. Start slot distribution is reported, not judged against uniformity.'},null,2));console.log(JSON.stringify({phase,map:id,cases:cases.map(c=>({protocol:c.protocol,n:c.requested,failures:c.failures,idP:c.id.pValue,groupP:c.group.pValue,idMax:c.id.maxDeviationPercentagePoints,groupMax:c.group.maxDeviationPercentagePoints,screenPass:c.screenPass}))},null,2));
