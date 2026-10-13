'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P,run,assertRun,terminal,assertGaps}=require('../qa/four-maps/helpers.cjs');
test('rhythm has exactly six tick-driven opposed bars with open central and lateral routes throughout a cycle',()=>{
 terminal('rhythm');const map=P.MAPS.rhythm,bars=map.obstacles.filter(o=>o.type==='moving');assert.equal(bars.length,6);const p=new P.Physics({map,names:P.parseNames('공'),skills:true});assert.equal(p.skills,false);
 for(let i=0;i<bars.length;i+=2){const a=bars[i],b=bars[i+1];assert.equal(a.length,160);assert.equal(a.thickness,8);assert.equal(a.amplitude,55);assert.equal(a.speed,.8);assert.ok(Math.abs(b.phase-a.phase-Math.PI)<1e-9);
  for(let tick=0;tick<=960;tick++){p.time=tick/120;const l=p.getObstaclePose(a),r=p.getObstaclePose(b),left=Math.max(l.x1,l.x2)+a.thickness,right=Math.min(r.x1,r.x2)-b.thickness;assert.ok(right-left>=96);assert.ok(Math.min(l.x1,l.x2)-a.thickness-36>=96);assert.ok(964-Math.max(r.x1,r.x2)-b.thickness>=96);assert.ok(Math.abs(l.vx)<=44+1e-9);assert.ok(Math.abs(l.vx+r.vx)<1e-8);}
 }
});
test('rhythm completes 1..500 balls without force recovery, and grouping does not change results',()=>{
 for(const n of [1,2,6,50,200,500])assertRun(run('rhythm',n,'fourmaps-dev-rhythm-smoke-'+n));
 assert.deepEqual(run('rhythm',6,'repeat',{},null,[1]).ranking,run('rhythm',6,'repeat',{},null,[4,2,1]).ranking);
});

test("rhythm keeps physical gaps >=96 including the walls and full motion cycle",()=>assertGaps("rhythm"));
