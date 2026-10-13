'use strict';
const assert=require('node:assert/strict'),{loadPhysics}=require('../sim/adapter.cjs');
const P=loadPhysics();
function inside(m,o){let yes=false;for(let i=0,j=o.points.length-1;i<o.points.length;j=i++){const a=o.points[i],b=o.points[j];if((a.y>m.y)!==(b.y>m.y)&&m.x<(b.x-a.x)*(m.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function run(id,count,seed,config={},record=null,grouping=[1],benchmark=false){
 const map=P.MAPS[id],names=P.parseNames(count===6?'빨강*2,초록*2,파랑*2':'빨강*'+count),p=new P.Physics({map,names,seed,...config});if(record)P.restoreHandStart(p,record);
 const costs=[],errors={finite:0,bounds:0,penetration:0,forbidden:0,timeout:0,ranking:0};let frames=0,maxDepth=0,hitEvents=0,addedHits=0;const hitObstacles=new Set();
 while(!p.complete&&p.time<240){for(let i=0;i<grouping[frames%grouping.length]&&!p.complete;i++){
  const t=benchmark?performance.now():0;p.step();if(benchmark&&p.ticks>120)costs.push(performance.now()-t);
  for(const e of p.drainEvents()){if(e.type==='hit'||e.type==='bumper'){hitEvents++;if(e.obstacle){hitObstacles.add(e.obstacle.id);if(e.obstacle.id.includes('-detail-')||e.obstacle.id.includes('-echo-'))addedHits++;}}if(e.type==='skill'||e.type==='rescue'||e.type==='portal'||e.type==='boost')errors.forbidden++;}
  for(const m of p.marbles){if(![m.x,m.y,m.vx,m.vy].every(Number.isFinite))errors.finite++;if(m.x-m.r<p.bounds.left-1e-4||m.x+m.r>p.bounds.right+1e-4||m.y-m.r<p.bounds.top-1e-4||m.y+m.r>p.bounds.bottom+1e-4)errors.bounds++;
   if(!m.finished&&p.ticks%12===0)for(const o of map.obstacles){if(o.type==='polygon'&&inside(m,o))errors.penetration++;if(o.type==='segment'||o.type==='moving'||o.type==='pin'){const pose=p.getObstaclePose(o),c=p._contact(m,o,pose,0);if(c){maxDepth=Math.max(maxDepth,c.depth);if(c.depth>m.r*.5)errors.penetration++;}}}
  }
 }frames++;}
 if(!p.complete)errors.timeout++;if(p.finished.length!==count||new Set(p.finished.map(m=>m.id)).size!==count)errors.ranking++;
 costs.sort((a,b)=>a-b);return {map:id,count,seed,config,time:p.time,complete:p.complete,errors,maxDepth,ranking:p.finished.map(m=>[m.id,m.finishTime]),remaining:p.marbles.filter(m=>!m.finished).map(m=>({id:m.id,x:m.x,y:m.y,vx:m.vx,vy:m.vy})),hitEvents,addedHits,hitObstacles:hitObstacles.size,stepP50:costs[Math.floor(costs.length*.5)],stepP95:costs[Math.floor(costs.length*.95)]};
}
function assertRun(result){assert.equal(result.complete,true,JSON.stringify(result.remaining));for(const [key,n]of Object.entries(result.errors))assert.equal(n,0,key+' '+JSON.stringify(result));}
function terminal(id){const m=P.MAPS[id];assert.equal(m.finish.y,11000);for(const o of m.obstacles){assert.ok(!['portal','boost','bumper','rotor'].includes(o.type));const bottom=o.points?Math.max(...o.points.map(p=>p.y)):o.y===undefined?Math.max(o.y1,o.y2)+o.thickness:o.y+(o.r||o.length/2)+(o.amplitude||0)+(o.thickness||0);assert.ok(bottom<8800,JSON.stringify(o));}}
function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function edges(o,pose=o){if(o.r)return [[{x:o.x,y:o.y},{x:o.x,y:o.y}]];return o.points?o.points.map((p,i)=>[p,o.points[(i+1)%o.points.length]]):[[{x:pose.x1,y:pose.y1},{x:pose.x2,y:pose.y2}]];}
function gap(a,b,pa=a,pb=b){if(a.r&&b.r)return Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;if(a.r||b.r){const c=a.r?a:b,o=a.r?b:a,p=a.r?pb:pa;if(o.points&&inside(c,o))return -c.r;return Math.min(...edges(o,p).map(([u,v])=>distance(c,u,v)))-c.r-(o.thickness||1);}let d=Infinity;for(const[x,y]of edges(a,pa))for(const[u,v]of edges(b,pb)){const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(cross(x,y,u)*cross(x,y,v)<=0&&cross(u,v,x)*cross(u,v,y)<=0&&Math.max(Math.min(x.x,y.x),Math.min(u.x,v.x))<=Math.min(Math.max(x.x,y.x),Math.max(u.x,v.x))&&Math.max(Math.min(x.y,y.y),Math.min(u.y,v.y))<=Math.min(Math.max(x.y,y.y),Math.max(u.y,v.y)))d=0;d=Math.min(d,distance(x,u,v),distance(y,u,v),distance(u,x,y),distance(v,x,y));}return d-(a.thickness||1)-(b.thickness||1);}
function assertGaps(id){const map=P.MAPS[id],p=new P.Physics({map,names:P.parseNames('공')}),all=map.obstacles;let min=Infinity;
 for(let tick=0;tick<=(id==='rhythm'?960:0);tick++){p.time=tick/120;for(let i=0;i<all.length;i++){const a=all[i],pa=p.getObstaclePose(a);for(let j=i+1;j<all.length;j++){const d=gap(a,all[j],pa,p.getObstaclePose(all[j]));min=Math.min(min,d);assert.ok(d>=96-1e-8,a.id+' / '+all[j].id+' gap='+d);}const xs=edges(a,pa).flat().map(q=>q.x),lo=Math.min(...xs),hi=Math.max(...xs);if(lo>36&&hi<964){assert.ok(lo-(a.r||a.thickness||1)-36>=96-1e-8,a.id+' left wall');assert.ok(964-hi-(a.r||a.thickness||1)>=96-1e-8,a.id+' right wall');}}}return min;
}
module.exports={P,run,assertRun,terminal,inside,assertGaps,gap};
