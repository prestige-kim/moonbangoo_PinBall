'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{capture}=require('../fairness/model.cjs'),{P}=require('./helpers.cjs');
const map=P.MAPS.rhythm,mode=process.argv[2]||'positions',out=process.argv[3]||'qa/four-maps/results/rhythm-clockwork',rows=[],at=new Date().toISOString(),phases=Array.from({length:24},(_,i)=>i*.4);fs.mkdirSync(out,{recursive:true});
function drop(x,y,radius,phase,complete){const p=new P.Physics({map,names:P.parseNames('공'),radius,seed:'rhythm-v4-position-'+x+'-'+y+'-'+phase});Object.assign(p.marbles[0],{x,y,vx:0,vy:0});p.time=phase;p.ticks=Math.round(phase*120);let hits=0,dynamic=0,first=null;
 while(!p.complete&&p.time-phase<240){p.step();for(const e of p.drainEvents()){assert(!['rescue','skill','portal','boost'].includes(e.type));if(e.type==='hit'&&e.obstacle){hits++;if(e.obstacle.beat)dynamic++;if(!first)first={id:e.obstacle.id,time:p.time-phase};}}
  const m=p.marbles[0];assert([m.x,m.y,m.vx,m.vy].every(Number.isFinite));assert(m.x-m.r>=36-1e-5&&m.x+m.r<=964+1e-5);if(first&&!complete)break;}
 assert(first,'no obstacle contact '+JSON.stringify({x,y,radius,phase}));if(complete)assert(p.complete,'timeout '+JSON.stringify({x,y,radius,phase}));return {x,y,radius,phase,hits,dynamic,first,time:p.time-phase,complete:p.complete};}
if(mode==='positions'){
 for(const phase of phases)for(let x=48;x<=952;x++)rows.push(drop(x,738,12,phase,false));
 for(const radius of [8,16])for(const y of [800,3600,6400,9200])for(const phase of phases){const xs=[36+radius,964-radius];for(let x=64;x<940;x+=32)xs.push(x);for(const x of xs)rows.push(drop(x,y,radius,phase,false));}
}else if(mode==='full'){
 for(const radius of [8,16])for(const phase of [0,2.4,4.8,7.2]){const xs=[36+radius,964-radius];for(let x=64;x<940;x+=32)xs.push(x);for(const x of xs)rows.push(drop(x,750-radius,radius,phase,true));}
}else if(mode==='groups'){
 for(const protocol of ['B','C','D'])for(let i=0;i<12;i++){
  const seed='rhythm-clockwork-v4-'+protocol+'-'+i,{p}=capture({map:'rhythm',groups:[17,17,16]},seed,protocol),hits=new Map(),dynamic=new Map(),roles={};
  while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents()){assert(!['rescue','skill','portal','boost'].includes(e.type));if(e.type==='hit'&&e.obstacle){if(!hits.has(e.id))hits.set(e.id,new Set());hits.get(e.id).add(e.obstacle.id);if(e.obstacle.beat){dynamic.set(e.id,(dynamic.get(e.id)||0)+1);roles[e.obstacle.role]=(roles[e.obstacle.role]||0)+1;}}}}
  assert(p.complete);assert.equal(p.finished.length,50);const winner=p.finished[0],winnerContacts=hits.get(winner.id)?.size||0,winnerDynamic=dynamic.get(winner.id)||0,minContacts=Math.min(...p.finished.map(m=>hits.get(m.id)?.size||0));const winnerDrumContacts=Array.from(hits.get(winner.id)||[]).filter(id=>id.startsWith('rhythm-drum-')).length;assert(winnerDrumContacts>=1,'winner must contact the drum spokes '+seed);assert(winnerContacts>=3,'winner contacts '+seed);assert(winnerDynamic>=1,'winner must engage a rhythmic obstacle '+seed);assert(minContacts>=1,'every ball engages terrain '+seed);for(const role of ['clock-drum','clock-pad'])assert(roles[role]>0,role+' never contacted');rows.push({seed,protocol,time:p.time,winnerContacts,winnerDynamic,winnerDrumContacts,minContacts,roles});
 }
}else if(mode==='rotors'){
 const configs=[{}];for(const radius of [8,16])for(const gravity of [350,1500])for(const restitution of [.35,.92])configs.push({radius,gravity,restitution});
 for(let i=0;i<configs.length;i++){const config=configs[i],p=new P.Physics({map,names:P.parseNames('공*50'),seed:'rhythm-v4-rotor-containment-'+i,...config}),rotors=map.obstacles.filter(o=>o.type==='rotor');let maxDepth=0;
  while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())assert(!['rescue','skill','portal','boost'].includes(e.type));const poses=rotors.map(o=>p.getObstaclePose(o));
   for(const m of p.marbles){assert([m.x,m.y,m.vx,m.vy].every(Number.isFinite));assert(m.x-m.r>=36-1e-5&&m.x+m.r<=964+1e-5);if(m.finished)continue;
    for(let j=0;j<rotors.length;j++){const o=rotors[j];if(Math.abs(m.y-o.y)>250||Math.abs(m.x-o.x)>250)continue;const c=p._contact(m,o,poses[j],0);if(c){maxDepth=Math.max(maxDepth,c.depth);assert(c.depth<=m.r*.5,'deep rotor overlap '+JSON.stringify({config,id:o.id,depth:c.depth}));}}
   }
  }
  assert(p.complete);rows.push({config,time:p.time,complete:p.complete,maxDepth});
 }
}else throw Error('Use positions, full, groups or rotors');
const result={mode,at,version:map.version,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('js/maps/rhythm.js')).digest('hex'),cases:rows.length,failures:0,phases,rows};fs.writeFileSync(out+'/'+mode+'.json',JSON.stringify(result));console.log(JSON.stringify({mode,cases:rows.length,failures:0,minContacts:mode==='rotors'?undefined:Math.min(...rows.map(r=>r.hits??r.minContacts)),maxTime:Math.max(...rows.map(r=>r.time)),minWinnerDynamic:mode==='groups'?Math.min(...rows.map(r=>r.winnerDynamic)):undefined}));
