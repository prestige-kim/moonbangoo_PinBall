const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{},Math};vm.createContext(box);
vm.runInContext(fs.readFileSync(process.env.HAND_SHUFFLE_SOURCE||__dirname+'/../js/shuffle.js','utf8'),box);
const HandShuffle=box.window.CosmicPinball.HandShuffle;
const entries=n=>Array.from({length:n},(_,i)=>({index:i,id:'ball-'+i}));
const make=n=>new HandShuffle(entries(n),'HAND-SHUFFLE-'+n);
const magnitude=b=>Math.hypot(b.vx,b.vy);
const order=c=>c.bodies.slice().sort((a,b)=>a.x-b.x).map(b=>b.id).join(',');
const overlaps=c=>{let worst=0;for(let i=0;i<c.bodies.length;i++)for(let j=0;j<i;j++){const a=c.bodies[i],b=c.bodies[j];worst=Math.max(worst,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));}return worst;};
function gesture(c,type,seconds=1.5){c.begin(0,0,0);for(let tick=1;tick<=seconds*120;tick++){const t=tick/120;let x,y;if(type==='circle'){x=.12*Math.cos(t*8);y=.12*Math.sin(t*8);}else{x=.20*Math.sin(t*(type==='reversal'?12:3));y=.025;}c.move(x,y,t*1000);c.step();}}

test('pointer applies distance-weighted force to individual bodies',()=>{
 const c=make(2);Object.assign(c.bodies[0],{x:.018,y:0,vx:0,vy:0});Object.assign(c.bodies[1],{x:-.30,y:0,vx:0,vy:0});
 c.begin(0,0,0);c.move(.025,0,20);c.step();assert(c.bodies[0].vx>c.bodies[1].vx+.015,'near body responds before distant body');
 assert.notEqual(c.bodies[0].vx,c.bodies[1].vx);
});
test('stationary input leaves inertia briefly and then damps it',()=>{
 const c=make(1);Object.assign(c.bodies[0],{x:0,y:0,vx:0,vy:0});c.begin(0,0,0);c.move(.08,0,50);for(let i=0;i<10;i++)c.step();
 const moving=magnitude(c.bodies[0]);assert(moving>.03);c.move(.08,0,150);c.step();assert(magnitude(c.bodies[0])>0);
 for(let i=0;i<240;i++)c.step();assert(magnitude(c.bodies[0])<moving*.35);
});
test('release cancels force without resetting position or velocity and returns softly',()=>{
 const c=make(6);gesture(c,'reversal',.5);for(const b of c.bodies)b.x+=.15;
 const before=JSON.stringify(c.snapshot());c.release();assert.equal(JSON.stringify(c.snapshot()),before);
 const centroid=()=>Math.hypot(c.bodies.reduce((s,b)=>s+b.x,0)/6,c.bodies.reduce((s,b)=>s+b.y,0)/6);
 const displaced=centroid();for(let i=0;i<1200;i++)c.step();assert(centroid()<displaced*.35);
});
test('direct contact transfers momentum rather than carrying a rigid group',()=>{
 const c=make(2),r=c.radius;Object.assign(c.bodies[0],{x:-r,y:0,vx:.6,vy:0});Object.assign(c.bodies[1],{x:r+.001,y:0,vx:0,vy:0});
 c.step();assert(c.collisions>0);assert(c.bodies[1].vx>c.bodies[0].vx);assert(overlaps(c)<.05);
});
test('straight, reversal and circular input exchange order at every supported count',()=>{
 for(const n of [6,50,200,500])for(const type of ['straight','reversal','circle']){
  const c=make(n),initial=order(c);gesture(c,type);assert(c.collisions>0,n+' '+type+' must collide');assert.notEqual(order(c),initial,n+' '+type+' must exchange order');
  console.log('shuffle exchanges',n,type,'collisions',c.collisions);
 }
});
test('all supported counts stay finite, contained and free of deep overlaps during vigorous input',()=>{
 for(const n of [6,50,200,500]){
  const c=make(n),ids=c.bodies.map(b=>b.id).join(',');let worst=overlaps(c);c.begin(0,0,0);const started=performance.now();
  for(let tick=1;tick<=480;tick++){
   const t=tick/120;c.move(.39*Math.sin(t*11),.35*Math.cos(t*9),t*1000);c.step();
   if(tick%12===0){worst=Math.max(worst,overlaps(c));for(const b of c.bodies){assert([b.x,b.y,b.vx,b.vy,b.spin].every(Number.isFinite));assert(b.x-b.r>=c.bounds.left-1e-9&&b.x+b.r<=c.bounds.right+1e-9);assert(b.y-b.r>=c.bounds.top-1e-9&&b.y+b.r<=c.bounds.bottom+1e-9);assert.equal(b.r,c.radius);}}
  }
  assert.equal(c.bodies.map(b=>b.id).join(','),ids);assert(worst<.05,n+' worst overlap '+worst);
  console.log('shuffle benchmark',n,'480 steps CPU ms',Math.round(performance.now()-started),'worst relative overlap',worst);
 }
});
test('visual random state is independent and snapshots do not mutate live bodies',()=>{
 const a=make(50),b=make(50);assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));const copy=a.snapshot();copy[0].x=20;assert.notEqual(a.bodies[0].x,20);
 const small=make(6),large=make(500);assert(small.radius>large.radius);assert.equal(new Set(large.bodies.map(b=>b.id)).size,500);
});

test('a settled group exchanges actual order during representative straight, reversal and circular hand input',()=>{
 for(const n of [6,50,200,500])for(const type of ['straight','reversal','circle']){
  const c=new HandShuffle(entries(n),'HAND-QA-'+n),wait=n===6?30:5;for(let tick=0;tick<wait*120;tick++)c.step();
  const initial=order(c),before=c.collisions;let exchanged=false;c.begin(0,0,wait*1000);
  for(let tick=1;tick<=192;tick++){
   const seconds=tick/120;let x,y;
   if(type==='straight'){x=.16*seconds/1.6;y=0;}
   else if(type==='reversal'){x=.13*Math.sin(seconds*Math.PI*8);y=0;}
   else{x=.12*Math.cos(seconds*Math.PI*4);y=.12*Math.sin(seconds*Math.PI*4);}
   if(tick%2===0)c.move(x,y,(wait+seconds)*1000);
   c.step();if(order(c)!==initial)exchanged=true;
  }
  assert(c.collisions>before,n+' '+type+' settled input must produce collisions');
  assert(exchanged,n+' '+type+' settled input must exchange order at some point');
 }
});


test('the central set and hand reach leave substantially more room at every count',()=>{
 for(const n of [6,50,200,500]){
  const c=make(n);assert(c.clusterRadius*2>=.55&&c.clusterRadius*2<=.65);
  assert(c.pointerRadius>=.25);assert(c.bodies.every(b=>b.r===c.radius));
  assert(c.bodies.every(b=>Math.hypot(b.x,b.y)+b.r<=c.clusterRadius+1e-8));
 }
});
test('empty-space input only records interaction when movement transfers a real local impulse',()=>{
 const c=make(2);Object.assign(c.bodies[0],{x:0,y:0,vx:0,vy:0});Object.assign(c.bodies[1],{x:0,y:.4,vx:0,vy:0});
 c.begin(-.45,-.4,0);const initial=JSON.stringify(c.snapshot());
 assert.equal(c.move(-.4,-.4,100),false);assert.equal(JSON.stringify(c.snapshot()),initial);
 assert.equal(c.move(.15,0,1100),true);assert(c.bodies[0].vx>0);assert.equal(c.bodies[1].vx,0);
 assert.equal(c.interacted,true);const moved=JSON.stringify(c.snapshot());
 c.move(.15,0,1600);assert.equal(JSON.stringify(c.snapshot()),moved,'stopping does not zero current momentum');
 c.release();c.begin(.45,-.4,1800);assert.equal(c.interacted,false,'contact never leaks into the next gesture');
});

test('virtual rounded walls reflect only outward momentum, dissipate tangential speed and contain circles',()=>{
 const c=make(6);c.bounds={left:-.42,right:.42,top:-.42,bottom:.42,cornerRadius:.12};
 const b=c.bodies[0],r=b.r,center=.30,limit=.12-r;
 Object.assign(b,{x:.41,y:.41,vx:.8,vy:.4});c.wall(b);
 const nx=(b.x-center)/limit,ny=(b.y-center)/limit;
 assert(Math.hypot(b.x-center,b.y-center)<=limit+1e-9,'circle clears the rounded corner');
 assert(b.vx*nx+b.vy*ny<0,'outward velocity reflects inward');
 const before=[b.vx,b.vy];c.wall(b);assert.deepEqual([b.vx,b.vy],before,'resting contact never repeats a bounce');
 Object.assign(b,{x:.43,y:0,vx:.8,vy:.3});c.wall(b);
 assert(Math.abs(b.x-(.42-r))<1e-9);assert(Math.abs(b.vx+.8*.52)<1e-9);assert(Math.abs(b.vy-.3*.97)<1e-9);
 Object.assign(b,{x:.41,y:.41,vx:-.8,vy:-.4});c.wall(b);assert.equal(b.vx,-.8);assert.equal(b.vy,-.4);
});
