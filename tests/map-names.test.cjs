'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{P}=require('../qa/four-maps/helpers.cjs');
test('course display names change without invalidating a captured start',()=>{
 for(const id of ['classic','twinfold','cascade','rhythm']){
  const p=new P.Physics({map:P.MAPS[id],names:P.parseNames('공'),seed:'name-replay-'+id});
  const record=P.commitHandStart(p,[{id:p.marbles[0].id,x:0,y:0,vx:0,vy:0,r:12}]);
  const info=P.mapInfo(id),old=info.name;info.name='표시 이름 변경';
  const replay=new P.Physics({map:P.MAPS[id],names:P.parseNames('공'),seed:p.seed});
  assert.doesNotThrow(()=>P.restoreHandStart(replay,record));info.name=old;
 }
});
