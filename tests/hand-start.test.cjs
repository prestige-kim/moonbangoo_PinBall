const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{},Math};vm.createContext(box);
for(const f of ['maps','physics','shuffle','hand-start']){const path=__dirname+'/../js/'+f+'.js';if(fs.existsSync(path))vm.runInContext(fs.readFileSync(path,'utf8'),box);}
const P=box.window.CosmicPinball;
function setup(n=6,radius=11){const physics=new P.Physics({names:P.parseNames('참가자*'+n),seed:'ACTUAL-HAND-'+n,radius});const hand=new P.HandShuffle(physics.marbles,physics.seed);return{physics,hand};}
const snapshot=p=>JSON.stringify(p.marbles.map(m=>[m.id,m.x,m.y,m.vx,m.vy]));
test('top scatter is independent of gesture location and covers the map width',()=>{
 const a=setup(),b=setup();for(const body of b.hand.bodies){body.x=-body.x+2;body.y=-body.y;}
 P.commitHandStart(a.physics,a.hand.bodies);P.commitHandStart(b.physics,b.hand.bodies);
 assert.equal(snapshot(a.physics),snapshot(b.physics));
 const xs=a.physics.marbles.map(m=>m.x);assert(Math.max(...xs)-Math.min(...xs)>a.physics.map.spawn.width*.6);
});
test('launch mapping is ID-based, consumes no race RNG and commits once',()=>{
 const a=setup(50),b=setup(50);let calls=0;const random=a.physics.random;a.physics.random=()=>{calls++;return random();};
 P.commitHandStart(a.physics,a.hand.bodies.slice().reverse());P.commitHandStart(b.physics,b.hand.bodies);
 assert.equal(snapshot(a.physics),snapshot(b.physics));assert.equal(calls,0);assert.equal(a.physics.time,0);assert.equal(a.physics.ticks,0);
 const before=snapshot(a.physics);for(const p of a.hand.bodies)p.x+=.3;P.commitHandStart(a.physics,a.hand.bodies);assert.equal(snapshot(a.physics),before);
});
test('6/50/200/500 launch snapshots fit the true spawn rectangle without deep overlap',()=>{
 for(const n of [6,50,200,500])for(const radius of [8,11,16]){
  const s=setup(n,radius);s.hand.begin(0,0,0);
  for(let i=1;i<=120;i++){s.hand.move(.27*Math.sin(i*.12),.22*Math.cos(i*.15),i*1000/120);s.hand.step(1/120);}
  P.commitHandStart(s.physics,s.hand.bodies);const spawn=s.physics.map.spawn;let worst=0;
  for(let i=0;i<n;i++){const a=s.physics.marbles[i];assert([a.x,a.y,a.vx,a.vy].every(Number.isFinite));assert(a.x-a.r>=spawn.x-1e-8&&a.x+a.r<=spawn.x+spawn.width+1e-8);assert(a.y-a.r>=spawn.y-1e-8&&a.y+a.r<=spawn.y+spawn.height+1e-8);assert.equal(a._anchorY,a.y);assert(Math.hypot(a.vx,a.vy)<=120+1e-8);
   for(let j=0;j<i;j++){const b=s.physics.marbles[j];worst=Math.max(worst,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));}}
  assert(worst<.015,'deep overlap '+n+' radius '+radius+': '+worst);
 }
});
test('same seed plus captured hand snapshot replays all finish IDs and times',()=>{
 for(const n of [6,50,200,500]){const a=setup(n),b=setup(n);P.commitHandStart(a.physics,a.hand.bodies);P.commitHandStart(b.physics,a.hand.bodies);
  const run=p=>{for(let i=0;i<30000&&!p.complete;i++)p.step(1/120);assert(p.complete);return JSON.stringify(p.finished.map(m=>[m.id,m.finishTime]));};assert.equal(run(a.physics),run(b.physics));}
});
test('different round seeds produce different top scatter endpoints',()=>{
 const layouts=new Set();for(let variant=0;variant<5;variant++){
  const physics=new P.Physics({names:P.parseNames('귤*4,수박*2,키위*2'),seed:'TOP-SCATTER-'+variant,radius:11});
  const hand=new P.HandShuffle(physics.marbles,physics.seed);P.commitHandStart(physics,hand.bodies);layouts.add(snapshot(physics));
 }assert.equal(layouts.size,5);
});
test('invalid hand ownership or coordinates cannot partially mutate race state',()=>{
 for(const variant of ['missing','duplicate','nonfinite','pouring']){const s=setup(),before=snapshot(s.physics);if(variant==='missing')s.hand.bodies.pop();if(variant==='duplicate')s.hand.bodies[0].id=s.hand.bodies[1].id;if(variant==='nonfinite')s.hand.bodies[0].x=NaN;if(variant==='pouring')s.hand.bodies[0].pouring=true;assert.throws(()=>P.commitHandStart(s.physics,s.hand.bodies));assert.equal(snapshot(s.physics),before);}
});

// Gesture-dependent slot ownership was retired by the top-scatter-v2 protocol.
