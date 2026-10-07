const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const box = { window: {}, document: {}, Math };
vm.createContext(box);
for (const file of ['maps', 'physics', 'cinematic', 'hand-flight']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8'), box);
}
const P = box.window.CosmicPinball;
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const snapshot = value => JSON.stringify(value);
function scene(count = 6, width = 1280, height = 720, reduced = false, direction = { dx: .3, dy: -.2 }) {
  const physics = new P.Physics({ names: P.parseNames('참가자*' + count), map: P.MAPS.classic, seed: 'HAND-FLIGHT-' + count });
  const entries = P.CINEMA.descriptors(physics);
  const area = { x: width / 2, y: height / 2, s: Math.min(width - 32, height - 48), w: width, h: height };
  const camera = { zoom: Math.min((width - 60) / 1100, .75), x: 500, y: 400,
    worldToScreen(x, y) { return { x: width / 2 + (x - this.x) * this.zoom, y: height * .48 + (y - this.y) * this.zoom }; } };
  const counters = { clear: 0, fill: 0, board: 0, orbs: 0, trails: 0, saves: 0 };
  const ctx = {
    clearRect() { counters.clear++; }, fillRect() { counters.fill++; },
    createLinearGradient() { return { addColorStop() {} }; }, save() { counters.saves++; }, restore() { counters.saves--; },
    transform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { counters.trails++; }
  };
  const cinema = { width, height, ctx, resize() {}, targetBoard(view) { counters.board++; this.lastBoard = view; },
    drawOrb(entry, pose, blend, marble) { counters.orbs++; assert.equal(entry.id, marble.id); assert.equal(entry.id, pose.id); this.lastBlend = blend; } };
  const hand = { camera, entries, area: () => area, shuffle: { bodies: entries.map((entry, index) => {
    const angle = index * 2.399963229728653;
    return { id: entry.id, x: .06 * Math.cos(angle) + .08, y: .07 * Math.sin(angle) - .03,
      vx: .35 * Math.cos(angle), vy: -.25 + .12 * Math.sin(angle), r: Math.min(.034, .125 / Math.sqrt(count)) };
  }) } };
  const flight = new P.HandFlight(cinema); flight.begin(physics, hand, direction, 2.8, reduced);
  return { physics, hand, flight, cinema, camera, counters, area };
}

test('release starts at every actual position and velocity, with C1 propulsion onset', () => {
  for (const reduced of [false, true]) {
    const { flight, hand, area } = scene(50, 1280, 720, reduced), h = 1e-5;
    for (let index = 0; index < 50; index++) {
      const body = hand.shuffle.bodies[index], at = flight.pose(index, 0), next = flight.pose(index, h);
      near(at.x, area.x + body.x * area.s); near(at.y, area.y + body.y * area.s);
      near(at.vx, body.vx * area.s); near(at.vy, body.vy * area.s);
      near((next.x - at.x) / h, at.vx, .001); near((next.y - at.y) / h, at.vy, .001);
      const delay = flight.items[index].delay;
      if (delay > h) {
        const before = flight.pose(index, delay - h), after = flight.pose(index, delay + h);
        near((after.x - before.x) / (2 * h), at.vx, .002);
        near((after.y - before.y) / (2 * h), at.vy, .002);
      }
    }
  }
});

test('front pinballs receive propulsion first and delays depend on actual throw direction', () => {
  const right = scene(50, 1280, 720, false, { dx: 1, dy: 0 }).flight;
  const left = scene(50, 1280, 720, false, { dx: -1, dy: 0 }).flight;
  const leading = right.items.reduce((a, b) => a.x > b.x ? a : b);
  const trailing = right.items.reduce((a, b) => a.x < b.x ? a : b);
  near(leading.delay, 0); near(trailing.delay, .12);
  near(left.items[leading.index].delay, .12); near(left.items[trailing.index].delay, 0);
  const t = trailing.delay / 2, late = right.pose(trailing.index, t);
  near(late.x, trailing.x + trailing.vx * t); near(late.y, trailing.y + trailing.vy * t);
  const propelled = right.pose(leading.index, t);
  assert.ok(Math.hypot(propelled.x - leading.x - leading.vx * t, propelled.y - leading.y - leading.vy * t) > .01);
});

test('gesture direction changes the visible path while endpoints retain their own seeded slots', () => {
  for (const reduced of [false, true]) {
    const right = scene(6, 1280, 720, reduced, { dx: 1, dy: 0 });
    const up = scene(6, 1280, 720, reduced, { dx: 0, dy: -1 });
    assert.notEqual(snapshot(right.flight.items.map((_, i) => right.flight.pose(i, 1.4))),
      snapshot(up.flight.items.map((_, i) => up.flight.pose(i, 1.4))));
    assert.equal(snapshot(right.physics.marbles), snapshot(up.physics.marbles));
    for (let index = 0; index < 6; index++) {
      const a = right.flight.pose(index, 2.8), b = up.flight.pose(index, 2.8);
      near(a.x, b.x); near(a.y, b.y); assert.equal(a.id, b.id);
      near(a.vx, 0); near(a.vy, 0);
    }
  }
});

test('all IDs reach exact map sprites on desktop, portrait and landscape for every count', () => {
  for (const count of [6, 50, 200, 500]) for (const [width, height] of [[1280,720],[390,844],[844,390]]) for (const reduced of [false,true]) {
    const s = scene(count, width, height, reduced), snapshotBefore = snapshot(s.physics.marbles);
    const twin = new P.Physics({ names: P.parseNames('참가자*' + count), map: P.MAPS.classic, seed: s.physics.seed });
    for (const progress of [0,.01,.1,.25,.5,.75,.9,.999,1]) {
      const result = s.flight.render({ progress, physics: s.physics, camera: s.camera, reducedMotion: reduced });
      assert.ok(result.reveal >= 0 && result.reveal <= 1);
      assert.equal(s.flight.lastPoses.length, count);
      for (const pose of s.flight.lastPoses) {
        assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y) && pose.radius > 0);
        const marble = s.physics.marbles.find(m => m.id === pose.id);
        assert.ok(marble);
        if (progress === 0) { const body = s.hand.shuffle.bodies[pose.index]; near(pose.x,s.area.x+body.x*s.area.s); near(pose.y,s.area.y+body.y*s.area.s); }
        if (progress === 1) { const target = s.camera.worldToScreen(marble.x,marble.y); near(pose.x,target.x); near(pose.y,target.y); near(pose.radius,marble.r*s.camera.zoom); }
      }
    }
    assert.equal(snapshot(s.physics.marbles), snapshotBefore);
    assert.equal(s.physics.time, 0); assert.equal(s.physics.ticks, 0); assert.equal(s.physics.finished.length, 0);
    for (let i=0;i<5;i++) assert.equal(s.physics.random(),twin.random());
    assert.equal(s.counters.saves, 0); assert.equal(s.cinema.lastBlend,1);
  }
});

test('camera starts with identity and zero velocity, follows the flight, and ends at the final map transform', () => {
  for (const reduced of [false, true]) {
    const s = scene(200, 390, 844, reduced), first = s.flight.cameraAt(0), h = 1e-6;
    near(first.a,1); near(first.d,1); near(first.e,0); near(first.f,0);
    const next=s.flight.cameraAt(h);
    near((next.a-first.a)/h,0,.0001); near((next.e-first.e)/h,0,.01); near((next.f-first.f)/h,0,.01);
    for (const p of [.05,.2,.4,.7,.9,1]) {
      const view=s.flight.cameraAt(p);
      const expectedX=view.a*view.initial.e+view.e,expectedY=view.d*view.initial.f+view.f;
      near(view.current.e,expectedX);near(view.current.f,expectedY);
      if(reduced){near(view.a,1);near(view.d,1);near(view.e,0);near(view.f,0);}
    }
    const final=s.flight.cameraAt(1),before=s.flight.cameraAt(1-h);
    for(const key of ['a','d','e','f'])near(final.current[key],s.flight.final[key]);
    near((final.a-before.a)/h,0,.001);near((final.e-before.e)/h,0,.01);near((final.f-before.f)/h,0,.01);
    const item=s.flight.items[0],end=s.flight.pose(0,s.flight.duration),almost=s.flight.pose(0,s.flight.duration-h);
    near((end.x-almost.x)/h,0,.005);near((end.y-almost.y)/h,0,.005);
  }
});

test('reduced motion keeps the same release state and own IDs with no camera sweep or trails', () => {
  const normal=scene(500,844,390,false), reduced=scene(500,844,390,true);
  for(let i=0;i<500;i++){
    const a=normal.flight.pose(i,0),b=reduced.flight.pose(i,0);
    near(a.x,b.x);near(a.y,b.y);near(a.vx,b.vx);near(a.vy,b.vy);assert.equal(a.id,b.id);
  }
  normal.flight.render({progress:.5,physics:normal.physics,camera:normal.camera});
  reduced.flight.render({progress:.5,physics:reduced.physics,camera:reduced.camera});
  assert.ok(normal.counters.trails>0);assert.equal(reduced.counters.trails,0);
  near(reduced.flight.cameraAt(.5).a,1);near(reduced.flight.cameraAt(.5).e,0);
  assert.equal(snapshot(normal.physics.marbles),snapshot(reduced.physics.marbles));
});

test('snapshot positions stay fixed when the old shuffle continues or source arrays reorder', () => {
  const s=scene(6),before=snapshot(s.flight.items.map((_,i)=>s.flight.pose(i,.7)));
  for(const body of s.hand.shuffle.bodies){body.x+=2;body.vx+=10;}
  assert.equal(snapshot(s.flight.items.map((_,i)=>s.flight.pose(i,.7))),before);
  const reordered=scene(6);
  reordered.hand.shuffle.bodies.reverse();reordered.physics.marbles.reverse();
  reordered.flight.begin(reordered.physics,reordered.hand,{dx:.3,dy:-.2},2.8,false);
  for(let i=0;i<6;i++) {
    const item=reordered.flight.items[i],body=reordered.hand.shuffle.bodies.find(b=>b.id===item.id),marble=reordered.physics.marbles.find(m=>m.id===item.id);
    near(item.x,reordered.area.x+body.x*reordered.area.s);
    near(item.targetX,reordered.flight.initial.a*marble.x+reordered.flight.initial.e);
  }
});

test('midflight resizing preserves current positions and radii while smoothly reaching the new camera', () => {
  for (const reduced of [false, true]) {
    const s = scene(500, 1280, 720, reduced), originalSlots = snapshot(s.physics.marbles);
    const originalInitial = snapshot(s.flight.initial), originalFinal = snapshot(s.flight.final);
    const cameras = [
      { zoom: .31, worldToScreen(x, y) { return { x: 195 + (x - 500) * this.zoom, y: 410 + (y - 570) * this.zoom }; } },
      { zoom: .48, worldToScreen(x, y) { return { x: 360 + (x - 490) * this.zoom, y: 190 + (y - 450) * this.zoom }; } }
    ];
    for (const [progress, camera] of [[.4,cameras[0]],[.7,cameras[1]]]) {
      const before = s.flight.cameraAt(progress), h = 1e-6;
      const previous = s.flight.cameraAt(progress-h);
      const poses = s.flight.items.map((_, index) => s.flight.pose(index, progress * s.flight.duration));
      s.flight.retarget(camera, progress);
      const after = s.flight.cameraAt(progress), next = s.flight.cameraAt(progress+h);
      for (const key of ['a','d','e','f']) {
        near(after[key],before[key]);
        near((after[key]-previous[key])/h,(next[key]-after[key])/h,.15);
      }
      poses.forEach(pose => {
        near(after.a*pose.x+after.e,before.a*pose.x+before.e);
        near(after.d*pose.y+after.f,before.d*pose.y+before.f);
        near(after.a*pose.radius,before.a*pose.radius);
      });
      s.flight.render({progress,physics:s.physics,camera,reducedMotion:reduced});
      s.flight.lastPoses.forEach((pose,index) => {
        near(pose.x,after.a*poses[index].x+after.e);near(pose.y,after.d*poses[index].y+after.f);
        near(pose.radius,after.a*poses[index].radius);
      });
    }
    const final = s.flight.cameraAt(1), camera = cameras[1], origin = camera.worldToScreen(0,0);
    near(final.current.a,camera.zoom);near(final.current.d,camera.zoom);
    near(final.current.e,origin.x);near(final.current.f,origin.y);
    s.flight.render({progress:1,physics:s.physics,camera,reducedMotion:reduced});
    s.flight.lastPoses.forEach(pose=>{const marble=s.physics.marbles.find(m=>m.id===pose.id),target=camera.worldToScreen(marble.x,marble.y);
      near(pose.x,target.x);near(pose.y,target.y);near(pose.radius,marble.r*camera.zoom);});
    assert.equal(snapshot(s.physics.marbles),originalSlots);assert.equal(snapshot(s.flight.initial),originalInitial);assert.equal(snapshot(s.flight.final),originalFinal);
    assert.equal(s.physics.time,0);assert.equal(s.physics.ticks,0);
  }
});

test('changing reduced motion midflight suppresses trails without resetting the captured path', () => {
  const s=scene(500),progress=.5;
  s.flight.render({progress,physics:s.physics,camera:s.camera,reducedMotion:false});
  const before=snapshot(s.flight.lastPoses),trailCount=s.counters.trails,path=snapshot(s.flight.items.map((_,i)=>s.flight.pose(i,1.4)));
  s.flight.render({progress,physics:s.physics,camera:s.camera,reducedMotion:true});
  assert.equal(snapshot(s.flight.lastPoses),before);assert.equal(s.counters.trails,trailCount);
  assert.equal(snapshot(s.flight.items.map((_,i)=>s.flight.pose(i,1.4))),path);
  s.flight.render({progress,physics:s.physics,camera:s.camera,reducedMotion:false});
  assert.equal(snapshot(s.flight.lastPoses),before);assert.ok(s.counters.trails>trailCount);
});
