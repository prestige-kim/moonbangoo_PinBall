'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const context = { window: {}, console }; vm.createContext(context);
for (const file of ['maps.js','physics.js']) vm.runInContext(fs.readFileSync('js/'+file,'utf8'),context);
const P = context.window.CosmicPinball;
const groups = [{id:'red',name:'1반, A*팀',color:'blue',count:2},{id:'custom-1',name:'선생님팀',color:'red',count:1}];
test('typed names with punctuation retain identity, count and explicit colors',()=>{
 const text=P.writeGroups(groups), entries=P.parseNames(text);
 assert.equal(entries.length,3); assert.equal(entries[0].name,'1반, A*팀'); assert.equal(entries[0].groupColor,'blue'); assert.equal(entries[2].groupId,'custom-1');
 const game=new P.Physics({names:entries,map:P.MAPS.classic,seed:'groups'});
 assert.equal(game.marbles[0].groupColor,'blue'); assert.equal(game.marbles[2].name,'선생님팀');
 assert.equal(P.writeGroups(P.readGroups(text)),text);
});
test('legacy color and named groups preserve order, multiplicity and labels',()=>{
 for(const text of ['빨강*2,초록*2,파랑*2','1반*3,교사*2','[특별팀]']) {
  const before=P.parseNames(text),after=P.parseNames(P.writeGroups(P.readGroups(text)));
  assert.deepEqual(Array.from(after,e=>[e.id,e.name,e.copy,e.copies]),Array.from(before,e=>[e.id,e.name,e.copy,e.copies]));
 }
});
test('invalid structured groups never enter a draw',()=>{
 for(const patch of [{name:''},{name:'   '},{name:'a'.repeat(41)},{name:'<img>'},{name:'a\nb'},{count:0},{count:51},{count:1.5},{color:'unknown'},{id:'__proto__'}]) assert.throws(()=>P.parseNames(P.writeGroups([{...groups[0],...patch}])));
 assert.throws(()=>P.parseNames(P.writeGroups([groups[0],{...groups[1],name:groups[0].name}])));
 assert.throws(()=>P.parseNames(P.writeGroups([{...groups[0],name:'é'},{...groups[1],name:'e\u0301'}])));
 assert.throws(()=>P.parseNames(P.writeGroups([])));
 assert.equal(P.parseNames(P.writeGroups([{...groups[0],count:50}])).length,50);
});
test('renaming and recoloring leave seeded initial physics unchanged',()=>{
 const legacy=P.parseNames('빨강*2,초록*2,파랑*2');
 const named=P.parseNames(P.writeGroups(P.readGroups('빨강*2,초록*2,파랑*2').map((g,i)=>({...g,name:'팀 '+i,color:'black'}))));
 const make=names=>new P.Physics({names,map:P.MAPS.classic,seed:'same-seed'});
 const a=make(legacy),b=make(named);
 for(let i=0;i<1000;i++){a.step();a.drainEvents();b.step();b.drainEvents();}
 assert.deepEqual(Array.from(a.marbles,m=>[m.id,m.x,m.y,m.vx,m.vy]),Array.from(b.marbles,m=>[m.id,m.x,m.y,m.vx,m.vy]));
});
