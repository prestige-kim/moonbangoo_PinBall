'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P,run,assertRun,terminal,inside,assertGaps}=require('../qa/four-maps/helpers.cjs');
test('twinfold alternates moving split shelves and paired carts across 20 bays with a quiet finish',()=>{
 terminal('twinfold');const m=P.MAPS.twinfold;assert.equal(m.version,5);
 assert.equal(m.obstacles.filter(o=>o.type==='moving').length,30);
 assert.equal(m.obstacles.filter(o=>o.role==='bookend').length,30);
 for(let bay=0;bay<20;bay++){
  const bars=m.obstacles.filter(o=>o.bay===bay);assert.equal(bars.length,bay%2?1:2);
  assert(bars.every(o=>o.amplitude===28&&o.speed===.8&&Math.abs(o.angle)===.34));
  assert.deepEqual(bars.map(o=>o.x),bay%2?[500]:[140,860]);
 }
});
test('twinfold completes 1..50 balls without hidden forces and replays frame groupings',()=>{
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
