'use strict';
const fs=require('node:fs'),path=require('node:path');
const {run,P,names}=require('./engine.cjs'),{chiSquare,quantile}=require('./stats.cjs');
const args=process.argv.slice(2),n=Number(args.find(x=>x.startsWith('--seeds='))?.split('=')[1]||1000),out={seeds:n,at:new Date().toISOString(),fairness:[],groupInvariance:[],repeatability:[],benchmark:[],input:[]};
function dist(rows,groups){const counts=Array(groups).fill(0),probs=Array(groups).fill(0);for(let i=0;i<6;i++)probs[i%groups]++;for(const r of rows)if(r.winner)counts[(Number(r.winner.split('-')[1])-1)%groups]++;return chiSquare(counts,probs.map(x=>x/6));}
for(const skills of [false,true]){
 const c={count:6,groups:1,radius:12,gravity:620,restitution:.72,skills},on=[],off=[];
 for(let i=0;i<n;i++){const seed='release-fair-'+String(i).padStart(4,'0');on.push(run(c,seed));off.push(run({...c,rescue:false},seed));if(i%100===0)console.log('fairness',skills,i,'/',n);}
 function summarize(rows){return {complete:rows.filter(r=>r.complete).length,timeouts:rows.filter(r=>!r.complete).map(r=>({seed:r.seed,remaining:r.remaining})).slice(0,20),duration:{p50:quantile(rows.map(r=>r.time),.5),p95:quantile(rows.map(r=>r.time),.95),max:Math.max(...rows.map(r=>r.time))},rescues:{p50:quantile(rows.map(r=>r.rescues),.5),p95:quantile(rows.map(r=>r.rescues),.95),max:Math.max(...rows.map(r=>r.rescues))},participant:dist(rows,6),groups:dist(rows,3),slot:chiSquare(Array.from({length:6},(_,i)=>rows.filter(r=>r.slot===i).length))};}
 out.fairness.push({skills,on:summarize(on),off:summarize(off),changedWinner:on.filter((r,i)=>r.winner!==off[i].winner).length,rows:on.map((r,i)=>({seed:r.seed,winner:r.winner,slot:r.slot,time:r.time,rescues:r.rescues,offWinner:off[i].winner,offComplete:off[i].complete}))});
 for(let i=0;i<300;i++){const seed='release-repeat-'+String(i).padStart(4,'0'),a=run(c,seed),b=run(c,seed);out.repeatability.push({skills,seed,equal:JSON.stringify(a.ranking)===JSON.stringify(b.ranking)});}
 for(const count of [1,2,6,50,200,500]){for(const groups of [1,3,8].filter(g=>g<=count)){const seed='release-group-'+count,a=run({...c,count,groups:1},seed),b=run({...c,count,groups},seed);out.groupInvariance.push({count,groups,skills,equal:JSON.stringify(a.ranking)===JSON.stringify(b.ranking)});}}
 fs.writeFileSync('qa/results/extended.json',JSON.stringify(out,null,2));
}
for(const text of ['', '가*0','가*501','가,,나','<img src=x onerror=1>','가*1.5','*2']){try{P.parseNames(text);out.input.push({text,rejected:false});}catch(e){out.input.push({text,rejected:true,message:e.message});}}
fs.writeFileSync('qa/results/extended.json',JSON.stringify(out,null,2));console.log('extended done');
