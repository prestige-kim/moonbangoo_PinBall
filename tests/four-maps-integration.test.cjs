'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),boot=require('../qa/sim/controller-fixture.cjs');
test('four maps restore saved choice, preserve map on restart, and replay captured start exactly',()=>{
 for(const map of ['classic','twinfold','cascade','rhythm']){
  const saved=new Map([['mungbanggu-pinball-settings-v2',JSON.stringify({map,names:'빨강*2,초록*2,파랑*2',skills:true})]]),s=boot({getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}),app=s.P.app;
  assert.equal(app.settings.map,map);assert.equal(Object.keys(s.P.MAPS).length,4);assert.equal(app.settings.skills,map==='classic');s.callbacks.start();s.launch();s.advance(160);assert.equal(app.status,'finished');assert.equal(app.ui.results.map,map);
  const first=JSON.stringify(app.physics.finished.map(m=>[m.id,m.finishTime])),config=app.runSettings,start=JSON.parse(JSON.stringify(app.physics.handStart));app.ui.load({...config,replayStart:start,quality:'low',reducedMotion:true});s.callbacks.replay();s.callbacks.start();assert.equal(app.status,'running');s.advance(160,30);assert.equal(JSON.stringify(app.physics.finished.map(m=>[m.id,m.finishTime])),first);
  s.callbacks.restart();assert.equal(app.runSettings.map,map);assert.equal(app.status,'mixing');
 }
});
test('each rule agrees with arrivals, and stopping before its condition is met keeps winners unresolved',()=>{
 for(const map of ['classic','twinfold','cascade','rhythm'])for(const rule of ['first','last','nth','top']){
  const s=boot(),a=s.P.app;a.ui.load({...a.ui.readSettings(),map,rule,rankN:3});s.callbacks.change(a.ui.readSettings());s.callbacks.start();s.launch();s.advance(160);assert.equal(a.ui.results.ruleLabel,s.P.ruleLabel(a.runSettings));assert.deepEqual(Array.from(a.ui.results.winners,m=>m.id),Array.from(s.P.chooseWinners(a.physics.finished,a.runSettings),m=>m.id));
  s.callbacks.restart();s.launch();while(a.status==='running'&&!a.physics.finished.length)s.advance(.05);s.callbacks.stop();s.advance(2);assert.equal(a.status,'finished');assert.equal(a.ui.results.stoppedEarly,true);assert.ok(a.ui.results.ranking.length>=1);if(rule!=='first')assert.equal(a.ui.results.winners.length,0);
 }
});
test('unknown persisted map ID falls back and wrong-map hand records are rejected',()=>{
 const s=boot({getItem:k=>k==='mungbanggu-pinball-settings-v2'?JSON.stringify({map:'__proto__'}):null,setItem(){}});assert.equal(s.P.app.settings.map,'classic');
 const a=s.P.app;s.callbacks.start();s.launch();const record=a.physics.handStart,map=s.P.MAPS.twinfold,p=new s.P.Physics({map,names:s.P.parseNames(a.runSettings.names),seed:a.runSettings.seed});assert.throws(()=>s.P.restoreHandStart(p,record));
});
