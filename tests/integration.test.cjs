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
    setIntroMode(value) { this.introMode = value; }
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
    render(value) { this.scene = value; } drawMinimap() {}
  }
  class Camera {
    reset() { this.x = 500; this.y = 450; this.zoom = 1; }
    enter() { this.entered = true; this.follow = true; }
    update() {} attach() {}
  }
  class Effects {
    constructor() { this.particles = []; this.rings = []; }
    handle() {} burst() {} celebrate() { this.celebrated = true; } update() {}
  }
  class AudioEngine { configure() {} unlock() { this.unlocks = (this.unlocks || 0) + 1; } play() { this.plays = (this.plays || 0) + 1; } }
  Object.assign(P, { UI, Renderer, Camera, Effects, AudioEngine });
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
  return { P, callbacks, advance };
}

test('welcome demo stays independent and silent until entry; entry opens preparation without launching', () => {
  const saved = new Map([['mungbanggu-pinball-settings-v2', JSON.stringify({ names: '손님*50', seed: '내-시드', theme: 'gold' })]]);
  const { P, callbacks, advance } = boot({ getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) }, { intro: true });
  const realPhysics = P.app.physics, originalTime = realPhysics.time;
  assert.equal(P.app.status, 'intro');
  assert.equal(P.app.ui.introMode, true);
  callbacks.start();
  assert.equal(P.app.status, 'intro', 'Hidden game controls cannot launch through the welcome gate');
  advance(75);
  assert.notEqual(P.app.renderer.scene.physics, realPhysics);
  assert.ok(P.app.renderer.scene.physics.time > 30, 'Background mock should keep moving');
  assert.equal(realPhysics.time, originalTime);
  assert.equal(P.app.settings.names, '손님*50');
  assert.equal(P.app.settings.seed, '내-시드');
  assert.equal(saved.size, 1, 'Demo must never save or replace user settings');
  assert.equal(P.app.audio.plays, undefined);
  assert.equal(P.app.audio.unlocks, undefined);
  assert.equal(P.app.ui.results, null);
  callbacks.enter();
  assert.equal(P.app.status, 'idle');
  assert.equal(P.app.ui.introMode, false);
  assert.equal(P.app.renderer.theme, 'gold', 'Entering restores the saved game theme');
  assert.equal(P.app.physics.time, originalTime);
  callbacks.start(); advance(3.2);
  assert.equal(P.app.status, 'running');
});

test('reduced motion freezes the welcome mock while keeping entry available', () => {
  const { P, callbacks, advance } = boot({ getItem: () => JSON.stringify({ reducedMotion: true }), setItem() {} }, { intro: true });
  advance(1);
  const demoTime = P.app.renderer.scene.physics.time;
  advance(10);
  assert.equal(P.app.renderer.scene.physics.time, demoTime);
  assert.equal(P.app.status, 'intro');
  callbacks.enter();
  assert.equal(P.app.status, 'idle');
});

test('blocked localStorage falls back and countdown starts a real race', () => {
  const { P, callbacks, advance } = boot();
  assert.equal(P.app.status, 'idle');
  assert.equal(P.app.physics.marbles.length, 6);
  callbacks.start();
  assert.equal(P.app.status, 'countdown');
  assert.equal(P.app.ui.locked, true);
  assert.equal(P.app.ui.focusMode, true);
  assert.equal(P.app.camera.entered, true);
  advance(3.2);
  assert.equal(P.app.status, 'running');
  assert.ok(P.app.physics.time > 0);
  callbacks.reset();
  assert.equal(P.app.status, 'idle');
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
  assert.equal(P.app.status, 'idle');
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
  const { P, callbacks, advance } = boot();
  callbacks.start(); advance(3.2);
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
  const { P, callbacks, advance } = boot();
  Object.assign(P.app.ui.values, { names: '왼쪽,오른쪽', speed: 3, rule: 'last' });
  callbacks.start();
  advance(120, 60);
  assert.equal(P.app.status, 'finished');
  const first = Array.from(P.app.physics.finished, m => m.id);
  assert.equal(first.length, 2);
  assert.ok(P.app.ui.results);
  assert.equal(P.app.ui.results.seed, 'MUNGBANGGU-2026');
  assert.equal(P.app.ui.results.winners[0].id, first[1]);
  callbacks.restart();
  advance(120, 30);
  assert.equal(P.app.status, 'finished');
  assert.deepEqual(Array.from(P.app.physics.finished, m => m.id), first);
});

test('sustained slow rendering lowers quality without resetting physics', () => {
  const { P, callbacks, advance } = boot();
  Object.assign(P.app.ui.values, { names: '참가자*200', speed: 0.5 });
  callbacks.start();
  const originalPhysics = P.app.physics;
  advance(15, 20);
  assert.equal(P.app.physics, originalPhysics);
  assert.notEqual(P.app.renderer.quality, 'high');
  assert.ok(P.app.diagnostics.autoQualityDrops >= 1);
});

test('a natural six-marble race triggers lead changes and celebration', () => {
  const { P, callbacks, advance } = boot();
  callbacks.start(); advance(120);
  assert.equal(P.app.status, 'finished');
  assert.ok(P.app.diagnostics.leadChanges > 0, 'Lead changes should trigger a highlight');
  assert.equal(P.app.effects.celebrated, true);
});

test('leaders arriving close together trigger the photo finish view', () => {
  const { P, callbacks, advance } = boot();
  callbacks.start(); advance(3.2);
  const physics = P.app.physics, finishY = physics.map.finish.y;
  physics.marbles[0].y = finishY - 200;
  physics.marbles[1].y = finishY - 220;
  advance(1 / 60);
  assert.equal(P.app.diagnostics.photoFinishes, 1);
  assert.equal(P.app.renderer.scene.photoFinish, true);
});
