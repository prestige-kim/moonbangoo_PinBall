const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function context() {
  const gradient = { addColorStop(offset, color) { assert(Number.isFinite(offset)); assert(!String(color).includes('NaN')); } };
  return new Proxy({
    images: [], createLinearGradient() { return gradient; }, createRadialGradient() { return gradient; },
    createPattern() { return {}; }, createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    measureText(text) { return { width: text.length * 7 }; },
    drawImage(...args) { this.images.push(args); for (const arg of args) if (typeof arg === 'number') assert(Number.isFinite(arg)); }
  }, { get(target, key) { return key in target ? target[key] : (...args) => { for (const arg of args) if (typeof arg === 'number') assert(Number.isFinite(arg), String(key)); }; } });
}
function canvas(w = 1280, h = 720) {
  const ctx = context();
  return { width: w, height: h, clientWidth: w, clientHeight: h, getContext() { return ctx; }, ctx, addEventListener() {} };
}
class LocalImage {
  constructor() { this.width = this.naturalWidth = 1678; this.height = this.naturalHeight = 937; }
  set src(value) { assert(value.startsWith('./assets/')); if (this.onload) this.onload(); }
}
const sandbox = { window: {}, Image: LocalImage, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2,
  document: { createElement: () => canvas(), addEventListener() {} } };
vm.createContext(sandbox);
for (const file of ['themes', 'maps', 'physics', 'renderer', 'cinematic']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), sandbox, { filename: file });
const P = sandbox.window.CosmicPinball;

// Each photographed glass axis must share both endpoints throughout the orbit.
let registrations = 0;
let assemblies = 0;
for (const [w, h] of [[1280, 720], [587, 668], [390, 844]]) {
  const completed = P.CINEMA.matchedViews(w, h, 1, 0);
  const endpoint = P.CINEMA.pointInPlate(completed.angle, .244, .769);
  let wheelRadius;
  for (const p of [0, .1, .25, .4, .5, .65, .8, 1]) {
    const views = P.CINEMA.matchedViews(w, h, p, 0);
    const pairs = [[P.CINEMA.pointInPlate(views.front, .31, .548), P.CINEMA.pointInPlate(views.angle, .193, .66)],
      [P.CINEMA.pointInPlate(views.front, .697, .548), P.CINEMA.pointInPlate(views.angle, .317, .537)]];
    for (const [a, b] of pairs) { assert(Math.abs(a.x - b.x) < 1e-9); assert(Math.abs(a.y - b.y) < 1e-9); }
    assert(views.frame.length > 0 && views.frame.thickness > 0); registrations++;
    const wheel = P.CINEMA.assemblyPose(p, views.angle, completed.angle, false);
    if (p <= .25) assert.equal(wheel.alpha, 0, 'the wheel cannot appear in the unrotated glass cylinder');
    if (wheelRadius === undefined) wheelRadius = wheel.radius;
    assert.equal(wheel.radius, wheelRadius, 'the wheel must use completed proportions during assembly');
    assert(wheel.scale >= .94 && wheel.scale <= 1, 'no perspective-stretched giant wheel');
    if (p === 1) {
      assert(Math.abs(wheel.x - endpoint.x) < 1e-9); assert(Math.abs(wheel.y - endpoint.y) < 1e-9);
      assert.equal(wheel.alpha, 1); assert.equal(wheel.scale, 1); assert.equal(wheel.rotation, 0);
    }
    assemblies++;
  }
}

// A single discharge owns all release times. The shot has nonzero speed at the
// muzzle, and the in-barrel acceleration meets that speed without a position jump.
let discharges = 0;
const shotPhysics = new P.Physics({ map: P.MAPS.classic, names: P.parseNames('구슬*500'), seed: 'DISCHARGE' });
const shotEntries = P.CINEMA.descriptors(shotPhysics);
const start = { x: 220, y: 520, depth: .3 }, muzzle = { x: 440, y: 375 }, target = { x: 805, y: 190 };
const screen = { width: 1280, height: 720, axisX: .85, axisY: -.5267826876 };
assert(shotEntries.every(entry => entry.delay >= 0 && entry.delay <= .04));
for (const entry of shotEntries) {
  const release = P.CINEMA.fireMoment + entry.delay, epsilon = 1e-6;
  const pose = progress => P.CINEMA.flightPose(entry, progress, start, muzzle, target, 17, 4.1, screen);
  const origin = P.CINEMA.dischargeOrigin(entry, muzzle, 17, screen);
  const initial = pose(0), atMuzzle = pose(release), before = pose(release - epsilon), after = pose(release + epsilon);
  assert.equal(initial.x, start.x); assert.equal(initial.y, start.y); assert(initial.contained);
  assert(Math.abs(atMuzzle.x - origin.x) < 1e-9); assert(Math.abs(atMuzzle.y - origin.y) < 1e-9);
  assert(Math.hypot(origin.x - muzzle.x, origin.y - muzzle.y) < 17 * 1.7, 'every origin stays inside the muzzle');
  const incoming = { x: (atMuzzle.x - before.x) / epsilon, y: (atMuzzle.y - before.y) / epsilon };
  const outgoing = { x: (after.x - atMuzzle.x) / epsilon, y: (after.y - atMuzzle.y) / epsilon };
  assert(Math.hypot(outgoing.x, outgoing.y) > 1500, 'the muzzle must give a clear velocity burst');
  assert(Math.hypot(incoming.x - outgoing.x, incoming.y - outgoing.y) < .25, 'velocity is continuous at discharge');
  const finish = pose(1); assert.equal(finish.x, target.x); assert.equal(finish.y, target.y); assert.equal(finish.radius, 4.1);
  discharges++;
}
assert.equal(P.CINEMA.blastPose(P.CINEMA.fireMoment - .0001, false).fired, false);
const peak = P.CINEMA.blastPose(P.CINEMA.fireMoment + .004, false);
assert(peak.flash > .8); assert(peak.shake > .8); assert(peak.recoil > 0);
for (const progress of [0, .12, .124, .2, .5, 1]) {
  const reduced = P.CINEMA.blastPose(progress, true);
  assert.equal(reduced.flash, 0); assert.equal(reduced.shake, 0); assert.equal(reduced.recoil, 0);
}
const calm = P.CINEMA.blastPose(1, false);
assert.equal(calm.flash, 0); assert.equal(calm.shake, 0); assert.equal(calm.recoil, 0); assert.equal(calm.smoke, 0);
const six = P.CINEMA.descriptors(new P.Physics({ map: P.MAPS.classic, names: P.parseNames('구슬*6'), seed: 'SIX-FAN' }));
const origins = six.map(entry => P.CINEMA.dischargeOrigin(entry, muzzle, 17, screen));
const fanPositions = six.map(entry => P.CINEMA.flightPose(entry, .2, start, muzzle, target, 17, 4.1, screen));
for (let i = 0; i < six.length; i++) for (let j = i + 1; j < six.length; j++) {
  assert(Math.hypot(origins[i].x - origins[j].x, origins[i].y - origins[j].y) > 7, 'small groups use separated muzzle lanes');
  assert(Math.hypot(fanPositions[i].x - fanPositions[j].x, fanPositions[i].y - fanPositions[j].y) > 10, 'six marbles do not collapse into a single visual ball');
}
assert(fanPositions.reduce((sum, pose) => sum + Math.hypot(pose.x - muzzle.x, pose.y - muzzle.y), 0) / six.length > 140, 'the burst has already travelled decisively by p=.2');

const gameRenderer = new P.Renderer(canvas());
let frames = 0, handoffs = 0;
for (const count of [2, 50, 200, 500]) {
  const options = { map: P.MAPS.classic, names: P.parseNames('참가자*' + count), seed: 'CINEMA-PURITY-2026' };
  const physics = new P.Physics(options), twin = new P.Physics(options), before = JSON.stringify(physics.marbles);
  assert.equal(JSON.stringify(P.CINEMA.descriptors(physics)), JSON.stringify(P.CINEMA.descriptors(twin)));
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const sceneCanvas = canvas(w, h), cinema = new P.Cinematic(sceneCanvas, gameRenderer);
    const camera = { zoom: .413, worldToScreen(x, y) { return { x: 46 + x * this.zoom, y: 87 + y * this.zoom }; } };
    for (const quality of ['high', 'low']) {
      cinema.setQuality(quality);
      for (const stage of ['intro', 'setup', 'mixing', 'aiming', 'flight']) {
        for (const progress of [0, .5, 1]) {
          const result = cinema.render({ stage, progress, time: 7.9, physics, camera, reducedMotion: quality === 'low' });
          assert(result.reveal >= 0 && result.reveal <= 1); frames++;
        }
      }
    }
    // The final frame contains only the exact game sprites, with no photographed background.
    sceneCanvas.ctx.images.length = 0;
    const final = cinema.render({ stage: 'flight', progress: 1, time: 9, physics, camera, reducedMotion: false });
    assert.equal(final.reveal, 1); assert.equal(sceneCanvas.ctx.images.length, count);
    sceneCanvas.ctx.images.forEach((args, i) => {
      const marble = physics.marbles[i], target = camera.worldToScreen(marble.x, marble.y), r = marble.r * camera.zoom;
      assert(Math.abs(args[1] + args[3] / 2 - target.x) < 1e-9);
      assert(Math.abs(args[2] + args[4] / 2 - target.y) < 1e-9);
      assert(Math.abs(args[3] - r * 5.12) < 1e-9); handoffs++;
    });
  }
  assert.equal(JSON.stringify(physics.marbles), before); assert.equal(physics.time, 0); assert.equal(physics.ticks, 0);
  for (let i = 0; i < 5; i++) assert.equal(physics.random(), twin.random());
}
assert.equal(P.CINEMA.descriptors(null).length, 36);
console.log('PASS cinematic: ' + registrations + ' matched orbit frames, ' + assemblies + ' stable wheel assemblies, ' + discharges + ' continuous discharges, ' + frames + ' rendering frames, ' + handoffs + ' exact sprite handoffs; physical state and RNG unchanged.');

// Reduced-motion mixing must keep the visible spheres still while using the same
// deterministic hidden chamber outcome for the actual race.
const reducedPhysics = new P.Physics({ map: P.MAPS.classic, names: P.parseNames('조용한 구슬*6'), seed: 'REDUCED-CHAMBER' });
const reducedCanvas = canvas(), reducedCinema = new P.Cinematic(reducedCanvas, gameRenderer);
const visible = progress => {
  reducedCanvas.ctx.images.length = 0;
  reducedCinema.render({stage:'mixing',progress,time:progress,physics:reducedPhysics,reducedMotion:true});
  return JSON.stringify(reducedCanvas.ctx.images.filter(args => args[0].width === 144 && args[0].height === 144).map(args => args.slice(1)));
};
assert.equal(visible(0),visible(.9),'reduced motion does not speed up the visible physical shuffle');
reducedCinema.commitShuffle(reducedPhysics);
const normalPhysics = new P.Physics({ map: P.MAPS.classic, names: P.parseNames('조용한 구슬*6'), seed: 'REDUCED-CHAMBER' });
const normalCinema = new P.Cinematic(canvas(), gameRenderer); normalCinema.commitShuffle(normalPhysics);
assert.equal(JSON.stringify(reducedPhysics.marbles),JSON.stringify(normalPhysics.marbles),'visual accessibility never changes the real seeded outcome');

// A slow reveal leaves a clear shuffle window, while the underlying seeded
// chamber clock and handoff remain exactly the same as before this film change.
assert(P.CINEMA.timing.mixing - P.CINEMA.timing.blurClear >= 2.5);
assert.equal(P.CINEMA.timing.chamberMix + P.CINEMA.timing.chamberAim, 4);
for (const [w, h] of [[1280,720],[390,844]]) {
  const epsilon = 1e-4;
  const begin = P.CINEMA.matchedViews(w,h,0).frame;
  const nearBegin = P.CINEMA.matchedViews(w,h,epsilon).frame;
  const end = P.CINEMA.matchedViews(w,h,1).frame;
  const nearEnd = P.CINEMA.matchedViews(w,h,1-epsilon).frame;
  for (const key of ['x','y','length','thickness','rotation']) {
    assert(Math.abs(begin[key]-nearBegin[key])/epsilon < .01, 'orbit starts with zero camera velocity');
    assert(Math.abs(end[key]-nearEnd[key])/epsilon < .01, 'orbit settles before the discharge');
  }
  const views=P.CINEMA.matchedViews(w,h,.4), completed=P.CINEMA.matchedViews(w,h,1);
  const rolling=P.CINEMA.assemblyPose(.4,views.angle,completed.angle,false);
  assert(rolling.alpha>.9 && rolling.rotation<-1, 'wheel rolls in instead of growing out of the chamber');
}

// The camera has no acceleration step at the beginning/end of its flight path.
for (const [w,h] of [[1280,720],[390,844],[844,390]]) {
  const camera={x:500,y:540,zoom:.72,worldToScreen(x,y){return{x:w*.5+(x-500)*this.zoom,y:h*.5+(y-540)*this.zoom};}};
  let previous=P.CINEMA.boardView(w,h,camera,0,false);
  for(let i=1;i<=192;i++) {
    const view=P.CINEMA.boardView(w,h,camera,i/192,false);
    assert(view.amount>=previous.amount);
    assert(view.scale/previous.scale<1.035,'zoom changes stay smooth within a normal 60 FPS shot');
    previous=view;
  }
  for(const p of [.18,1]) {
    const epsilon=1e-5, a=P.CINEMA.boardView(w,h,camera,p,false).current;
    const b=P.CINEMA.boardView(w,h,camera,p===1?p-epsilon:p+epsilon,false).current;
    for(const key of ['a','d','e','f']) assert(Math.abs(a[key]-b[key])/epsilon<.01);
  }
}
let recoilPeak=0;
for(let p=0;p<=.5;p+=.001) {
  const shot=P.CINEMA.blastPose(p,false);
  assert(shot.recoil>=0,'one discharge must not wag the barrel repeatedly through its rest position');
  recoilPeak=Math.max(recoilPeak,shot.recoil);
}
assert(recoilPeak>.5,'discharge gives the barrel a visible impulse');
assert(P.CINEMA.blastPose(.115,false).compression>.98,'pressure builds immediately before the same release clock');

// The glass, pressure glow and unreleased balls stay on the recoiling barrel.
const rigFrame={axisX:.85,axisY:-Math.sqrt(1-.85*.85)};
for(const entry of shotEntries) {
  const release=P.CINEMA.fireMoment+entry.delay;
  const barrel=P.CINEMA.barrelOffset(release,rigFrame,1280,false), attached=P.CINEMA.flightOffset(entry,release,rigFrame,1280,false);
  assert.equal(attached.x,barrel.x);assert.equal(attached.y,barrel.y);
  const epsilon=1e-7, before=P.CINEMA.flightOffset(entry,release-epsilon,rigFrame,1280,false), after=P.CINEMA.flightOffset(entry,release+epsilon,rigFrame,1280,false);
  assert(Math.hypot((attached.x-before.x)/epsilon-(after.x-attached.x)/epsilon,(attached.y-before.y)/epsilon-(after.y-attached.y)/epsilon)<.1);
  const end=P.CINEMA.flightOffset(entry,1,rigFrame,1280,false);
  assert.equal(Math.hypot(end.x,end.y),0,'detaching never moves the assigned physical starting position');
  const quiet=P.CINEMA.flightOffset(entry,.13,rigFrame,1280,true);assert.equal(Math.hypot(quiet.x,quiet.y),0);
}

// The welcome chamber keeps trading axial positions without consuming the seeded launch.
{
  const physical = new P.Physics({map:P.MAPS.classic,names:P.parseNames('참가자*6'),seed:'WELCOME-SHUFFLE'});
  const movie = new P.Cinematic(canvas());
  const raceBefore = JSON.stringify(physical.marbles);
  const orders = new Set();
  for (const time of [0,1,2,4,8,12]) {
    movie.render({stage:'intro',time,physics:physical});
    orders.add(movie.previewChamber.bodies.slice().sort((a,b)=>a.x-b.x).map(b=>b.index).join(','));
  }
  assert.equal(orders.size,1,'welcome marbles stay completely still');
  assert.equal(movie.previewChamber.ticks,0);
  assert.equal(movie.chamber,movie.previewChamber,'the same still arrangement continues into setup');
  const liveTicks=movie.chamber.ticks;
  assert.equal(JSON.stringify(physical.marbles),raceBefore);
  movie.render({stage:'mixing',progress:.5,time:13,physics:physical});
  assert.equal(movie.chamber.ticks,liveTicks+Math.round(P.CINEMA.timing.chamberMix*.5*120));
}
// The intermediate photo is registered to exactly the same glass endpoints.
for (const [w,h] of [[1280,720],[390,844],[844,390]]) {
  for (const p of [0,.25,.5,.75,1]) {
    const v=P.CINEMA.matchedViews(w,h,p,0);
    for (const [u,bu] of [[.31,.32],[.697,.68]]) {
      const a=P.CINEMA.pointInPlate(v.front,u,.548),b=P.CINEMA.pointInPlate(v.bridge,bu,.504);
      assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'bridge photo must stay aligned with the moving glass and marbles');
    }
  }
}
console.log('PASS welcome: still positions, frozen chamber clock and frozen race; intermediate photo axes match desktop and mobile.');

// Reduced motion freezes the displayed chamber; it must not select different race slots.
for(const count of [6,50,200,500]) {
 const quietPhysics=new P.Physics({map:P.MAPS.classic,names:P.parseNames('참가자*'+count),seed:'QUIET-'+count});
 const normalPhysics=new P.Physics({map:P.MAPS.classic,names:P.parseNames('참가자*'+count),seed:'QUIET-'+count});
 const quiet=new P.Cinematic(canvas(390,844)),normal=new P.Cinematic(canvas());
 quiet.render({stage:'intro',time:0,physics:quietPhysics,reducedMotion:true});
 const still=JSON.stringify(quiet.chamber.bodies);
 quiet.render({stage:'setup',time:10,physics:quietPhysics,reducedMotion:true});
 assert.equal(JSON.stringify(quiet.chamber.bodies),still);
 normal.render({stage:'intro',time:0,physics:normalPhysics});
 normal.render({stage:'setup',time:2,physics:normalPhysics});
 const before=JSON.stringify(normal.chamber.bodies);
 normal.render({stage:'mixing',progress:0,time:2,physics:normalPhysics});
 assert.equal(JSON.stringify(normal.chamber.bodies),before,'zero-progress launch preserves position and velocity');
 quiet.commitShuffle(quietPhysics);normal.commitShuffle(normalPhysics);
 assert.equal(JSON.stringify(quietPhysics.marbles),JSON.stringify(normalPhysics.marbles));
}

{
 const physical=new P.Physics({map:P.MAPS.classic,names:P.parseNames('참가자*6'),seed:'TOGGLE'}),movie=new P.Cinematic(canvas());
 movie.render({stage:'intro',time:0,physics:physical});movie.render({stage:'setup',time:2,physics:physical});
 const poses=JSON.stringify(movie.cache.entries.map(e=>movie.chamber.pose(e.index))),ticks=movie.chamber.ticks;
 movie.render({stage:'setup',time:2,physics:physical,reducedMotion:true});assert.equal(JSON.stringify(movie.stillTube),poses);
 movie.render({stage:'setup',time:20,physics:physical,reducedMotion:true});assert.equal(movie.chamber.ticks,ticks);
 movie.render({stage:'setup',time:20+1/120,physics:physical});assert.equal(movie.chamber.ticks,ticks,'welcome remains still when reduced motion is disabled');
}

{
 const physical=new P.Physics({map:P.MAPS.classic,names:P.parseNames('참가자*6'),seed:'CLEAR-FIRST'}),movie=new P.Cinematic(canvas());
 movie.render({stage:'intro',time:0,physics:physical});movie.render({stage:'setup',time:2,physics:physical});
 movie.render({stage:'mixing',time:2,progress:0,physics:physical});
 const offset=movie.chamber.pressureOrigin-movie.launchBirth;
 assert.equal(P.CINEMA.pressureAt(-offset,true).pressure,0);
 assert(Math.abs(offset/P.CINEMA.timing.chamberMix*P.CINEMA.timing.mixing-P.CINEMA.timing.blurClear)<1e-8);
 const wallTime=(offset+.29)/P.CINEMA.timing.chamberMix*P.CINEMA.timing.mixing;
 assert(wallTime>P.CINEMA.timing.blurClear&&wallTime<2,'the first strong air burst is visible after blur, within the mixing shot');
}
