'use strict';
const fs=require('node:fs'),{capture,P}=require('../fairness/model.cjs'),helper=require('../four-maps/helpers.cjs'),{assertGaps}=helper;helper.P.MAPS=P.MAPS;
const candidate=JSON.parse(process.argv[2]||'{}'),rows=[];
if(candidate.pads)for(let row=0;row<3;row++)for(const [i,x] of [225,500,775].entries())P.MAPS.rhythm.obstacles.push({type:'moving',id:'rhythm-buffer-'+row+'-'+i,role:'clock-pad',x,y:3550+2800*row,axis:'y',amplitude:20,length:candidate.length||80,thickness:12,angle:i===2?-.25:.25,speed:Math.PI*2/2.4,phase:i*Math.PI*2/3+row*Math.PI/3,beat:{period:2.4,step:i,stage:row}});
if(candidate.cascadeAngle){for(const o of P.MAPS.cascade.obstacles.filter(o=>o.role==='catch-shelf')){const dy=Math.abs(o.x2-o.x1)*Math.tan(candidate.cascadeAngle);if(o.x1<0)o.y2=o.y1+dy;else o.y1=o.y2+dy;}}
if(candidate.twinAngle)for(const o of P.MAPS.twinfold.obstacles.filter(o=>o.bay!==undefined))o.angle=Math.sign(o.angle)*candidate.twinAngle;
if(candidate.gaps){console.log('rhythm',assertGaps('rhythm',9.6));console.log('cascade',assertGaps('cascade',4));process.exit(0);}
for(const count of [1,6,25,50])for(let i=0;i<6;i++){
 const seed='tuning-final-v1-'+count+'-'+i,protocol=['B','C','D'][i%3],groups=count===1?[1]:[Math.floor(count/3),Math.floor(count/3),count-2*Math.floor(count/3)];
 for(const map of ['classic','twinfold','cascade','rhythm']){const {p}=capture({map,groups,skills:false},seed,protocol);let hits=0;while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())if(e.obstacle?.id.startsWith('rhythm-buffer-'))hits++;}rows.push({map,count,seed,time:p.time,complete:p.complete,hits});}
 console.log(JSON.stringify({count,i,times:rows.slice(-4).map(r=>r.time),hits:rows.at(-1).hits}));
}
fs.writeFileSync('/private/tmp/pinball-tune-'+(candidate.tag||'trial')+'.json',JSON.stringify({candidate,rows},null,2));
