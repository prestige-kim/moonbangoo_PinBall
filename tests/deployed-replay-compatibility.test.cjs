'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{loadPhysics}=require('../qa/sim/adapter.cjs');
// Captured with the verified deployed source in the same Node runtime, never the candidate.
const deployed=require('../docs/easier-launch/deployed-replay-node-baseline.json');
test('the wider outlet and group metadata retain deployed-source validation and exact results for existing v2 recordings in the same runtime',()=>{
 const P=loadPhysics();
 for(const row of deployed.records){
  const settings=row.settings,p=new P.Physics({...settings,map:P.MAPS[row.map],names:P.parseNames(settings.names)});
  if(row.error){assert.throws(()=>P.restoreHandStart(p,row.record),error=>error.message===row.error,row.map);continue;}
  P.restoreHandStart(p,row.record);
  while(!p.complete&&p.time<240){p.step();p.drainEvents();}
  assert(p.complete,row.map);
  assert.deepEqual(p.finished.map(m=>[m.id,m.finishTime]),row.ranking,row.map);
 }
});
