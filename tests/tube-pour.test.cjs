const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{},document:{},Math,performance};vm.createContext(box);
for(const f of ['maps','physics','cinematic','shuffle','throw-gate','hand-scene'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),box);
const P=box.window.CosmicPinball,counts=[6,50,200,500],sizes=[[1280,720],[390,844],[844,390],[320,568]];
function setup(n,w=1280,h=720,reduced=false){
 const physics=new P.Physics({map:P.MAPS.classic,names:P.parseNames('구슬*'+n),seed:'POUR-QA-'+n});
 const ctx=new Proxy({createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};}},{get:(o,k)=>o[k]||(()=>{})});
 const cinema=Object.assign(Object.create(P.Cinematic.prototype),{width:w,height:h,canvas:{dataset:{}},ctx,resize(){},drawPlate(){},drawGlass(){},drawOrb(){},drawLabel(){}});
 const scene=new P.HandScene(cinema);scene.gate=new P.ThrowGate();scene.begin(physics,reduced);return{scene,cinema,physics};
}
const slots=p=>JSON.stringify(p.marbles);
function finish(scene,fps=60){for(let i=0;i<Math.ceil(4*fps);i++)scene.update(1/fps);assert(scene.ready);}
test('pour renders use shared geometry rather than repeated plate registrations per ball',()=>{
 const s=setup(500);s.scene.update(.05);let calls=0;const original=P.CINEMA.matchedViews;
 P.CINEMA.matchedViews=(...args)=>{calls++;return original(...args);};
 try{s.scene.render({physics:s.physics});assert(calls<=2,'plate registrations in one frame: '+calls);}finally{P.CINEMA.matchedViews=original;}
});
test('tube exit and freefall share position and tangent velocity for all IDs and screens',()=>{
 for(const n of counts)for(const [w,h]of sizes)for(const reduced of [false,true]){
  const s=setup(n,w,h,reduced),a=s.scene.area();
  for(let i=0;i<n;i++){
   const t=s.scene.pours[i].release,e=1e-6,before=s.scene.tubePose(i,t-e,a),at=s.scene.tubePose(i,t,a),fall=s.scene.fallingPose(i,t,a),after=s.scene.fallingPose(i,t+e,a);
   assert(Math.hypot(at.x-fall.x,at.y-fall.y)<1e-10);
   const velocity={x:(at.x-before.x)/e,y:(at.y-before.y)/e};
   assert(Math.hypot(velocity.x-fall.vx,velocity.y-fall.vy)<.015,'release tangent '+n);
   assert(Math.hypot((after.x-fall.x)/e-fall.vx,(after.y-fall.y)/e-fall.vy)<.0001);
  }
 }
});
test('pouring keeps balls on screen, finite, unique and never changes race state',()=>{
 for(const n of counts)for(const [w,h]of sizes)for(const reduced of [false,true]){
  const s=setup(n,w,h,reduced),before=slots(s.physics);let offscreen=0;
  for(let f=0;f<200;f++){
   s.scene.update(1/60);s.scene.render({physics:s.physics,reducedMotion:reduced});
   for(const p of s.scene.lastPoses){assert([p.x,p.y,p.radius].every(Number.isFinite));if(p.x+p.radius<0||p.x-p.radius>w||p.y+p.radius<0||p.y-p.radius>h)offscreen++;}
  }
  assert.equal(offscreen,0,n+' '+w+'x'+h+' pouring balls must remain visible');
  assert(s.scene.ready);assert.equal(new Set(s.scene.lastPoses.map(p=>p.id)).size,n);assert.equal(slots(s.physics),before);assert.equal(s.physics.time,0);
 }
});
test('all deposited circles meet closed walls and avoid deep overlap',()=>{
 for(const n of counts)for(const [w,h]of sizes){
  const s=setup(n,w,h);finish(s.scene);const c=s.scene.shuffle;let worst=0;
  for(let i=0;i<n;i++){const b=c.bodies[i];assert(!b.pouring);assert(b.x-b.r>=c.bounds.outer.left-1e-8&&b.x+b.r<=c.bounds.outer.right+1e-8&&b.y-b.r>=c.bounds.outer.top-1e-8&&b.y+b.r<=c.bounds.outer.bottom+1e-8);
   for(let j=0;j<i;j++){const a=c.bodies[j];worst=Math.max(worst,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));}
  }assert(worst<.05,'deep deposited overlap '+worst);if(n>6)assert(c.collisions>0);
 }
});
test('different render rates and motion changes preserve slots, IDs and readiness',()=>{
 for(const n of counts){let baseline;
  for(const fps of [24,30,60,120])for(const reduced of [false,true]){
   const s=setup(n,390,844,reduced),before=slots(s.physics);finish(s.scene,fps);
   const positions=JSON.stringify(s.scene.shuffle.snapshot());s.scene.render({physics:s.physics,reducedMotion:!reduced});assert.equal(JSON.stringify(s.scene.shuffle.snapshot()),positions);
   s.cinema.commitHandSlots(s.physics);const actual=slots(s.physics);if(baseline)assert.equal(actual,baseline);else baseline=actual;
   assert.equal(s.physics.time,0);assert.equal(s.physics.ticks,0);assert.equal(new Set(s.scene.shuffle.bodies.map(b=>b.id)).size,n);assert(before);
  }
 }
});
test('large resume delta cannot skip the pour or manufacture input readiness',()=>{const s=setup(6);s.scene.update(120);assert(s.scene.elapsed<=.05);assert(!s.scene.ready);assert(s.scene.shuffle.bodies.every(b=>b.pouring));});


test('after tilting, the whole occupied tube fits the viewport and freefall never rises upward',()=>{
 for(const n of counts)for(const [w,h]of sizes)for(const reduced of [false,true]){
  const s=setup(n,w,h,reduced),a=s.scene.area(),rig=s.scene.rigAt(.8,a),dx=Math.cos(rig.rotation),dy=Math.sin(rig.rotation);
  for(const x of [-1.05,.49])for(const y of [-.62,.62]){const px=a.x+(rig.x+x*rig.length*dx-y*rig.thickness*dy)*a.s,py=a.y+(rig.y+x*rig.length*dy+y*rig.thickness*dx)*a.s;assert(px>=0&&px<=w&&py>=0&&py<=h,'whole tube is visible');}
  for(let i=0;i<n;i++)for(let frame=0;frame<=20;frame++){const p=s.scene.pours[i],t=p.release+(p.arrival-p.release)*frame/20;assert(s.scene.fallingPose(i,t,a).vy>=-1e-7,'a pouring ball falls down rather than reversing in the air');}
 }
});


test('deposition hands the exact falling location and velocity to the existing collision solver',()=>{
 for(const n of counts){const s=setup(n),c=s.scene.shuffle,step=c.step.bind(c),seen=new Set();
  c.step=dt=>{for(let i=0;i<n;i++){const b=c.bodies[i];if(b.pouring||seen.has(b.id))continue;seen.add(b.id);const a=s.scene.area(),p=s.scene.pours[i],incoming=s.scene.fallingPose(i,p.arrival,a),zoom=s.scene.viewScale;assert(Math.hypot(b.x*zoom-incoming.x,b.y*zoom-incoming.y)<1e-10);assert(Math.hypot(b.vx*zoom-incoming.vx,b.vy*zoom-incoming.vy)<1e-10);}step(dt);};
  finish(s.scene);assert.equal(seen.size,n);
 }
});
