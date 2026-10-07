const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.HAND_SCENE_REPO_ROOT || path.join(__dirname, '..');
let now = 0;
const box = { window: {}, document: {}, Math, performance: { now: () => now } };
vm.createContext(box);
for (const file of ['maps', 'physics', 'cinematic', 'shuffle', 'throw-gate', 'hand-scene', 'hand-flight']) {
  const source = file === 'cinematic' && process.env.HAND_CINEMATIC_SOURCE || path.join(root, 'js', file + '.js');
  vm.runInContext(fs.readFileSync(source, 'utf8'), box, { filename: file + '.js' });
}
const P = box.window.CosmicPinball;
const counts = [6, 50, 200, 500];
const sizes = [[1280, 800], [390, 844], [844, 390]];
const game = (count, seed = 'HAND-SCENE-' + count) => new P.Physics({ map: P.MAPS.classic, names: P.parseNames('참가자*' + count), seed });
const positions = physics => JSON.stringify(physics.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy, m._anchorX, m._anchorY]));
const close = (actual, expected, message, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, message + ': ' + actual + ' vs ' + expected);
function makeCinema(width, height) {
  const stacks = [], strokes = [], orbs = [], plates = [];
  let currentPath = [];
  const ctx = {
    strokeStyle: '', lineWidth: 0, lineCap: '', shadowBlur: 0, shadowColor: '',
    clearRect() { strokes.length = 0; orbs.length = 0; plates.length = 0; },
    createLinearGradient() { return { addColorStop() {} }; }, fillRect() {}, fillText() {},
    beginPath() { currentPath = []; }, arc(...args) { currentPath.push(args); },
    stroke() { strokes.push({ arcs: currentPath.map(arc => arc.slice()), style: this.strokeStyle, width: this.lineWidth, shadowBlur: this.shadowBlur }); },
    save() { stacks.push({ strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, shadowBlur: this.shadowBlur, shadowColor: this.shadowColor }); },
    restore() { Object.assign(this, stacks.pop()); }, transform() {}, moveTo() {}, lineTo() {}
  };
  const cinema = Object.create(P.Cinematic.prototype);
  Object.assign(cinema, {
    width, height, lastTime: 0, lastStage: null, canvas: { dataset: {} }, ctx,
    resize() {}, drawLabel() {}, targetBoard() {},
    drawOrb(entry, pose, blend, marble) { orbs.push({ id: entry.id, pose: { ...pose }, marbleId: marble.id, blend }); },
    drawPlate(shot, view, alpha) { plates.push({ shot, alpha }); }
  });
  return { cinema, strokes, orbs, plates };
}
function setup(count, width, height) {
  now = 0;
  const physics = game(count), drawing = makeCinema(width, height);
  let randomDraws = 0;
  const random = physics.random;
  physics.random = () => { randomDraws++; return random(); };
  const scene = new P.HandScene(drawing.cinema);
  scene.gate = new P.ThrowGate(); scene.begin(physics);
  return { physics, scene, ...drawing, randomDraws: () => randomDraws };
}

test('tube extraction starts at the real projected tube coordinates for all counts and screen sizes', () => {
  for (const count of counts) for (const [width, height] of sizes) {
    const s = setup(count, width, height), area = s.scene.area();
    const views = P.CINEMA.matchedViews(width, height, 0, 0);
    s.scene.render({ physics: s.physics, reducedMotion: false });
    assert.equal(s.orbs.length, count); assert.equal(s.plates[0].shot, 'front');
    assert.equal(s.plates[0].alpha, 1); assert.equal(s.cinema.canvas.dataset.handPhase, 'emerging');
    for (let i = 0; i < count; i++) {
      const tube = P.CINEMA.project(s.cinema.chamber.pose(i), views.front, views.angle, 0), pose = s.orbs[i].pose;
      assert.equal(pose.id, s.physics.marbles[i].id); assert.equal(s.orbs[i].marbleId, pose.id);
      close(pose.x, tube.x, 'tube x ' + count); close(pose.y, tube.y, 'tube y ' + count);
      close(pose.radius, views.frame.thickness * .42 * s.cinema.chamber.radius, 'tube radius');
      close(pose.x, area.x + s.scene.sources[i].x * area.s, 'recorded source x');
    }
    const beginning = s.scene.lastPoses.map(pose => ({ ...pose }));
    s.scene.elapsed = .00001; s.scene.render({ physics: s.physics, reducedMotion: false });
    for (let i = 0; i < count; i++) {
      close(s.scene.lastPoses[i].x, beginning[i].x, 'initial extraction has no jump');
      close(s.scene.lastPoses[i].y, beginning[i].y, 'initial extraction y has no jump');
    }
  }
});

test('fully extracted display circles match individual collision radii and preserve all IDs', () => {
  for (const count of counts) for (const [width, height] of sizes) {
    const s = setup(count, width, height), slots = positions(s.physics), area = s.scene.area();
    s.scene.update(.8); s.scene.render({ physics: s.physics, reducedMotion: false });
    assert.equal(s.plates.length, 0); assert.equal(s.scene.lastPoses.length, count);
    assert.equal(new Set(s.scene.lastPoses.map(p => p.id)).size, count);
    for (let i = 0; i < count; i++) {
      const body = s.scene.shuffle.bodies[i], pose = s.scene.lastPoses[i];
      assert.equal(pose.id, body.id); assert.equal(pose.id, s.physics.marbles[i].id);
      close(pose.x, area.x + body.x * area.s, 'extracted x');
      close(pose.y, area.y + body.y * area.s, 'extracted y');
      close(pose.radius, body.r * area.s, 'display radius equals collision radius');
      assert.ok(pose.x - pose.radius >= 16 - 1e-8 && pose.x + pose.radius <= width - 16 + 1e-8);
      assert.ok(pose.y - pose.radius >= 24 - 1e-8 && pose.y + pose.radius <= height - 24 + 1e-8);
    }
    const endpoint = s.scene.lastPoses.map(pose => ({ ...pose }));
    s.scene.elapsed = .8 - .00001; s.scene.render({ physics: s.physics, reducedMotion: false });
    for (let i = 0; i < count; i++) {
      close(s.scene.lastPoses[i].x, endpoint[i].x, 'end extraction x has no jump');
      close(s.scene.lastPoses[i].y, endpoint[i].y, 'end extraction y has no jump');
      close(s.scene.lastPoses[i].radius, endpoint[i].radius, 'end extraction radius has no jump');
    }
    assert.equal(positions(s.physics), slots); assert.equal(s.physics.time, 0); assert.equal(s.physics.ticks, 0);
    assert.equal(s.randomDraws(), 0, 'display extraction consumes no race RNG');
  }
});

test('pale boundary stays at .24 S and the gold arc highlights only a valid outward direction', () => {
  for (const count of counts) for (const [width, height] of sizes) for (const [dx, dy] of [[.36, 0], [-.30, -.24], [0, .36]]) {
    const s = setup(count, width, height), area = s.scene.area(); s.scene.update(.8);
    s.scene.gate.begin(0, 0, 0); s.scene.gate.move(dx, dy, 100); now = 100;
    s.scene.render({ physics: s.physics, reducedMotion: false });
    const pale = s.strokes.filter(stroke => stroke.style === 'rgba(158,126,76,.20)');
    const gold = s.strokes.filter(stroke => stroke.style === '#c9a24f');
    assert.equal(pale.length, 1); assert.equal(gold.length, 1); assert.equal(s.cinema.canvas.dataset.throwReady, 'true');
    const circle = pale[0].arcs[0], arc = gold[0].arcs[0];
    close(circle[0], area.x, 'circle center x'); close(circle[1], area.y, 'circle center y');
    close(circle[2], .24 * area.s, 'circle boundary radius'); close(circle[3], 0, 'circle begins at zero'); close(circle[4], Math.PI * 2, 'circle is complete');
    close(arc[2], circle[2], 'gold shares boundary radius'); close((arc[3] + arc[4]) / 2, Math.atan2(dy, dx), 'gold direction');
    assert.ok(arc[4] - arc[3] < Math.PI / 2, 'gold feedback is a directional arc, not an entire flash');
    now = 211; s.scene.render({ physics: s.physics, reducedMotion: false });
    assert.equal(s.strokes.filter(stroke => stroke.style === '#c9a24f').length, 0, 'stationary release cannot reuse an old flick');
    assert.equal(s.strokes.filter(stroke => stroke.style === 'rgba(158,126,76,.20)').length, 1);
    assert.equal(s.cinema.canvas.dataset.throwReady, 'false');
  }
});

test('rejected slow, short and circular movements never produce the ready arc', () => {
  const cases = [
    [[0, 0, 0], [.3, 0, 1000]],
    [[.22, 0, 0], [.30, 0, 20]],
    [[.2, 0, 0], [0, .2, 50], [-.2, 0, 100]]
  ];
  for (const points of cases) {
    const s = setup(50, 390, 844); s.scene.update(.8);
    s.scene.gate.begin(...points[0]); for (const point of points.slice(1)) s.scene.gate.move(...point);
    now = points.at(-1)[2]; s.scene.render({ physics: s.physics, reducedMotion: false });
    assert.equal(s.strokes.filter(stroke => stroke.style === '#c9a24f').length, 0);
    assert.equal(s.cinema.canvas.dataset.throwReady, 'false');
  }
});

test('motion setting renders preserve body state, elapsed time, RNG and boundary decisions', () => {
  for (const count of counts) for (const [width, height] of sizes) {
    const s = setup(count, width, height); s.scene.update(.8);
    s.scene.shuffle.begin(0, 0, 0); s.scene.shuffle.move(.1, .06, 80); s.scene.update(1 / 60);
    s.scene.gate.begin(0, 0, 0); s.scene.gate.move(.36, 0, 100); now = 100;
    const snapshot = JSON.stringify(s.scene.shuffle.snapshot()), slots = positions(s.physics), elapsed = s.scene.elapsed;
    s.scene.render({ physics: s.physics, reducedMotion: false });
    const poses = JSON.stringify(s.scene.lastPoses), decision = s.cinema.canvas.dataset.throwReady;
    assert.equal(s.strokes.find(stroke => stroke.style === '#c9a24f').shadowBlur, 8);
    for (const reducedMotion of [true, false, true]) {
      s.scene.render({ physics: s.physics, reducedMotion });
      assert.equal(JSON.stringify(s.scene.shuffle.snapshot()), snapshot); assert.equal(s.scene.elapsed, elapsed);
      assert.equal(JSON.stringify(s.scene.lastPoses), poses); assert.equal(s.cinema.canvas.dataset.throwReady, decision);
      assert.equal(s.strokes.find(stroke => stroke.style === '#c9a24f').shadowBlur, reducedMotion ? 0 : 8);
    }
    assert.equal(positions(s.physics), slots); assert.equal(s.physics.time, 0); assert.equal(s.randomDraws(), 0);
  }
});

test('every current shuffle pose connects continuously to the first real flight frame', () => {
  for (const count of counts) for (const [width, height] of sizes) {
    const s = setup(count, width, height); s.scene.update(.8);
    s.scene.shuffle.begin(0, 0, 0);
    for (let step = 1; step <= 12; step++) {
      s.scene.shuffle.move(step * .025, -.02 * Math.sin(step), step * 1000 / 120); s.scene.update(1 / 120);
    }
    s.scene.shuffle.release(); s.scene.render({ physics: s.physics, reducedMotion: false });
    const source = s.scene.lastPoses.map(pose => ({ ...pose }));
    const camera = { zoom: .5, x: 500, y: 450, viewport: { x: 0, y: 0, w: width, h: height },
      worldToScreen(x, y) { return { x: width / 2 + (x - 500) * .5, y: height / 2 + (y - 450) * .5 }; } };
    s.scene.camera = camera;
    const flight = new P.HandFlight(s.cinema);
    flight.begin(s.physics, s.scene, { dx: .36, dy: -.02 }, 2.8, false);
    flight.render({ stage: 'flight', progress: 0, physics: s.physics, camera, reducedMotion: false });
    for (let i = 0; i < count; i++) {
      const pose = flight.lastPoses[i], body = s.scene.shuffle.bodies[i];
      assert.equal(pose.id, source[i].id); close(pose.x, source[i].x, 'flight origin x'); close(pose.y, source[i].y, 'flight origin y');
      close(pose.radius, source[i].radius, 'flight origin radius');
      close(flight.pose(i, 0).vx, body.vx * s.scene.area().s, 'flight inherits release vx');
      close(flight.pose(i, 0).vy, body.vy * s.scene.area().s, 'flight inherits release vy');
    }
    assert.equal(s.physics.time, 0); assert.equal(s.physics.ticks, 0); assert.equal(s.randomDraws(), 0);
  }
});

test('manual slot commit preserves the previous seeded ownership for every count and waiting duration', () => {
  for (const count of counts) {
    let baseline;
    for (const wait of [0, 2]) {
      const output = {};
      for (const method of ['commitShuffle', 'commitHandSlots']) {
        const preview = game(count, 'POLICY-PREVIEW'), physics = game(count, 'POLICY-RACE-' + count);
        const { cinema } = makeCinema(1280, 800);
        cinema.entries(preview); cinema.previewChamber.seek(wait, true); cinema.lastStage = 'setup';
        cinema.entries(physics); cinema.launchBirth = cinema.chamber.ticks / 120;
        let randomDraws = 0; const random = physics.random;
        physics.random = () => { randomDraws++; return random(); };
        const slots = physics.marbles.map(m => [m.x, m.y, m.vx, m.vy]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        assert.equal(typeof cinema[method], 'function', method + ' must be available'); cinema[method](physics);
        const after = positions(physics); cinema[method](physics);
        assert.equal(positions(physics), after, method + ' is committed once');
        assert.equal(JSON.stringify(physics.marbles.map(m => [m.x, m.y, m.vx, m.vy]).sort((a, b) => a[1] - b[1] || a[0] - b[0])), JSON.stringify(slots), 'only ownership changes, never the seeded slot set');
        assert.equal(randomDraws, 0, method + ' does not consume race RNG');
        assert.equal(physics.time, 0); assert.equal(physics.ticks, 0); output[method] = after;
      }
      assert.equal(output.commitHandSlots, output.commitShuffle, count + ' manual and previous seeded slot ownership agree');
      if (baseline) assert.equal(output.commitHandSlots, baseline, 'waiting does not change seeded ownership');
      else baseline = output.commitHandSlots;
    }
  }
});
