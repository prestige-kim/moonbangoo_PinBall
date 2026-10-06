const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function boot(storage, options = {}) {
  const P = { THEMES: Object.fromEntries(['cosmic', 'candy', 'gold', 'ice'].map(id => [id, { id, primary: '#8af' }])) };
  const callbacks = {};
  let frame;
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
    commitShuffle(physics) { this.commits = (this.commits || 0) + 1; this.commitTime = physics.time; }
    render(scene) {
      this.scene = scene;
      if (scene.stage === 'flight' && scene.progress === 1) {
        this.endpoints++; this.landingTime = scene.physics.time;
        this.positions = JSON.stringify(scene.physics.marbles.map(m => [m.x, m.y]));
      }
      return { reveal: scene.stage === 'flight' ? scene.progress : 0 };
    }
  }
  class Effects {
    constructor() { this.particles = []; this.rings = []; }
    handle() {} burst() {} celebrate() { this.celebrated = true; } update() {}
  }
  class AudioEngine { configure() {} unlock() { this.unlocks = (this.unlocks || 0) + 1; } play(type) { this.plays = (this.plays || 0) + 1; (this.types || (this.types = [])).push(type); } }
  Object.assign(P, { UI, Renderer, Camera, Cinematic, Effects, AudioEngine });
  const window = { CosmicPinball: P, matchMedia: () => ({ matches: false }), addEventListener() {} };
  const context = vm.createContext({ window, document: { hidden: false, getElementById: () => ({}), documentElement: { classList: { toggle() {} } }, addEventListener() {} },
    localStorage: storage || { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } },
    requestAnimationFrame(callback) { frame = callback; }, Uint32Array, Date, Math, console });
  for (const file of ['maps.js', 'physics.js', 'main.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  if (!options.intro) callbacks.enter();
  let clock = 0;
  function advance(seconds, frameRate = 60) {
    const count = Math.ceil(seconds * frameRate);
    for (let i = 0; i < count; i++) { clock += 1000 / frameRate; frame(clock); }
  }
  function launch() { advance(7.5); }
  return { P, callbacks, advance, launch };
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

test('start connects shuffle, camera aim, exact landing and immediate race with no second trigger', () => {
  const { P, callbacks, advance } = boot();
  callbacks.start();
  const physics = P.app.physics;
  const position = JSON.stringify(physics.marbles.map(m => [m.x, m.y]));
  const seed = P.app.runSettings.seed;
  assert.equal(P.app.status, 'mixing');
  callbacks.start(); callbacks.setupcancel();
  assert.equal(P.app.runSettings.seed, seed);
  advance(1.9);
  assert.equal(P.app.status, 'aiming');
  assert.equal(physics.time, 0);
  advance(2.3);
  assert.equal(P.app.status, 'flight');
  assert.equal(P.app.camera.prepared, true);
  assert.equal(P.app.cinematic.commits, 1); assert.equal(P.app.cinematic.commitTime, 0);
  assert.equal(P.app.renderer.scene.hideMarbles, true, 'Stationary balls must not duplicate the flying balls');
  assert.equal(physics.time, 0);
  advance(3.2);
  assert.equal(P.app.cinematic.endpoints, 1, 'The exact p=1 landing frame is rendered once');
  assert.equal(P.app.cinematic.commits, 1, 'Shuffle ownership is committed once before discharge');
  assert.equal(P.app.cinematic.landingTime, 0);
  assert.equal(P.app.cinematic.positions, position);
  assert.equal(P.app.status, 'running');
  assert.ok(physics.time > 0, 'Physics starts immediately after visual landing');
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

test('reduced motion shortens film while preserving seeded physics and exact landing', () => {
  const normal = boot(), reduced = boot();
  for (const instance of [normal, reduced]) Object.assign(instance.P.app.ui.values, { seed: 'FIXED-START' });
  reduced.P.app.ui.values.reducedMotion = true;
  normal.callbacks.start(); reduced.callbacks.start();
  const positions = app => JSON.stringify(app.physics.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy]));
  assert.equal(positions(normal.P.app), positions(reduced.P.app));
  reduced.advance(1.5); normal.advance(1.5);
  assert.equal(reduced.P.app.status, 'running');
  assert.equal(reduced.P.app.cinematic.endpoints, 1);
  assert.equal(normal.P.app.status, 'mixing');
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
  assert.equal(P.app.settings.theme, 'gold');
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
  assert.match(P.app.ui.errors[0], /구슬 수/);
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
  assert.equal(P.app.renderer.theme, 'ice');
  assert.equal(P.app.renderer.reduced, true);
});

test('race finishes, shows seeded results and same-member restart reproduces order at another frame rate', () => {
  const { P, callbacks, advance, launch } = boot();
  Object.assign(P.app.ui.values, { names: '왼쪽,오른쪽', speed: 3, rule: 'last', seed: 'REPLAY-TEST' });
  callbacks.start(); launch();
  advance(120, 60);
  assert.equal(P.app.status, 'finished');
  const first = Array.from(P.app.physics.finished, m => m.id);
  assert.equal(first.length, 2);
  assert.ok(P.app.ui.results);
  assert.equal(P.app.ui.results.seed, 'REPLAY-TEST');
  assert.equal(P.app.ui.results.winners[0].id, first[1]);
  callbacks.restart(); launch();
  advance(120, 30);
  assert.equal(P.app.status, 'finished');
  assert.deepEqual(Array.from(P.app.physics.finished, m => m.id), first);
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

test('stuck recovery is named in the UI, rate limited and reset for a new race', () => {
  const { P, callbacks, advance, launch } = boot();
  callbacks.start(); launch();
  const p = P.app.physics, notices = [];
  P.app.ui.toast = message => notices.push(message);
  for (let i = 0; i < 8; i++) p._event('rescue', p.marbles[0]);
  advance(1 / 60);
  assert.equal(notices.filter(x => x.includes('막힘 방지')).length, 1);
  p._event('rescue', p.marbles[1]); advance(1 / 60);
  assert.equal(notices.filter(x => x.includes('막힘 방지')).length, 1, 'no repeated stack of rescue messages');
  advance(120);
  callbacks.restart(); launch();
  const next = P.app.physics;
  notices.length = 0;
  next._event('rescue', next.marbles[0]); advance(1 / 60);
  assert.equal(notices.filter(x => x.includes('막힘 방지')).length, 1, 'notice cooldown resets on replay');
});


test('cannon sound fires once at discharge rather than when the flight scene first appears', () => {
  const { P, callbacks, advance } = boot();
  callbacks.start();
  advance(4.03);
  assert.equal(P.app.status, 'flight');
  assert.equal(P.app.audio.types.filter(type => type === 'charge').length, 1);
  assert.equal(P.app.audio.types.filter(type => type === 'cannon').length, 0);
  advance(.42);
  assert.equal(P.app.audio.types.filter(type => type === 'cannon').length, 1);
  advance(3);
  assert.equal(P.app.status, 'running');
  assert.equal(P.app.audio.types.filter(type => type === 'cannon').length, 1);
});
