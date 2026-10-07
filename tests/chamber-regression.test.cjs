const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{},document:{},Math};vm.createContext(box);
for(const f of ['maps','physics','cinematic'])vm.runInContext(fs.readFileSync(f==='cinematic' && process.env.CHAMBER_BASELINE ? process.env.CHAMBER_BASELINE : __dirname+'/../js/'+f+'.js','utf8'),box);
const P=box.window.CosmicPinball;
const game=(n,seed='REGRESSION')=>new P.Physics({map:P.MAPS.classic,names:P.parseNames('참가자*'+n),seed});
test('isolated pinballs receive the same gravity and pressure, not individual phase forces',()=>{
 const c=new P.CINEMA.Chamber(P.CINEMA.descriptors(game(2)),'test');
 Object.assign(c.bodies[0],{x:-1,y:0,z:0,vx:0,vy:0,vz:0,phase:0});
 Object.assign(c.bodies[1],{x:1,y:0,z:0,vx:0,vy:0,vz:0,phase:2});
 c.ticks=24; c.step(true);assert.equal(c.bodies[0].vx,c.bodies[1].vx);assert.equal(c.bodies[0].vy,c.bodies[1].vy);
});
test('without air pressure gravity settles pinballs onto the visible floor',()=>{
 const c=new P.CINEMA.Chamber(P.CINEMA.descriptors(game(6)),'gravity');c.seek(4,false);
 assert(c.bodies.reduce((a,b)=>a+b.y,0)/6>.45);
});
test('contact centers and visible radii agree in the front glass',()=>{
 const c=new P.CINEMA.Chamber(P.CINEMA.descriptors(game(2)),'CONTACT'),r=c.radius;
 Object.assign(c.bodies[0],{x:-r,y:0,z:0});Object.assign(c.bodies[1],{x:r,y:0,z:0});
 const v=P.CINEMA.matchedViews(1280,720,0,0),a=P.CINEMA.project(c.pose(0),v.front,v.angle,0),b=P.CINEMA.project(c.pose(1),v.front,v.angle,0);
 const displayedRadius=r*v.frame.thickness*.42*a.scale/(v.frame.thickness/v.frame.baseThickness);
 assert(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-2*displayedRadius)<1e-8);
});
test('same participants retain chamber position and velocity when a seeded run replaces setup',()=>{
 const a=game(6,'preview'),b=game(6,'run');const s=Object.create(P.Cinematic.prototype);s.lastTime=0;s.entries(a);
 s.previewChamber.seek(2,true);const before=JSON.stringify(s.previewChamber.bodies);s.lastStage='setup';s.entries(b);
 assert.equal(JSON.stringify(s.chamber.bodies),before);
});
test('6, 50, 200 and 500 circles remain contained, exchange order and avoid deep overlap',()=>{
 for(const n of [6,50,200,500]) {
  const c=new P.CINEMA.Chamber(P.CINEMA.descriptors(game(n,'CONTACT-'+n)),'CONTACT-'+n);
  const initial=c.bodies.slice().sort((a,b)=>a.x-b.x).map(b=>b.index).join(',');let overlap=0;
  const started=performance.now();
  for(let t=0;t<480;t++) {
   c.step(true);
   if(t%12===0)for(let i=0;i<n;i++) {
    const a=c.bodies[i],cx=Math.max(-(P.CINEMA.chamberHalfLength-1),Math.min(P.CINEMA.chamberHalfLength-1,a.x));
    assert(Math.hypot(a.x-cx,a.y)+a.r<=1+1e-8);
    for(let j=0;j<i;j++) {const b=c.bodies[j];overlap=Math.max(overlap,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));}
   }
  }
  assert.notEqual(c.bodies.slice().sort((a,b)=>a.x-b.x).map(b=>b.index).join(','),initial);
  assert(overlap<.05,n+' circles overlap by '+overlap);
  console.log('chamber',n,'CPU ms',Math.round(performance.now()-started),'worst relative overlap',overlap);
 }
});
test('waiting duration cannot change assigned slots or seeded race results',()=>{
 let baseline;
 for(const wait of [0,2,7]) {
  const pre=game(50,'preview'),run=game(50,'FIXED-RUN');const s=Object.create(P.Cinematic.prototype);s.lastTime=0;s.entries(pre);
  s.previewChamber.seek(wait,true);s.lastStage='setup';s.entries(run);s.launchBirth=s.chamber.ticks/120;s.commitShuffle(run);
  const slots=JSON.stringify(run.marbles.map(m=>[m.x,m.y,m.vx,m.vy]));
  if(baseline)assert.equal(slots,baseline.slots);
  while(run.finished.length<50&&run.time<180)run.step(1/120);
  assert.equal(run.finished.length,50);
  const ranking=JSON.stringify(run.finished.map(m=>[m.name,m.colorIndex,m.finishTime]));
  if(wait===0)baseline={slots,ranking};else assert.equal(ranking,baseline.ranking);
  baseline=baseline.slots?baseline:{slots,ranking};
 }
});

test('same seed assigns identical slots for every count and waiting/frame schedule',()=>{
 for(const n of [6,50,200,500]) {
  let expected;
  for(const wait of [0,.3,2]) {
   const pre=game(n,'PRE-'+n),run=game(n,'RUN-'+n),s=Object.create(P.Cinematic.prototype);s.lastTime=0;s.entries(pre);
   for(let t=0;t<wait;t+=1/24)s.previewChamber.seek(t,true);
   s.previewChamber.seek(wait,true);s.lastStage='setup';s.entries(run);s.launchBirth=s.chamber.ticks/120;s.commitShuffle(run);
   const actual=JSON.stringify(run.marbles.map(m=>[m.id,m.x,m.y,m.vx,m.vy]));
   if(expected)assert.equal(actual,expected);else expected=actual;
   assert.equal(run.time,0);assert.equal(run.ticks,0);
  }
 }
});
test('camera orbit projects visible contacts and glass boundary in the same plane',()=>{
 for(const [w,h] of [[1280,720],[390,844],[844,390]])for(const p of [0,.25,.5,.75,1]) {
  const v=P.CINEMA.matchedViews(w,h,p,0),f=v.frame,r=.1;
  const a=P.CINEMA.project({x:0,y:0,z:0},v.front,v.angle,p);
  const b=P.CINEMA.project({x:2*r/P.CINEMA.chamberHalfLength,y:0,z:0},v.front,v.angle,p);
  const aspect=f.length*.45/P.CINEMA.chamberHalfLength/(f.thickness*.42);
  assert(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-2*r*f.thickness*.42*aspect)<1e-8);
 }
});

test('post-blur pressure pulses also avoid deep overlap after a live waiting chamber',()=>{
 for(const n of [6,50,200,500]) {
  const c=new P.CINEMA.Chamber(P.CINEMA.descriptors(game(n,'GLASS-QA-'+n)),'GLASS-QA-'+n);c.seek(2,true);
  c.pressureOrigin=c.ticks/120+P.CINEMA.timing.blurClear/P.CINEMA.timing.mixing*P.CINEMA.timing.chamberMix;
  let overlap=0;
  for(let tick=0;tick<480;tick++) {
   c.step(true);
   if(tick%12===0)for(let i=0;i<n;i++)for(let j=0;j<i;j++) {
    const a=c.bodies[i],b=c.bodies[j];overlap=Math.max(overlap,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));
   }
  }
  assert(overlap<.05,n+' live launch overlap '+overlap);
  console.log('live launch',n,'worst relative overlap',overlap);
 }
});
