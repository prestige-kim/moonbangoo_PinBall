'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P,run,assertRun,terminal}=require('../qa/four-maps/helpers.cjs');
test('cascade has six alternating physical rows of three 30-degree open shelves',()=>{
 terminal('cascade');const shelves=P.MAPS.cascade.obstacles.filter(o=>o.role==='shelf');assert.equal(shelves.length,18);
 for(let row=0;row<6;row++)for(const o of shelves.slice(row*3,row*3+3)){const degrees=Math.atan2(o.y2-o.y1,o.x2-o.x1)*180/Math.PI;assert.ok(Math.abs(degrees-(row%2?-30:30))<1e-8);assert.ok(Math.min(o.x1,o.x2)-o.thickness-36>=96);assert.ok(964-Math.max(o.x1,o.x2)-o.thickness>=96);}
});
test('cascade completes 1..500 marbles with terrain only and deterministic frame grouping',()=>{
 for(const n of [1,2,6,50,200,500])assertRun(run('cascade',n,'fourmaps-dev-cascade-smoke-'+n));
 assert.deepEqual(run('cascade',6,'repeat',{},null,[1]).ranking,run('cascade',6,'repeat',{},null,[2,4,1]).ranking);
});
