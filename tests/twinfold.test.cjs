'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P,run,assertRun,assertGaps}=require('../qa/four-maps/helpers.cjs');
test('twinfold alternates moving split shelves and paired carts across 20 bays with an active finale',()=>{
 const m=P.MAPS.twinfold;assert.equal(m.version,8);assert.equal(m.finish.y,11000);
 assert.equal(m.obstacles.filter(o=>o.type==='moving'&&o.role!=='finale').length,30);
 assert.equal(m.obstacles.filter(o=>o.role==='bookend').length,30);
 for(let bay=0;bay<20;bay++){
  const bars=m.obstacles.filter(o=>o.bay===bay);assert.equal(bars.length,bay%2?1:2);
  assert(bars.every(o=>o.amplitude===28&&o.speed===.8&&Math.abs(o.angle)===.34));
  assert.deepEqual(bars.map(o=>o.x),bay%2?[500]:[140,860]);
 }
});
test('twinfold completes 1..50 balls with declared wind fields and replays frame groupings',()=>{
 for(const n of [1,2,6,25,49,50])assertRun(run('twinfold',n,'fourmaps-dev-twinfold-smoke-'+n));
 assert.deepEqual(run('twinfold',6,'repeat',{},null,[1]).ranking,run('twinfold',6,'repeat',{},null,[1,4,2,3]).ranking);
});

test("twinfold keeps physical gaps >=96 including the walls and full motion cycle",()=>assertGaps("twinfold"));

test('twinfold side-wall starts must contact moving shelves rather than bypassing the course',()=>{
 for(const x of [48,952]){
  const p=new P.Physics({map:P.MAPS.twinfold,names:P.parseNames('공'),seed:'library-wall-'+x});
  Object.assign(p.marbles[0],{x,y:800,vx:0,vy:0});let contacts=0;
  while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())if(e.type==='hit'&&e.obstacle?.type==='moving')contacts++;}
  assert(p.complete);assert(contacts>=5,'wall route must engage multiple moving shelves');
 }
});

test('twinfold finale has four dynamic stages, open lanes and collision events near the finish',()=>{
 const map=P.MAPS.twinfold,finale=map.obstacles.filter(o=>o.role==='finale');
 assert.equal(finale.length,5);assert.equal(finale.filter(o=>o.type==='wind').length,2);
 assert.deepEqual([...new Set(finale.map(o=>o.y))].sort((a,b)=>a-b),[9020,9600,10160,10760]);
 assert(finale.every(o=>o.type==='wind'?o.y<map.finish.y-96:o.y+o.length/2+(o.amplitude||0)+o.thickness<map.finish.y-96));
 for(const count of [1,6,50]){
  const p=new P.Physics({map,names:P.parseNames('공*'+count),seed:'library-finale-'+count});let hits=0,late=0;
  while(!p.complete&&p.time<240){p.step();for(const e of p.drainEvents())if((e.type==='hit'||e.type==='wind')&&e.obstacle?.role==='finale'){hits++;if(e.obstacle.y===10760)late++;}
   if(p.ticks%12===0)for(const marble of p.marbles)if(!marble.finished)for(const o of finale.filter(o=>o.type!=='wind')){const c=p._contact(marble,o,p.getObstaclePose(o),0);if(c)assert(c.depth<=marble.r*.5,'no deep finale penetration');}
  }
  assert(p.complete);assert(hits>0);if(count===50)assert(late>0,'last wind vent must lift marbles');
 }
});
