'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {loadPhysics}=require('../qa/sim/adapter.cjs'),P=loadPhysics();
const fixture=require('./fixtures/classic-preserved-main.json');
test('original classic terrain and old recorded results remain auditable beneath versioned additions',()=>{
  const oldMap=JSON.parse(JSON.stringify(P.MAPS.classic));oldMap.obstacles=oldMap.obstacles.filter(o=>!o.id.startsWith('classic-detail-'));delete oldMap.version;
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(oldMap)).digest('hex'),fixture.mapHash);
  for(const c of fixture.cases){const p=new P.Physics({map:oldMap,names:P.parseNames('빨강*2,초록*2,파랑*2'),seed:c.seed});P.restoreHandStart(p,c.start);while(!p.complete&&p.time<240){p.step();p.drainEvents();}assert.equal(p.complete,true);assert.deepEqual(p.finished.map(m=>[m.id,m.finishTime]),c.ranking);assert.equal(p.time,c.time);const revised=new P.Physics({map:P.MAPS.classic,names:P.parseNames('빨강*2,초록*2,파랑*2'),seed:c.seed});assert.throws(()=>P.restoreHandStart(revised,c.start));}
});
test('unregistered and prototype map IDs fall back safely; new-map policy cannot be bypassed by saved skills',()=>{
  for(const id of ['missing','__proto__','constructor',null])assert.equal(P.resolveMapId(id),'classic');
  const map={...P.MAPS.classic,id:'policy-fixture',obstacles:[]};P.registerMap(map,{name:'Policy',accent:'#000'});
  const p=new P.Physics({map,names:P.parseNames('공'),seed:'policy',skills:true});assert.equal(p.skills,false);
  p.marbles[0]._stuckAt=-20;const before=p.marbles[0]._rescues;p.step();assert.equal(p.marbles[0]._rescues,before);assert.equal(p.drainEvents().some(e=>e.type==='skill'||e.type==='rescue'),false);
  assert.equal(new P.Physics({map:P.MAPS.classic,names:P.parseNames('공'),skills:true}).skills,true);
});
test('unmeasured courses never borrow classic duration samples',()=>{
  new Function('window',fs.readFileSync('js/race-duration.js','utf8'))({CosmicPinball:P});P.RACE_DURATION_SAMPLES=[{map:'classic',count:6,radius:12,gravity:620,restitution:.72,skills:false,p50:50,p95:60,max:70}];
  assert.equal(P.estimateRaceDuration({map:'policy-fixture',skills:false,speed:1,radius:12,gravity:620,restitution:.72},6),null);
});
