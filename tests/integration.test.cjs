const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.INTEGRATION_REPO_ROOT || path.join(__dirname, '..');

function boot(storage, options = {}) {
  const P = { THEMES: Object.fromEntries(['cosmic', 'candy', 'gold', 'ice'].map(id => [id, { id, primary: '#8af' }])) };
  const callbacks = {};
  let frame;
  let clock = 0;
  class UI {
    constructor() { this.values = {}; this.errors = []; this.results = null; }
    load(values) { this.values = { ...values }; }
    readSettings() { return { ...this.values }; }
    on(name, handler) { callbacks[name] = handler; }
    setTheme(theme) { this.theme = theme; }
    setStatus(value) { this.status = value; }
    setLocked(value) { this.locked = value; }
    setFocusMode(value) { this.focusMode = value; }
    setScene(value) { this.scene = value; this.focusMode = !['intro', 'setup'].includes(value); }
    setSceneProgress(value) { this.reveal = value.reveal; }
    getViewport() { return { x: 0, y: 0, w: 1000, h: 700 }; }
    hideResults() { this.results = null; }
    hideCountdown() { this.countdown = null; }
    showCountdown(value) { this.countdown = value; }
    updateHUD(value) { this.hud = value; }
    toast(value) { this.lastToast = value; }
    showResults(value) { this.results = value; }
    showError(value) { this.errors.push(value); }
    clearError() { this.errors = []; }
  }
  class Renderer {
    resize() {} setTheme(value) { this.theme = value; }
    setQuality(value) { this.quality = value; }
    setReducedMotion(value) { this.reduced = value; }
    render(value) { this.scene = value; } drawMinimap() {} drawLaunch(canvas, value) { this.launchScene = value; }
  }
  class Camera {
    reset() { this.x = 500; this.y = 450; this.zoom = 1; }
    prepareLanding() { this.prepared = true; this.follow = true; }
    update() {} attach() {}
  }
  class Cinematic {
    constructor() { this.endpoints = 0; }
    commitHandSlots(physics) { this.commits = (this.commits || 0) + 1; this.commitTime = physics.time; }
    render(scene) {
      this.scene = scene;
      if (scene.stage === 'flight' && scene.progress === 1) {
        this.endpoints++; this.landingTime = scene.physics.time;
        this.positions = JSON.stringify(scene.physics.marbles.map(m => [m.x, m.y]));
      }
      return { reveal: scene.stage === 'flight' ? scene.progress : 0 };
    }
  }
  class HandScene {
    constructor(cinema) { this.cinema = cinema; this.elapsed = 0; }
    begin(physics) {
      this.elapsed = 0; this.launchDecision = null;
      const bodies = physics.marbles.map((marble, index) => ({ id: marble.id, index,
        x: (index % 5 - 2) * .03, y: Math.floor(index / 5) * .03, r: .012, vx: 0, vy: 0, spin: 0 }));
      this.shuffle = {
        bodies, released: 0,
        begin(x, y, time) { this.start = { x, y, time }; this.interacted = false; },
        move(x, y, time) { this.last = { x, y, time }; bodies[0].x = x; bodies[0].y = y; bodies[0].vx = .4; if (Math.abs(x) < .35 && Math.abs(y) < .35) this.interacted = true; return this.interacted; },
        release() { this.released++; },
        snapshot() { return bodies.map(body => ({ ...body })); }
      };
    }
    area() { return { x: 500, y: 350, s: 650, w: 1000, h: 700 }; }
    update(dt) { this.elapsed += dt; }
    render(scene) { this.scene = scene; return { reveal: 0 }; }
  }
  class ShuffleInput {
    constructor(canvas, handlers) { this.canvas = canvas; this.callbacks = handlers; }
    cancel() { this.callbacks.cancel(); }
  }
  class HandFlight {
    constructor(cinema) { this.cinema = cinema; this.endpoints = 0; }
    begin(physics, handScene, decision) {
      this.begins = (this.begins || 0) + 1;
      this.releaseState = handScene.shuffle.snapshot(); this.decision = decision;
      this.ids = Array.from(physics.marbles, m => m.id);
    }
    render(scene) {
      this.scene = scene;
      if (scene.progress === 1) {
        this.endpoints++; this.landingTime = scene.physics.time;
        this.positions = JSON.stringify(scene.physics.marbles.map(m => [m.x, m.y]));
      }
      return { reveal: scene.progress };
    }
  }
  class Effects {
    constructor() { this.particles = []; this.rings = []; }
    handle() {} burst() {} celebrate() { this.celebrated = true; } update() {}
  }
  class AudioEngine { configure() {} unlock() { this.unlocks = (this.unlocks || 0) + 1; } play(type) { this.plays = (this.plays || 0) + 1; (this.types || (this.types = [])).push(type); } }
  Object.assign(P, { UI, Renderer, Camera, Cinematic, HandScene, ShuffleInput, HandFlight, Effects, AudioEngine });
  const window = { CosmicPinball: P, matchMedia: () => ({ matches: false }), addEventListener() {} };
  const context = vm.createContext({ window, document: { hidden: false, getElementById: () => ({}), documentElement: { classList: { toggle() {} } }, addEventListener() {} },
    localStorage: storage || { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } },
    requestAnimationFrame(callback) { frame = callback; }, performance: { now: () => clock }, Uint32Array, Date, Math, console });
  for (const file of ['maps.js', 'physics.js', 'throw-gate.js', 'race-standing.js', 'main.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  if (!options.intro) callbacks.enter();
  function advance(seconds, frameRate = 60) {
    const count = Math.ceil(seconds * frameRate);
    for (let i = 0; i < count; i++) { clock += 1000 / frameRate; frame(clock); }
  }
  function gesture(points = [[0, 0, 0], [.30, 0, 800], [.68, 0, 1800]]) {
    const input = P.app.shuffleInput.callbacks, started = clock;
    input.begin({ x: points[0][0], y: points[0][1], time: started + points[0][2] });
    for (const point of points.slice(1, -1)) input.move({ x: point[0], y: point[1], time: started + point[2] });
    const last = points.at(-1); input.release({ x: last[0], y: last[1], time: started + last[2] });
  }
  function launch() { advance(.85); gesture(); advance(3.1); }
  return { P, callbacks, advance, gesture, launch };
}

test('welcome uses configured participants without advancing physics or changing saved settings', () => {
  const saved = new Map([['mungbanggu-pinball-settings-v2', JSON.stringify({ names: '손님*50', seed: '내-시드', theme: 'gold' })]]);
  const { P, callbacks, advance } = boot({ getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) }, { intro: true });
  const physics = P.app.physics;
  callbacks.start(); advance(10);
  assert.equal(P.app.status, 'intro');
  assert.equal(P.app.cinematic.scene.physics, physics);
  assert.equal(physics.time, 0);
  assert.equal(physics.marbles.length, 50);
  assert.equal(P.app.settings.seed, '내-시드');
  assert.equal(saved.size, 1);
  assert.equal(P.app.audio.unlocks, undefined);
  callbacks.enter();
  assert.equal(P.app.status, 'setup');
  assert.equal(P.app.physics, physics, 'Opening the modal preserves the shuffling participants');
  callbacks.setupcancel();
  assert.equal(P.app.status, 'intro');
  callbacks.enter();
  assert.equal(P.app.status, 'setup');
});

test('start waits for a valid manual throw and connects exact flight landing to the race once', () => {
  const { P, callbacks, advance, gesture } = boot();
  callbacks.start();
  const physics = P.app.physics;
  const position = JSON.stringify(physics.marbles.map(m => [m.x, m.y]));
  const ids = Array.from(physics.marbles, m => m.id);
  const seed = P.app.runSettings.seed;
  assert.equal(P.app.status, 'mixing');
  callbacks.start(); callbacks.setupcancel(); advance(30);
  assert.equal(P.app.status, 'mixing', 'waiting never assembles a cannon or starts the race');
  assert.equal(physics.time, 0); assert.equal(P.app.runSettings.seed, seed);
  assert.equal(P.app.cinematic.commits, undefined);
  gesture();
  assert.equal(P.app.status, 'flight'); assert.equal(P.app.camera.prepared, true);
  assert.equal(P.app.cinematic.commits, 1); assert.equal(P.app.cinematic.commitTime, 0);
  assert.equal(P.app.handFlight.begins, 1);
  assert.deepEqual(P.app.handFlight.ids, ids);
  assert.equal(P.app.handFlight.releaseState[0].x, .68, 'flight begins from current visual body positions');
  advance(1 / 60);
  assert.equal(P.app.renderer.scene.hideMarbles, true, 'stationary race balls do not duplicate flying balls');
  assert.equal(physics.time, 0);
  advance(3.1);
  assert.equal(P.app.handFlight.endpoints, 1, 'the exact p=1 landing frame renders once');
  assert.equal(P.app.cinematic.commits, 1); assert.equal(P.app.handFlight.landingTime, 0);
  assert.equal(P.app.handFlight.positions, position);
  assert.equal(P.app.status, 'running'); assert.ok(physics.time > 0);
});

test('automatic seeds refresh each round and restart without becoming a saved fixed seed', () => {
  const saved = new Map([['mungbanggu-pinball-settings-v2', JSON.stringify({ seed: 'MUNGBANGGU-2026', names: '가,나,다,라,마,바', speed: 3 })]]);
  const { P, callbacks, advance, launch } = boot({ getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) });
  assert.equal(P.app.settings.seed, '');
  callbacks.start();
  const firstSeed = P.app.runSettings.seed;
  const firstPositions = JSON.stringify(P.app.physics.marbles.map(m => [m.x, m.y]));
  assert.equal(P.app.ui.values.seed, '');
  assert.equal(JSON.parse(saved.get('mungbanggu-pinball-settings-v2')).seed, '');
  launch(); advance(120);
  assert.equal(P.app.status, 'finished');
  callbacks.restart();
  assert.equal(P.app.status, 'mixing');
  assert.notEqual(P.app.runSettings.seed, firstSeed);
  assert.notEqual(JSON.stringify(P.app.physics.marbles.map(m => [m.x, m.y])), firstPositions);
  assert.equal(P.app.settings.seed, '');
});

test('reduced motion shortens flight with the same gesture decision, seed slots and exact landing', () => {
  const normal = boot(), reduced = boot();
  for (const instance of [normal, reduced]) Object.assign(instance.P.app.ui.values, { seed: 'FIXED-START' });
  reduced.P.app.ui.values.reducedMotion = true;
  normal.callbacks.start(); reduced.callbacks.start();
  const positions = app => JSON.stringify(app.physics.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy]));
  assert.equal(positions(normal.P.app), positions(reduced.P.app));
  for (const instance of [normal, reduced]) { instance.advance(.85); instance.gesture(); }
  assert.equal(normal.P.app.status, 'flight'); assert.equal(reduced.P.app.status, 'flight');
  assert.equal(JSON.stringify(normal.P.app.handFlight.decision), JSON.stringify(reduced.P.app.handFlight.decision));
  normal.advance(1.5); reduced.advance(1.5);
  assert.equal(reduced.P.app.status, 'running'); assert.equal(reduced.P.app.handFlight.endpoints, 1);
  assert.equal(normal.P.app.status, 'flight'); assert.equal(normal.P.app.physics.time, 0);
  normal.advance(1.6); assert.equal(normal.P.app.status, 'running');
});

test('setup edits appear in glass without starting physics; blocked storage still works', () => {
  const { P, callbacks, advance, launch } = boot();
  assert.equal(P.app.status, 'setup');
  Object.assign(P.app.ui.values, { names: '빨강*8,초록*7', map: 'dynamic' });
  callbacks.change(); advance(1);
  assert.equal(P.app.cinematic.scene.physics.marbles.length, 15);
  assert.equal(P.app.physics.time, 0);
  callbacks.start(); launch();
  assert.equal(P.app.status, 'running');
  assert.equal(P.app.ui.locked, true);
  assert.equal(P.app.ui.focusMode, true);
  assert.ok(P.app.physics.time > 0);
  callbacks.reset();
  assert.equal(P.app.status, 'setup');
  assert.equal(P.app.ui.focusMode, false);
});

test('original saved participants survive the brand upgrade with gentler default pacing', () => {
  const saved = new Map([['orbit-pinball-settings-v1', JSON.stringify({ names: '손님*50', gravity: 900, speed: 3,
    theme: 'gold', rule: 'last', seed: 'ORBIT-2026', sound: false })]]);
  const { P, callbacks } = boot({ getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) });
  assert.equal(P.app.settings.names, '손님*50');
  assert.equal(P.app.settings.gravity, 620);
  assert.equal(P.app.settings.speed, 1);
  assert.equal(P.app.settings.theme, 'cosmic');
  assert.equal(P.app.settings.rule, 'last');
  assert.equal(P.app.settings.sound, false);
  callbacks.start();
  assert.ok(saved.has('mungbanggu-pinball-settings-v2'));
});

test('invalid rank cannot launch a race', () => {
  const { P, callbacks } = boot();
  Object.assign(P.app.ui.values, { rule: 'nth', rankN: 7 });
  callbacks.start();
  assert.equal(P.app.status, 'setup');
  assert.match(P.app.ui.errors[0], /핀볼 수/);
});

test('first, last, nth and top rules select physical arrival order', () => {
  const { P } = boot();
  const ranking = [{ id: 2 }, { id: 4 }, { id: 1 }, { id: 3 }];
  const ids = values => Array.from(values, item => item.id);
  assert.deepEqual(ids(P.chooseWinners(ranking, { rule: 'first' })), [2]);
  assert.deepEqual(ids(P.chooseWinners(ranking, { rule: 'last' })), [3]);
  assert.deepEqual(ids(P.chooseWinners(ranking, { rule: 'nth', rankN: 3 })), [1]);
  assert.deepEqual(ids(P.chooseWinners(ranking, { rule: 'top', rankN: 2 })), [2, 4]);
});

test('live visuals and speed leave the physical run configuration intact', () => {
  const { P, callbacks, advance, launch } = boot();
  callbacks.start(); launch(); advance(3.2);
  const originalPhysics = P.app.physics;
  const originalSeed = P.app.runSettings.seed;
  Object.assign(P.app.ui.values, { theme: 'ice', reducedMotion: true, speed: 3, gravity: 1500 });
  callbacks.change();
  assert.equal(P.app.physics, originalPhysics);
  assert.equal(P.app.runSettings.gravity, 620);
  assert.equal(P.app.runSettings.seed, originalSeed);
  assert.equal(P.app.renderer.theme, 'cosmic');
  assert.equal(P.app.renderer.reduced, true);
});

test('race finishes, shows seeded results and same-member restart reproduces order at another frame rate', () => {
  const { P, callbacks, advance, launch } = boot();
  Object.assign(P.app.ui.values, { names: '왼쪽,오른쪽', speed: 3, rule: 'last', seed: 'REPLAY-TEST' });
  callbacks.start(); launch();
  advance(120, 60);
  assert.equal(P.app.status, 'finished');
  const first = Array.from(P.app.physics.finished, m => m.id);
  const firstTimes = Array.from(P.app.physics.finished, m => [m.id, m.finishTime]);
  assert.equal(first.length, 2);
  assert.ok(P.app.ui.results);
  assert.equal(P.app.ui.results.seed, 'REPLAY-TEST');
  assert.equal(P.app.ui.results.winners[0].id, first[1]);
  callbacks.restart(); launch();
  advance(120, 30);
  assert.equal(P.app.status, 'finished');
  assert.deepEqual(Array.from(P.app.physics.finished, m => m.id), first);
  assert.deepEqual(Array.from(P.app.physics.finished, m => [m.id, m.finishTime]), firstTimes);
});

test('sustained slow rendering lowers quality without resetting physics', () => {
  const { P, callbacks, advance, launch } = boot();
  Object.assign(P.app.ui.values, { names: '참가자*200', speed: 0.5 });
  callbacks.start(); launch();
  const originalPhysics = P.app.physics;
  advance(15, 20);
  assert.equal(P.app.physics, originalPhysics);
  assert.notEqual(P.app.renderer.quality, 'high');
  assert.ok(P.app.diagnostics.autoQualityDrops >= 1);
});

test('a natural six-marble race triggers lead changes and celebration', () => {
  const { P, callbacks, advance, launch } = boot();
  callbacks.start(); launch(); advance(120);
  assert.equal(P.app.status, 'finished');
  assert.ok(P.app.diagnostics.leadChanges > 0, 'Lead changes should trigger a highlight');
  assert.equal(P.app.effects.celebrated, true);
});

test('crowded races announce only settled leader changes and keep arrival results intact', () => {
  const { P, callbacks, advance, launch } = boot();
  Object.assign(P.app.ui.values, { names: '참가자*200', speed: 3, gravity: 1500, seed: 'VISUAL-HUD-200' });
  callbacks.start(); launch();
  const physics = P.app.physics, notices = [];
  P.app.ui.toast = message => { if (message.startsWith('선두 교체')) notices.push({ message, time: physics.time }); };
  advance(45);
  assert.equal(P.app.status, 'finished');
  assert.ok(notices.length <= 3, 'lead messages do not occupy the HUD repeatedly');
  for (let i = 1; i < notices.length; i++) assert.ok(notices[i].time - notices[i - 1].time >= 6, 'lead alerts have breathing room');
  assert.equal(physics.finished.length, 200);
  assert.ok(physics.finished.every(m => Number.isFinite(m.finishTime)));
});

test('leaders arriving close together trigger the photo finish view', () => {
  const { P, callbacks, advance, launch } = boot();
  callbacks.start(); launch(); advance(3.2);
  const physics = P.app.physics, finishY = physics.map.finish.y;
  physics.marbles[0].y = finishY - 200;
  physics.marbles[1].y = finishY - 220;
  advance(1 / 60);
  assert.equal(P.app.diagnostics.photoFinishes, 1);
  assert.equal(P.app.renderer.scene.photoFinish, true);
});

test('stuck recovery events stay active without notification toasts, including replay', () => {
  const { P, callbacks, advance, launch } = boot();
  callbacks.start(); launch();
  const p = P.app.physics, notices = [];
  P.app.ui.toast = message => notices.push(message);
  for (let i = 0; i < 8; i++) p._event('rescue', p.marbles[0]);
  advance(1 / 60);
  assert.equal(notices.filter(x => x.includes('막힘 방지')).length, 0);
  assert.equal(P.app.diagnostics.events.rescue, 8);
  assert.ok(P.app.audio.types.includes('rescue'));
  p._event('rescue', p.marbles[1]); advance(1 / 60);
  assert.equal(notices.filter(x => x.includes('막힘 방지')).length, 0, 'repeated recovery does not show notifications');
  advance(120);
  callbacks.restart(); launch();
  const next = P.app.physics;
  notices.length = 0;
  next._event('rescue', next.marbles[0]); advance(1 / 60);
  assert.equal(notices.filter(x => x.includes('막힘 방지')).length, 0, 'replay also keeps recovery silent');
});


test('a valid release plays one launch sound, without automatic charge or cannon sounds', () => {
  const { P, callbacks, advance, gesture } = boot(); callbacks.start(); advance(12);
  assert.deepEqual(P.app.audio.types || [], []);
  gesture(); assert.equal(P.app.status, 'flight');
  assert.deepEqual(P.app.audio.types, ['launch']);
  const input = P.app.shuffleInput.callbacks;
  input.release({ x: .5, y: 0, time: 13000 });
  input.cancel(); advance(1);
  assert.deepEqual(P.app.audio.types, ['launch']); assert.equal(P.app.handFlight.begins, 1);
  advance(2.1); assert.equal(P.app.status, 'running');
  assert.equal(P.app.audio.types.filter(type => type === 'launch').length, 1);
  assert.equal(P.app.audio.types.filter(type => ['charge', 'cannon'].includes(type)).length, 0);
});

test('rejected and canceled gestures preserve race RNG, seed slots and visual state continuity', () => {
  const { P, callbacks, advance, gesture } = boot();
  P.app.ui.values.seed = 'REJECTED-THROWS'; callbacks.start(); advance(.85);
  const slots = JSON.stringify(P.app.physics.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy]));
  const originalRandom = P.app.physics.random;
  let randomDraws = 0;
  const random = P.app.physics.random = () => { randomDraws++; return originalRandom(); };
  for (const points of [
    [[0, 0, 0], [.3, 0, 700], [.31, 0, 800]],
    [[0, 0, 0], [.08, 0, 10], [.1, 0, 20]],
    [[.64, -.4, 0], [.68, -.4, 80], [.68, -.4, 280]]
  ]) {
    gesture(points); assert.equal(P.app.status, 'mixing');
    assert.equal(P.app.physics.time, 0); assert.equal(P.app.cinematic.commits, undefined);
  }
  const input = P.app.shuffleInput.callbacks;
  input.begin({ x: 0, y: 0, time: 1200 }); input.move({ x: .32, y: 0, time: 1260 });
  const visual = JSON.stringify(P.app.handScene.shuffle.snapshot());
  input.cancel(); input.release({ x: .4, y: 0, time: 1280 });
  assert.equal(P.app.status, 'mixing'); assert.equal(P.app.throwGate.active, false);
  assert.equal(JSON.stringify(P.app.handScene.shuffle.snapshot()), visual, 'cancel does not reset positions or velocities');
  assert.equal(JSON.stringify(P.app.physics.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy])), slots);
  assert.equal(P.app.physics.random, random); assert.equal(randomDraws, 0, 'visual input never consumes race RNG');
  assert.equal(P.app.runSettings.seed, 'REJECTED-THROWS');
  assert.deepEqual(P.app.audio.types || [], []);
});

test('motion changes retain shuffle positions and flight progress without catching up paused time', () => {
  const { P, callbacks, advance, gesture } = boot(); callbacks.start(); advance(.85);
  const input = P.app.shuffleInput.callbacks;
  input.begin({ x: 0, y: 0, time: 850 }); input.move({ x: .1, y: .05, time: 900 }); input.cancel();
  const visual = JSON.stringify(P.app.handScene.shuffle.snapshot()), handScene = P.app.handScene;
  const elapsed = handScene.elapsed;
  P.app.ui.values.reducedMotion = true; callbacks.change();
  assert.equal(P.app.handScene, handScene); assert.equal(JSON.stringify(handScene.shuffle.snapshot()), visual);
  assert.equal(handScene.elapsed, elapsed); advance(1 / 60);
  assert.ok(handScene.elapsed - elapsed < .02, 'only the new frame is advanced');
  P.app.ui.values.reducedMotion = false; callbacks.change(); gesture(); advance(.5);
  const before = P.app.handFlight.scene.progress;
  P.app.ui.values.reducedMotion = true; callbacks.change(); advance(1 / 60);
  assert.ok(P.app.handFlight.scene.progress > before);
  assert.ok(P.app.handFlight.scene.progress - before < .02, 'toggle does not jump to the reduced duration progress');
  assert.equal(P.app.renderer.reduced, true);
});

test('waiting time, gesture direction and render frame grouping preserve seeded slots and full results', () => {
  const normal = boot(), alternate = boot();
  const slots = instance => JSON.stringify(instance.P.app.physics.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy]));
  for (const instance of [normal, alternate]) {
    Object.assign(instance.P.app.ui.values, { seed: 'GESTURE-INDEPENDENT', names: '왼쪽,중앙,오른쪽', speed: 3 });
    instance.callbacks.start();
  }
  assert.equal(slots(normal), slots(alternate));
  normal.advance(.85); normal.gesture(); normal.advance(3.1);
  alternate.advance(18, 30); alternate.gesture([[0, 0, 0], [-.08, .02, 40], [-.30, -.03, 100], [-.68, -.04, 120]]); alternate.advance(3.1, 30);
  assert.equal(normal.P.app.status, 'running'); assert.equal(alternate.P.app.status, 'running');
  assert.equal(normal.P.app.handFlight.positions, alternate.P.app.handFlight.positions);
  normal.advance(120, 60); alternate.advance(120, 30);
  const results = instance => Array.from(instance.P.app.physics.finished, m => [m.id, m.finishTime]);
  assert.equal(normal.P.app.status, 'finished'); assert.equal(alternate.P.app.status, 'finished');
  assert.deepEqual(results(normal), results(alternate));
});

test('removed saved courses migrate to classic while preserving participants and physical settings', () => {
  for (const map of ['dynamic','hybrid']) {
    const values={map,names:'손님*50',seed:'CLASSIC-MIGRATION',gravity:800,restitution:.6,theme:'gold'};
    const {P,callbacks}=boot({getItem:()=>JSON.stringify(values),setItem(){}});
    assert.equal(P.app.settings.map,'classic');
    assert.equal(P.app.physics.map,P.MAPS.classic);
    assert.equal(P.app.physics.marbles.length,50);
    assert.equal(P.app.settings.seed,values.seed);assert.equal(P.app.settings.gravity,800);assert.equal(P.app.settings.restitution,.6);assert.equal(P.app.settings.theme,'cosmic');
    callbacks.start();assert.equal(P.app.runSettings.map,'classic');
  }
});

test('crossing the shuffle wall launches on movement before pointerup and ignores later samples',()=>{
 const {P,callbacks,advance}=boot();callbacks.start();advance(.85);
 const input=P.app.shuffleInput.callbacks;input.begin({x:0,y:0,time:1000});input.move({x:.30,y:0,time:1100});
 assert.equal(P.app.status,'mixing');input.move({x:.68,y:0,time:1200});
 assert.equal(P.app.status,'flight','no pointerup needed');
 const snapshot=JSON.stringify(P.app.handScene.shuffle.snapshot()),start=JSON.stringify(P.app.handFlight);
 input.move({x:.9,y:.1,time:1210});input.release({x:.9,y:.1,time:1300});input.release({x:.9,y:.1,time:1400});
 assert.equal(JSON.stringify(P.app.handScene.shuffle.snapshot()),snapshot);assert.equal(JSON.stringify(P.app.handFlight),start);
 assert.equal(P.app.audio.types.filter(type=>type==='launch').length,1);assert.equal(P.app.physics.time,0);
});

test('joint race progress does not select the first input as the rendered or HUD leader', () => {
  const { P, callbacks, advance, launch } = boot();
  callbacks.start(); launch();
  const marbles=P.app.physics.marbles;
  for(const m of marbles){m.y=100;m.vx=0;m.vy=0;}
  advance(.12);
  assert.equal(P.app.renderer.scene.leader,null);
  assert.equal(P.app.ui.hud.leader,null);
  const actual=marbles.at(-1);actual.y+=4;
  advance(.12);
  assert.equal(P.app.renderer.scene.leader.id,actual.id);
  assert.equal(P.app.ui.hud.leader.id,actual.id);
});
