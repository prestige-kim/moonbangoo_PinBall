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

function advance(scene,seconds,fps=60){for(let i=0;i<Math.round(seconds*fps);i++)scene.update(1/fps);}
function tilt(scene){const r=scene.rigAt(scene.elapsed,scene.area()),p={x:r.x+r.length*.4,y:r.y,time:1000};assert(scene.beginTilt(p));scene.releaseTilt({...p,x:r.x+r.length*.12,y:r.y+r.length*.45});}
function finish(scene,fps=60){advance(scene,1,fps);tilt(scene);for(let i=0;i<40*fps&&!scene.ready;i++)scene.update(1/fps);assert(scene.ready,'all physical balls leave the tube');}
test('welcome spheres rest on supported floor layers instead of floating random positions',()=>{
 for(const n of counts){const s=setup(n),ch=s.cinema.chamber;let worst=0;
  for(let i=0;i<n;i++){const b=ch.bodies[i];let supported=Math.abs(b.y+b.r-1)<1e-8;
   assert.equal(b.vx,0);assert.equal(b.vy,0);
   for(let j=0;j<n;j++){if(i===j)continue;const a=ch.bodies[j],d=Math.hypot(a.x-b.x,a.y-b.y);worst=Math.max(worst,(a.r+b.r-d)/(a.r+b.r));if(a.y>b.y&&Math.abs(d-a.r-b.r)<1e-8)supported=true;}
   assert(supported,'every ball rests on glass or another ball');
  }assert(worst<1e-8,'no initial overlap');
 }
});
test('lift waits indefinitely for an actual touch and rejects touches outside the tube',()=>{
 for(const n of counts){const s=setup(n),before=slots(s.physics);advance(s.scene,4);
  assert.equal(s.scene.remaining,n);assert.equal(s.scene.lidOpen,0);assert(!s.scene.ready);assert(s.scene.canTilt);
  assert.equal(s.scene.beginTilt({x:-2,y:-2,time:4000}),false);advance(s.scene,1);
  assert.equal(s.scene.remaining,n);assert.equal(slots(s.physics),before);
  tilt(s.scene);advance(s.scene,3);assert(s.scene.angle>.7);assert(s.scene.lidOpen>.98);
 }
});
test('taps never tilt or open the lid; a subthreshold drag keeps the tube closed',()=>{
 const s=setup(6);advance(s.scene,1);const r=s.scene.rigAt(1,s.scene.area()),p={x:r.x+r.length*.4,y:r.y,time:1000};
 assert(s.scene.beginTilt(p));s.scene.releaseTilt(p);advance(s.scene,2);assert.equal(s.scene.angle,0);assert.equal(s.scene.remaining,6);
 assert(s.scene.beginTilt(p));s.scene.releaseTilt({...p,y:p.y+.06});advance(s.scene,3);
 assert(s.scene.angle>0&&s.scene.angle<.62);assert.equal(s.scene.lidOpen,0);assert.equal(s.scene.remaining,6);
});
test('drag follows angular leverage about the loaded center and cancellation preserves the race',()=>{
 const s=setup(6),before=slots(s.physics);advance(s.scene,1);const r=s.scene.rigAt(1,s.scene.area()),p={x:r.x+r.length*.4,y:r.y,time:1000};
 const cm=s.scene.centerOfMass();assert(cm.y>0,'floor-loaded center is below the empty tube axis');
 assert(s.scene.beginTilt(p));s.scene.moveTilt({...p,y:p.y+.08});advance(s.scene,.5);
 assert(s.scene.angle>0&&s.scene.angle<.62);
 s.scene.moveTilt({...p,y:p.y-.2});assert.equal(s.scene.targetAngle,0);
 s.scene.cancelTilt();assert.equal(s.scene.tiltPointer,null);assert.equal(s.scene.launchDecision,null);assert.equal(slots(s.physics),before);
});
test('once sufficiently tilted every marble drains promptly without timed releases',()=>{
 for(const n of counts){const s=setup(n);advance(s.scene,1);tilt(s.scene);advance(s.scene,8);
 assert.equal(s.scene.remaining,0,'all '+n+' marbles drain');
 const times=s.scene.pours.map(p=>p.release);assert(Math.max(...times)-Math.min(...times)<5,'continuous gravity-driven burst');}
});
test('physical pour keeps every displayed ID finite and on screen at portrait and landscape sizes',()=>{
 for(const n of counts)for(const [w,h]of sizes){const s=setup(n,w,h),before=slots(s.physics);advance(s.scene,1);tilt(s.scene);
  for(let f=0;f<2400&&!s.scene.ready;f++){
   s.scene.update(1/60);if(f%12)continue;s.scene.render({physics:s.physics});
   assert.equal(new Set(s.scene.lastPoses.map(p=>p.id)).size,n);
   for(const p of s.scene.lastPoses){assert([p.x,p.y,p.radius].every(Number.isFinite));assert(p.x+p.radius>=0&&p.x-p.radius<=w&&p.y+p.radius>=0&&p.y-p.radius<=h,'visible physical sphere '+n+' '+w+'x'+h);}
  }
  assert(s.scene.ready);assert.equal(slots(s.physics),before);assert.equal(s.physics.time,0);
 }
});
test('receiving solver inherits exact exit position, tangent velocity and collision radius',()=>{
 for(const n of counts){const s=setup(n),c=s.scene.shuffle,step=c.step.bind(c),seen=new Set();
  c.step=dt=>{for(let i=0;i<n;i++){const b=c.bodies[i];if(b.pouring||seen.has(b.id))continue;seen.add(b.id);const p=s.scene.pours[i].exit,z=s.scene.viewScale;
   assert(Math.hypot(b.x*z-p.x,b.y*z-p.y)<1e-10);assert(Math.hypot(b.vx*z-p.vx,b.vy*z-p.vy)<1e-10);assert(Math.abs(b.r*z-p.r)<1e-10);
  }step(dt);};finish(s.scene);assert.equal(seen.size,n);
 }
});
test('gravity deposited balls meet the floor and avoid deep overlap including 500 balls',()=>{
 for(const n of counts){const s=setup(n);finish(s.scene);advance(s.scene,2);const c=s.scene.shuffle;let worst=0;
  for(let i=0;i<n;i++){const b=c.bodies[i];assert(!b.pouring);assert(b.x-b.r>=c.bounds.outer.left-1e-8&&b.x+b.r<=c.bounds.outer.right+1e-8&&b.y-b.r>=c.bounds.outer.top-1e-8&&b.y+b.r<=c.bounds.outer.bottom+1e-8);
   for(let j=0;j<i;j++){const a=c.bodies[j];worst=Math.max(worst,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));}
  }assert(worst<.05,'deep overlap '+worst);assert(c.gravity>0);
 }
});
test('fixed-step tilt and release preserve physical outcomes across render frame grouping and motion settings',()=>{
 for(const n of [6,500]){let baseline;
  for(const fps of [24,60,120])for(const reduced of [false,true]){
   const s=setup(n,390,844,reduced);advance(s.scene,1,fps);tilt(s.scene);advance(s.scene,18,fps);
   assert(s.scene.ready);const actual=JSON.stringify(s.scene.shuffle.snapshot());if(baseline)assert.equal(actual,baseline);else baseline=actual;
   s.scene.render({physics:s.physics,reducedMotion:!reduced});assert.equal(JSON.stringify(s.scene.shuffle.snapshot()),actual);
  }
 }
});
test('large hidden-tab resume deltas neither open the lid nor manufacture readiness',()=>{const s=setup(6);s.scene.update(120);assert(s.scene.elapsed<=.05);assert(!s.scene.ready);assert.equal(s.scene.lidOpen,0);assert(s.scene.shuffle.bodies.every(b=>b.pouring));});

test('the original tube and opening cap always use the transparent photo layer above the receiving board',()=>{
 const s=setup(6);advance(s.scene,1);let plates=0;s.cinema.drawPlate=(shot,view,alpha,morph,transparent)=>{assert.equal(shot,'front');assert.equal(transparent,true,'original photo is masked, never replaced or painted opaque');plates++;};
 s.scene.render({physics:s.physics});tilt(s.scene);advance(s.scene,1);s.scene.render({physics:s.physics});assert.equal(plates,4,'original body and cap before and after tilting');
});
