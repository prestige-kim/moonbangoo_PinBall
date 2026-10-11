'use strict';
const fs=require('node:fs'),{capture}=require('./hand.cjs'),{chiSquare}=require('./stats.cjs');
const r=JSON.parse(fs.readFileSync('qa/results/hand-fairness.json','utf8'));
for(const arm of r.arms){const slots=Array(6).fill(0),order=Array(6).fill(0);for(const row of arm.rows){const start=capture(row.seed,6,3,[1280,720],'circle',arm.skills),sorted=start.starts.slice().sort((a,b)=>a.y-b.y||a.x-b.x),shuffled=start.source.slice().sort((a,b)=>a.x-b.x||a.y-b.y);row.startSlot=sorted.findIndex(x=>x.id===row.winner);row.shuffleOrder=shuffled.findIndex(x=>x.id===row.winner);if(row.startSlot>=0)slots[row.startSlot]++;if(row.shuffleOrder>=0)order[row.shuffleOrder]++;}arm.startSlots=chiSquare(slots);arm.shuffleOrder=chiSquare(order);}
fs.writeFileSync('qa/results/hand-fairness.json',JSON.stringify(r,null,2));
