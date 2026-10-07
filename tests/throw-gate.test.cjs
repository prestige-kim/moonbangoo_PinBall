const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const box = { window: {}, Math }; vm.createContext(box);
for (const name of ['shuffle', 'throw-gate']) vm.runInContext(fs.readFileSync(__dirname + '/../js/' + name + '.js', 'utf8'), box);
const { ThrowGate, HandShuffle, THROW_THRESHOLDS: T } = box.window.CosmicPinball;
const make = () => new ThrowGate();
const near = (a,b) => assert(Math.abs(a-b)<1e-8,a+' vs '+b);

test('public edge thresholds replace the mandatory speed gate',()=>{
 assert(Object.isFrozen(T)); assert.equal(T.travel,.20); assert.equal(T.edgeBand,.14); assert.equal(T.releaseBand,.19);
 assert.equal(T.outwardSpeed,undefined);
});
test('slow actual interaction and a stopped ready hand both release exactly once',()=>{
 for(const hold of [0,250,5000]){const g=make();g.begin(0,0,0);g.move(.40,0,1600,true);
  assert.equal(g.evaluate(1600+hold).eligible,true);const d=g.release(.40,0,1600+hold,true);
  assert.equal(d.fired,true);assert.equal(g.release(.40,0,1700+hold,true).fired,false);assert.equal(g.evaluate(2000+hold).eligible,false);
 }
});
test('edge clicks, short movements and empty-space gestures cannot arm',()=>{
 for(const points of [[[.40,0,0],[.40,0,100,true]],[[.34,0,0],[.41,0,50,true]],[[0,0,0],[.45,0,50,false]],[[0,0,0],[.25,0,500,true]]]){
  const g=make();g.begin(...points[0]);g.move(...points[1]);assert.equal(g.evaluate(1000).eligible,false);
  assert.equal(g.release(...points[1]).fired,false);
 }
});
test('hysteresis holds boundary jitter but clears a real inward retreat',()=>{
 const g=make();g.begin(0,0,0);g.move(.37,0,400,true);assert(g.evaluate(400).eligible);
 for(const x of [.35,.34,.32,.35]){g.move(x,0,500);assert(g.evaluate(500).eligible);}
 g.move(.29,0,600);assert.equal(g.evaluate(600).eligible,false);
 g.move(.35,0,700);assert.equal(g.evaluate(700).eligible,false,'must re-enter the outer threshold');
 g.move(.37,0,800);assert(g.evaluate(800).eligible);
});
test('interaction and readiness belong to one gesture, not future edge clicks',()=>{
 const g=make();g.begin(0,0,0);g.move(.4,0,100,true);g.cancel();g.begin(.4,0,200);
 assert.equal(g.release(.4,0,300).fired,false);assert.equal(g.interacted,false);
});
test('the direction shown while stopped is the exact release direction',()=>{
 const g=make();g.begin(0,0,0);g.move(.39,-.12,800,true);const ready=g.evaluate(9000);
 assert(ready.eligible);near(Math.hypot(ready.dx,ready.dy),1);
 const released=g.release(.39,-.12,9000);near(released.dx,ready.dx);near(released.dy,ready.dy);assert(released.fired);
});
test('render evaluations never advance or change input readiness',()=>{
 const output=[];
 for(const frames of [[],[5,10,20,100,900,1200],Array.from({length:200},(_,i)=>i*20)]){
  const g=make();g.begin(0,0,0);g.move(.4,0,1000,true);for(const t of frames)g.evaluate(t);
  output.push(JSON.stringify(g.release(.4,0,1300)));
 }
 assert.equal(new Set(output).size,1);
});
test('cancel, backward and duplicate timestamps cannot manufacture launch or infinite speed',()=>{
 const g=make();g.begin(0,0,100);assert.equal(g.move(.4,0,100,true),false);assert.equal(g.evaluate(100).eligible,false);
 g.move(.4,0,200,true);assert.equal(g.release(.4,0,150,true).fired,false);
 g.begin(0,0,300);g.move(.4,0,400,true);g.cancel();assert.equal(g.release(.4,0,500,true).fired,false);
 for(const args of [[NaN,0,0],[0,Infinity,0],[0,0,-1]])assert.equal(g.begin(...args),false);
});
test('all screen shapes have an accessible edge band and rounded corner retention',()=>{
 for(const [w,h] of [[1280,720],[390,844],[844,390]])for(const dir of [[1,0],[-1,0],[0,1],[0,-1]]){
  const area={w,h,s:Math.min(w-32,h-48)},g=make();g.begin(0,0,0,area);
  const x=dir[0]*(g.bounds.halfWidth-.08),y=dir[1]*(g.bounds.halfHeight-.08);
  g.move(x,y,2000,true);const d=g.evaluate(9000);assert(d.eligible);assert(d.edgeX!==undefined);
  assert(Math.abs(x)<g.bounds.halfWidth&&Math.abs(y)<g.bounds.halfHeight,'no need to leave the viewport');
  assert(g.release(x,y,9000).fired);
 }
 const g=make();g.begin(0,0,0);g.move(.36,.36,1000,true);assert(g.evaluate(1000).eligible);
 g.move(.20,.20,1100);assert.equal(g.evaluate(1100).eligible,false);
});
test('the edge readiness certificate is an actual per-body input impulse at every count',()=>{
 for(const n of [6,50,200,500])for(const grouping of [0,1,4]){
  const c=new HandShuffle(Array.from({length:n},(_,i)=>({id:'ball-'+i})),'EDGE-INPUT-'+n),g=make();
  c.begin(0,0,0);g.begin(0,0,0);
  for(let i=1;i<=20;i++){const x=.42*i/20,contact=c.move(x,0,i*50);g.move(x,0,i*50,contact);for(let tick=0;tick<grouping;tick++)c.step();g.evaluate(i*50+20);}
  assert(c.interacted);assert(g.release(.42,0,1500,c.interacted).fired,n+' grouping '+grouping);
 }
});
