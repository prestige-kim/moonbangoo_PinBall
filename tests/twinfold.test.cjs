'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P,run,assertRun,terminal,inside}=require('../qa/four-maps/helpers.cjs');
test('twinfold physically divides both splits, mirrors the long side and leaves final20% empty',()=>{
 terminal('twinfold');const m=P.MAPS.twinfold,polygons=m.obstacles.filter(o=>o.type==='polygon');assert.equal(polygons.length,4);
 assert.ok(inside({x:500,y:2200},polygons[0]));assert.ok(inside({x:500,y:5600},polygons[2]));
 assert.ok(polygons[1].points.some(p=>p.x>964));assert.ok(polygons[3].points.some(p=>p.x<36));
});
test('twinfold completes 1..500 balls without hidden forces and replays frame groupings',()=>{
 for(const n of [1,2,6,50,200,500])assertRun(run('twinfold',n,'fourmaps-dev-twinfold-smoke-'+n));
 assert.deepEqual(run('twinfold',6,'repeat',{},null,[1]).ranking,run('twinfold',6,'repeat',{},null,[1,4,2,3]).ranking);
});
