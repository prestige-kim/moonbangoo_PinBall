'use strict';
const assert=require('node:assert/strict'),{loadPhysics}=require('../sim/adapter.cjs');
const P=loadPhysics();
function inside(m,o){let yes=false;for(let i=0,j=o.points.length-1;i<o.points.length;j=i++){const a=o.points[i],b=o.points[j];if((a.y>m.y)!==(b.y>m.y)&&m.x<(b.x-a.x)*(m.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function run(id,count,seed,config={},record=null,grouping=[1],benchmark=false){
 const map=P.MAPS[id],names=P.parseNames(count===6?'빨강*2,초록*2,파랑*2':'빨강*'+count),p=new P.Physics({map,names,seed,...config});if(record)P.restoreHandStart(p,record);
 const costs=[],errors={finite:0,bounds:0,penetration:0,forbidden:0,timeout:0,ranking:0};let frames=0,maxDepth=0;
 while(!p.complete&&p.time<240){for(let i=0;i<grouping[frames%grouping.length]&&!p.complete;i++){
  const t=benchmark?performance.now():0;p.step();if(benchmark&&p.ticks>120)costs.push(performance.now()-t);
  for(const e of p.drainEvents())if(e.type==='skill'||e.type==='rescue'||e.type==='portal'||e.type==='boost')errors.forbidden++;
  for(const m of p.marbles){if(![m.x,m.y,m.vx,m.vy].every(Number.isFinite))errors.finite++;if(m.x-m.r<p.bounds.left-1e-4||m.x+m.r>p.bounds.right+1e-4||m.y-m.r<p.bounds.top-1e-4||m.y+m.r>p.bounds.bottom+1e-4)errors.bounds++;
   if(!m.finished&&p.ticks%12===0)for(const o of map.obstacles){if(o.type==='polygon'&&inside(m,o))errors.penetration++;if(o.type==='segment'||o.type==='moving'){const pose=p.getObstaclePose(o),c=p._contact(m,o,pose,0);if(c){maxDepth=Math.max(maxDepth,c.depth);if(c.depth>m.r*.5)errors.penetration++;}}}
  }
 }frames++;}
 if(!p.complete)errors.timeout++;if(p.finished.length!==count||new Set(p.finished.map(m=>m.id)).size!==count)errors.ranking++;
 costs.sort((a,b)=>a-b);return {map:id,count,seed,config,time:p.time,complete:p.complete,errors,maxDepth,ranking:p.finished.map(m=>[m.id,m.finishTime]),remaining:p.marbles.filter(m=>!m.finished).map(m=>({id:m.id,x:m.x,y:m.y,vx:m.vx,vy:m.vy})),stepP50:costs[Math.floor(costs.length*.5)],stepP95:costs[Math.floor(costs.length*.95)]};
}
function assertRun(result){assert.equal(result.complete,true,JSON.stringify(result.remaining));for(const [key,n]of Object.entries(result.errors))assert.equal(n,0,key+' '+JSON.stringify(result));}
function terminal(id){const m=P.MAPS[id];assert.equal(m.finish.y,11000);for(const o of m.obstacles){assert.ok(!['portal','boost','bumper','rotor','pin'].includes(o.type));const bottom=o.points?Math.max(...o.points.map(p=>p.y)):o.y===undefined?Math.max(o.y1,o.y2)+o.thickness:o.y+o.length/2+(o.amplitude||0)+o.thickness;assert.ok(bottom<8800,JSON.stringify(o));}}
module.exports={P,run,assertRun,terminal,inside};
