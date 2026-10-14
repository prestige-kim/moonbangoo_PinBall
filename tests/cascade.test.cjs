'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P,run,assertRun,assertGaps}=require('../qa/four-maps/helpers.cjs');
const map=P.MAPS.cascade;
test('cascade has six faster rigid comb pairs with seven full-width zigzag guards',()=>{
 assert.equal(map.version,5);assert.equal(map.obstacles.filter(o=>o.role==='catch-shelf').length,14);
 const spines=map.obstacles.filter(o=>o.role==='comb-spine');assert.equal(spines.length,12);for(const spine of spines)assert.equal(2*Math.PI/spine.speed,4);assert.equal(map.obstacles.filter(o=>o.role==='comb-tooth').length,252);
 const p=new P.Physics({map,names:P.parseNames('공')});
 for(const spine of spines){const teeth=map.obstacles.filter(o=>o.assembly===spine.assembly&&o.role==='comb-tooth');for(let i=1;i<teeth.length;i++)assert(Math.hypot(teeth[i].x-teeth[i-1].x,teeth[i].y-teeth[i-1].y)-teeth[i].thickness-teeth[i-1].thickness<16,'grooves must be narrower than the smallest ball');}
 for(const spine of spines)for(const time of [0,.5,1.5,3,4.5,6]){p.time=time;const base=p.getObstaclePose(spine);for(const tooth of map.obstacles.filter(o=>o.assembly===spine.assembly&&o!==spine)){const pose=p.getObstaclePose(tooth);assert(Math.abs((pose.x-base.x)-(tooth.x-spine.x))<1e-8);assert(Math.abs(pose.vx-base.vx)<1e-8);assert(Math.sin(tooth.angle)>0,'teeth face downstream');}}
});
test('closed diagonal comb pairs cover the full board and fully retract when open',()=>{
 const p=new P.Physics({map,names:P.parseNames('공')});for(let stage=0;stage<6;stage++){
  const bars=map.obstacles.filter(o=>o.stage===stage&&o.role==='comb-spine').sort((a,b)=>a.side-b.side),closed=((1-stage*2/3)%4+4)%4;
  p.time=closed;const [a,b]=bars.map(o=>p.getObstaclePose(o));assert(a.x1<36&&a.x2>b.x1&&b.x2>964);assert(b.y1-a.y2>96,'staggered tips cannot clamp together');
  p.time=closed+2;const [c,d]=bars.map(o=>p.getObstaclePose(o));assert(c.x2<36&&d.x1>964,'both combs withdraw beyond side walls');
 }
});
test('each fixed catch pair intercepts every vertical line, even with all combs open',()=>{
 for(let row=0;row<7;row++){const rails=map.obstacles.filter(o=>o.id.startsWith('cascade-catch-'+row+'-'));assert.equal(rails.length,2);const ranges=rails.map(o=>[Math.min(o.x1,o.x2),Math.max(o.x1,o.x2)]).sort((a,b)=>a[0]-b[0]);assert(ranges[0][0]<=36&&ranges[0][1]>=ranges[1][0]&&ranges[1][1]>=964);}
});
test('cascade completes 1..50 marbles with terrain only and deterministic frame grouping',()=>{
 for(const n of [1,2,6,25,49,50])assertRun(run('cascade',n,'fourmaps-dev-cascade-smoke-'+n));
 assert.deepEqual(run('cascade',6,'repeat',{},null,[1]).ranking,run('cascade',6,'repeat',{},null,[2,4,1]).ranking);
});
test('independent cascade assemblies keep >=96 clearance over the full cycle; only rigid joints and wall slots are exempt',()=>assertGaps('cascade'));

test('small high-bounce marbles cannot be dragged into a comb groove at a wall slot',()=>{
 for(const n of [25,50])assertRun(run('cascade',n,'fourmaps-dev-matrix-cascade-0-'+n+'-2',{radius:8,gravity:350,restitution:.92}));
});
