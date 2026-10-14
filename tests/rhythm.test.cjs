'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{P,run,assertRun,assertGaps}=require('../qa/four-maps/helpers.cjs');
const map=P.MAPS.rhythm;
test('rhythm v4 replaces wall shutters and long diagonal shelves with four open six-spoke drums',()=>{
 assert.equal(map.version,4);assert(!map.obstacles.some(o=>['beat-shutter','beat-chain','beat-paddle','beat-guide'].includes(o.role)));
 const drums=map.obstacles.filter(o=>o.role==='clock-drum');assert.equal(drums.length,12);assert.equal(new Set(drums.map(o=>o.assembly)).size,4);
 for(let row=0;row<4;row++){const group=drums.filter(o=>o.beat.stage===row);assert.equal(group.length,3);for(let i=0;i<3;i++){assert.equal(group[i].length,420);assert.equal(group[i].x,500);assert.equal(group[i].y,[1700,4500,7300,10100][row]);assert.equal(group[i].speed,group[0].speed);if(i)assert(Math.abs(group[i].angle-group[i-1].angle-Math.PI/3)<1e-8);}
  const ring=map.obstacles.filter(o=>o.assembly==='rhythm-ring-'+row);assert.equal(ring.length,24);const physics=new P.Physics({map,names:P.parseNames('공')});for(const o of ring){assert.equal(o.type,'moving');assert.equal(o.amplitude,12);assert(Math.abs(physics.getObstaclePose(o).x1-500)>=158-1e-8,'top and bottom openings remain real');}
 }
 for(const o of map.obstacles.filter(o=>o.type==='segment'))assert(Math.hypot(o.x2-o.x1,o.y2-o.y1)<150,'no full-board diagonal shelf');
 assert.equal(map.obstacles.filter(o=>o.role==='clock-pad').length,12);for(const o of map.obstacles.filter(o=>o.role==='clock-pad')){assert.equal(o.axis,'y');assert(Math.abs(o.angle)>=.18);}
 assert.equal(map.obstacles.filter(o=>o.role==='clock-fork').length,6);assert.equal(map.obstacles.filter(o=>o.role==='clock-jewel').length,4);
});
test('the middle route is shorter while swaying forks send outside arrivals into detours',()=>{
 const rows=[];for(const x of [330,500,670]){const p=new P.Physics({map,names:P.parseNames('공')});Object.assign(p.marbles[0],{x,y:2250,vx:0,vy:0});let path=0;
  while(p.time<8&&p.marbles[0].y<2800){const m=p.marbles[0],a=m.x,b=m.y;p.step();path+=Math.hypot(m.x-a,m.y-b);p.drainEvents();}assert(p.marbles[0].y>=2800,'fork must release exact apex arrival');rows.push({x:p.marbles[0].x,path,time:p.time});
 }
 assert.equal(rows[1].x,500);assert(rows[0].x<240&&rows[2].x>760);assert(rows[0].path>rows[1].path*1.15&&rows[2].path>rows[1].path*1.15);assert(rows[0].time>rows[1].time&&rows[2].time>rows[1].time);
});
test('drum pockets and vertical pads change physical arrival timing across cycle phases',()=>{
 for(const role of ['clock-drum','clock-pad']){const o=map.obstacles.find(o=>o.role===role),drum=role==='clock-drum',obs=drum?map.obstacles.filter(q=>q.assembly===o.assembly||q.assembly==='rhythm-ring-0'):[o],times=[];
  for(let i=0;i<16;i++){const phase=o.beat.period*i/16,p=new P.Physics({map:{...map,obstacles:obs},names:P.parseNames('공')});Object.assign(p.marbles[0],{x:drum?500:o.x,y:o.y-(drum?340:180),vx:0,vy:120});p.time=phase;p.ticks=Math.round(phase*120);
   while(p.time-phase<12&&p.marbles[0].y<o.y+(drum?340:180)){p.step();for(const e of p.drainEvents())assert(!['rescue','skill','portal','boost'].includes(e.type));}
   assert(p.marbles[0].y>=o.y+(drum?340:180));times.push(p.time-phase);
  }
  assert(Math.max(...times)-Math.min(...times)>.5,'timing must result from real moving contacts');
 }
});
test('rhythm v4 completes 1..50 balls without force recovery and exactly replays grouping',()=>{
 for(const n of [1,2,6,25,49,50])assertRun(run('rhythm',n,'fourmaps-dev-rhythm-v4-smoke-'+n));
 assert.deepEqual(run('rhythm',6,'repeat',{},null,[1]).ranking,run('rhythm',6,'repeat',{},null,[4,2,1]).ranking);
});
test('exact entrance-cap drops cannot balance forever on a drum opening',()=>{for(const [x,y] of [[640,742],[670,1320]]){const p=new P.Physics({map,names:P.parseNames('공'),radius:8});Object.assign(p.marbles[0],{x,y,vx:0,vy:0});while(!p.complete&&p.time<240){p.step();p.drainEvents();}assert(p.complete);}});
test('tilted pads release the seed that bounced forever above a horizontal pad',()=>assertRun(run('rhythm',50,'clock-curved-feeders')));
test('rhythm v4 keeps >=96 independent clearance throughout its complete 9.6 second cycle',()=>assertGaps('rhythm',9.6));
test('clockwork art follows actual poses, remains deterministic and does not change marbles',()=>{
 new Function('window',fs.readFileSync('js/renderer.js','utf8'))({CosmicPinball:P});const o=map.obstacles.find(o=>o.role==='clock-pad'),p=new P.Physics({map,names:P.parseNames('공')});p.time=.8;
 function trace(reduced){const calls=[];const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});const r=Object.assign(Object.create(P.Renderer.prototype),{ctx,reducedMotion:reduced});r.drawClockwork(o,p);return calls;}
 const before=JSON.stringify(p.marbles),pose=p.getObstaclePose(o),a=trace(false);assert(a.some(c=>c[0]==='moveTo'&&c[1]===pose.x1&&c[2]===pose.y1));assert(a.some(c=>c[0]==='lineTo'&&c[1]===pose.x2&&c[2]===pose.y2));assert.deepEqual(a,trace(true));assert.deepEqual(a,trace(false));assert.equal(JSON.stringify(p.marbles),before);p.time=1.6;assert.notDeepEqual(trace(false),a);
});
