const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{},Math};vm.createContext(box);
for(const name of ['shuffle','throw-gate'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+name+'.js','utf8'),box);
const {ThrowGate,HandShuffle,THROW_THRESHOLDS:T}=box.window.CosmicPinball;
const make=()=>new ThrowGate();

test('wall exit thresholds use the visible rounded enclosure, without speed or travel gates',()=>{
 assert(Object.isFrozen(T));assert.equal(T.edgeBand,.14);assert.equal(T.corner,.10);
 assert.equal(T.travel,undefined);assert.equal(T.releaseBand,undefined);assert.equal(T.outwardSpeed,undefined);
});
test('an actual inside-to-outside drag is consumed immediately and exactly once',()=>{
 for(const time of [40,1600,9000]){const g=make();g.begin(0,0,0);g.move(.37,0,time,true);
  const d=g.takeExit(time);assert(d.fired);assert.equal(g.active,false);assert.equal(g.takeExit(time+1).fired,false);
  assert.equal(g.release(.43,0,time+100,true).fired,false);
 }
});
test('a short contacting drag through the wall exits, while inside movement and touching the line do not',()=>{
 const g=make();g.begin(.34,0,0);g.move(.36,0,100,true);assert.equal(g.takeExit(100).fired,false);
 g.move(.365,0,200,true);assert(g.takeExit(200).fired,'no minimum fling length or speed');
 const inside=make();inside.begin(0,0,0);inside.move(.33,0,1000,true);assert.equal(inside.release(.33,0,2000,true).fired,false);
});
test('outside clicks and untouched empty-space movement cannot exit; entering the group then exiting works',()=>{
 for(const points of [[[.4,0,0],[.43,0,100,true]],[[0,0,0],[.43,0,100,false]],[[.4,0,0],[.4,0,100,false]]]){
  const g=make();g.begin(...points[0]);g.move(...points[1]);assert.equal(g.takeExit(100).fired,false);assert.equal(g.release(...points[1]).fired,false);
 }
 const g=make();g.begin(.43,0,0);g.move(0,0,1000,true);g.move(-.38,0,2000,true);assert(g.takeExit(2000).fired);
});
test('inside circular and boundary-adjacent input never launches and cancellation preserves that policy',()=>{
 const g=make();g.begin(0,0,0);
 for(let i=1;i<=60;i++){g.move(.33*Math.cos(i),.33*Math.sin(i),i*20,true);assert.equal(g.takeExit(i*20).fired,false);}
 g.cancel();assert.equal(g.release(.5,0,2000,true).fired,false);
});
test('crossing directions are stable and render evaluations do not consume or alter exit state',()=>{
 const output=[];
 for(const frames of [[],[5,10,20,100,900,1200],Array.from({length:200},(_,i)=>i*20)]){
  const g=make();g.begin(0,0,0);g.move(.4,-.12,1000,true);for(const t of frames)g.evaluate(t);
  const d=g.takeExit(1000);assert(d.fired);assert(Math.abs(Math.hypot(d.dx,d.dy)-1)<1e-8);output.push(JSON.stringify(d));
 }
 assert.equal(new Set(output).size,1);
});
test('cancel, backward and duplicate timestamps cannot manufacture exit or infinite speed',()=>{
 const g=make();g.begin(0,0,100);assert.equal(g.move(.4,0,100,true),false);assert.equal(g.takeExit(100).fired,false);
 g.move(.4,0,200,true);assert.equal(g.release(.4,0,150,true).fired,false);
 g.begin(0,0,300);g.move(.4,0,400,true);g.cancel();assert.equal(g.takeExit(500).fired,false);
 for(const args of [[NaN,0,0],[0,Infinity,0],[0,0,-1]])assert.equal(g.begin(...args),false);
});
test('all screen shapes and rounded corners exit before reaching the browser border',()=>{
 for(const [w,h] of [[1280,720],[390,844],[844,390]])for(const dir of [[1,0],[-1,0],[0,1],[0,-1]]){
  const area={w,h,s:Math.min(w-32,h-48)},g=make();g.begin(0,0,0,area);
  const x=dir[0]*(g.bounds.halfWidth-.08),y=dir[1]*(g.bounds.halfHeight-.08);
  g.move(x,y,2000,true);assert(g.takeExit(2000).fired);
  assert(Math.abs(x)<g.bounds.halfWidth&&Math.abs(y)<g.bounds.halfHeight);
 }
 const g=make();g.begin(0,0,0);g.move(.32,.32,1000,true);assert.equal(g.takeExit(1000).fired,false);
 g.move(.34,.34,1100,true);assert(g.takeExit(1100).fired);
});
test('actual per-body impulse enables the same exit event across all counts and frame groupings',()=>{
 for(const n of [6,50,200,500])for(const grouping of [0,1,4]){
  const c=new HandShuffle(Array.from({length:n},(_,i)=>({id:'ball-'+i})),'WALL-INPUT-'+n),g=make();
  c.begin(0,0,0);g.begin(0,0,0);let exitTick;
  for(let i=1;i<=20;i++){
   const x=.42*i/20,contact=c.move(x,0,i*50);g.move(x,0,i*50,contact);
   for(let tick=0;tick<grouping;tick++)c.step();
   if(g.takeExit(i*50).fired){exitTick=i;break;}
  }
  assert.equal(exitTick,18,n+' grouping '+grouping+' consumes first outside sample');
 }
});
