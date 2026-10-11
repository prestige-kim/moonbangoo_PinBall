'use strict';
const fs=require('node:fs'),{gammaQ}=require('./stats.cjs');
const r=JSON.parse(fs.readFileSync('qa/results/extended.json','utf8'));
for(const arm of r.fairness){arm.rescueIncidence=arm.rows.filter(x=>x.rescues>0).length;arm.winnerChangesByRescue=arm.rows.filter(x=>x.rescues>0&&x.winner!==x.offWinner).length;arm.pairedParticipantMcNemar=Array.from({length:6},(_,k)=>{const id='marble-'+(k+1),b=arm.rows.filter(x=>x.winner===id&&x.offWinner!==id).length,c=arm.rows.filter(x=>x.winner!==id&&x.offWinner===id).length,chi=b+c?(b-c)**2/(b+c):0;return {id,onOnly:b,offOnly:c,chiSquare:chi,pValue:gammaQ(.5,chi/2)};});}
fs.writeFileSync('qa/results/extended.json',JSON.stringify(r,null,2));
