'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{capture}=require('../fairness/model.cjs'),{P}=require('./helpers.cjs');
const map=P.MAPS.cascade,mode=process.argv[2]||'first',rows=[],out=process.argv[3]||'qa/four-maps/results/cascade-combs',at=new Date().toISOString();fs.mkdirSync(out,{recursive:true});
const phases=Array.from({length:12},(_,i)=>i/3),entryRows=[750,2900,4500,6100,7700,9300];
function drop(x,y,radius,phase,complete){const p=new P.Physics({map,names:P.parseNames('공'),radius,seed:'cascade-position-'+x+'-'+y+'-'+radius+'-'+phase});Object.assign(p.marbles[0],{x,y,vx:0,vy:0});p.time=phase;p.ticks=Math.round(phase*120);let contacts=0,first=null;
 while(!p.complete&&p.time-phase<240){p.step();for(const e of p.drainEvents()){if(e.type==='hit'&&e.obstacle){contacts++;if(!first)first={id:e.obstacle.id,time:p.time-phase,y:e.y};}assert(!['rescue','skill','portal','boost'].includes(e.type));}const m=p.marbles[0];assert([m.x,m.y,m.vx,m.vy].every(Number.isFinite));assert(m.x-m.r>=36-1e-5&&m.x+m.r<=964+1e-5);if(first&&!complete)break;}
 assert(first,'no obstacle contact at '+JSON.stringify({x,y,radius,phase}));if(complete)assert(p.complete,'timeout at '+JSON.stringify({x,y,radius,phase}));return {x,y,radius,phase,contacts,first,time:p.time-phase,complete:p.complete};}
if(mode==='first'){
 // Every integer x across the legal default-radius spawn width, all 12 phases.
 for(const phase of phases)for(let x=48;x<=952;x++)rows.push(drop(x,738,12,phase,false));
 // Extreme radii and every guard-band entry, including both side-wall positions.
 for(const radius of [8,16])for(const y of entryRows)for(const phase of phases){const xs=[36+radius,964-radius];for(let x=64;x<940;x+=32)xs.push(x);for(const x of xs)rows.push(drop(x,y,radius,phase,false));}
}else if(mode==='full'){
 for(const radius of [8,16])for(const phase of [0,1,2,3]){const xs=[36+radius,964-radius];for(let x=64;x<940;x+=32)xs.push(x);for(const x of xs)rows.push(drop(x,750-radius,radius,phase,true));}
}else if(mode==='groups'){
 for(const protocol of ['B','C','D'])for(let i=0;i<12;i++){
  const seed='cascade-comb-winner-v5-'+protocol+'-'+i,{p}=capture({map:'cascade',groups:[17,17,16]},seed,protocol),hits=new Map();let forbidden=0;
  while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents()){if(e.type==='hit'&&e.obstacle){if(!hits.has(e.id))hits.set(e.id,new Set());hits.get(e.id).add(e.obstacle.id);}if(['rescue','skill','portal','boost'].includes(e.type))forbidden++;}}
  assert(p.complete);assert.equal(forbidden,0);assert.equal(p.finished.length,50);const winner=p.finished[0],winnerContacts=hits.get(winner.id)?.size||0,minContacts=Math.min(...p.finished.map(m=>hits.get(m.id)?.size||0));assert(winnerContacts>=3,'winner must engage multiple obstacles '+seed);assert(minContacts>=1,'every marble must touch real terrain '+seed);rows.push({seed,protocol,time:p.time,winnerContacts,minContacts});
 }
}else throw Error('Use first, full or groups');
const result={mode,at,version:map.version,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('js/maps/cascade.js')).digest('hex'),cases:rows.length,failures:0,phases,rows};fs.writeFileSync(out+'/'+mode+'.json',JSON.stringify(result));console.log(JSON.stringify({mode,cases:rows.length,failures:0,minContacts:Math.min(...rows.map(r=>r.contacts??r.minContacts)),maxTime:Math.max(...rows.map(r=>r.time))}));
