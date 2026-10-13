'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{loadPhysics}=require('../qa/sim/adapter.cjs'),boot=require('../qa/sim/controller-fixture.cjs');
const P=loadPhysics();
test('50 is the shared participant limit; parser, combined groups and direct physics reject 51',()=>{
 assert.equal(P.MAX_MARBLES,50);for(const text of ['공*50','빨강*25,파랑*25'])assert.equal(P.parseNames(text).length,50);
 for(const text of ['공*51','공*500','빨강*25,파랑*26'])assert.throws(()=>P.parseNames(text),/50/);
 assert.throws(()=>P.colorNames({red:25,blue:26}),/50/);
 for(const map of Object.values(P.MAPS)){assert.equal(new P.Physics({map,names:P.parseNames('공*50')}).marbles.length,50);assert.throws(()=>new P.Physics({map,names:Array.from({length:51},(_,i)=>({id:'m'+i,name:'공'}))}),/50/);}
});
test('oversized saved settings reset participants and replay while preserving map, physics and sound',()=>{
 for(const map of ['classic','twinfold','cascade','rhythm']){
 const saved=JSON.stringify({map,names:'빨강*500',seed:'obsolete',replayStart:{version:2},radius:16,gravity:350,restitution:.92,sound:false,volume:.2});
 const s=boot({getItem:k=>k==='mungbanggu-pinball-settings-v2'?saved:null,setItem(){}}),a=s.P.app;
 assert.equal(s.P.parseNames(a.settings.names).length,6);assert.equal(a.settings.map,map);assert.equal(a.settings.seed,'');assert.equal(a.settings.replayStart,null);assert.equal(a.settings.radius,16);assert.equal(a.settings.sound,false);assert.equal(a.settings.volume,.2);assert.equal(a.settings.participantReset,true);
 }
});
test('a forged 51-participant start fails visibly without starting or allocating an oversized race',()=>{
 const s=boot(),a=s.P.app;a.ui.values.names='공*51';s.callbacks.start();assert.equal(a.status,'setup');assert(a.ui.errors.some(e=>String(e).includes('50')));assert(a.physics.marbles.length<=50);
});
