'use strict';
const fs=require('node:fs'),{capture}=require('./hand.cjs'),{run,P}=require('./engine.cjs'),{chiSquare,quantile}=require('./stats.cjs');
const n=Number(process.argv.find(x=>x.startsWith('--seeds='))?.split('=')[1]||1000),out={at:new Date().toISOString(),description:'Actual tube gravity/pouring + fixed two-second circular hand input; 1280x720; slots ranked from captured x/y; independent race RNG',seeds:n,arms:[],nameInvariant:[]};
for(const skills of [false,true]){
 const rows=[];for(let i=0;i<n;i++){const seed='release-hand-'+String(i).padStart(4,'0'),start=capture(seed,6,3,[1280,720],'circle',skills),config={count:6,groups:3,radius:12,gravity:620,restitution:.72,skills};
  const r=run(config,seed,{starts:start});rows.push({seed,winner:r.winner,time:r.time,complete:r.complete,rescues:r.rescues,errors:r.errors});if(i%100===0)console.log('hand fairness',skills,i,'/',n);
 }
 const wins=Array.from({length:6},(_,k)=>rows.filter(r=>r.winner==='marble-'+(k+1)).length),groups=[0,1,2].map(k=>wins[k*2]+wins[k*2+1]);out.arms.push({skills,participant:chiSquare(wins),groups:chiSquare(groups),duration:{p50:quantile(rows.map(r=>r.time),.5),p95:quantile(rows.map(r=>r.time),.95),max:Math.max(...rows.map(r=>r.time))},timeouts:rows.filter(r=>!r.complete),rows});fs.writeFileSync('qa/results/hand-fairness.json',JSON.stringify(out,null,2));
}
for(let i=0;i<20;i++){const seed='release-hand-name-'+i,a=capture(seed,6,1),b=capture(seed,6,3);out.nameInvariant.push({seed,equal:JSON.stringify(a.starts)===JSON.stringify(b.starts)});}
fs.writeFileSync('qa/results/hand-fairness.json',JSON.stringify(out,null,2));
