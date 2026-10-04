const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function scene(viewport) {
  const context = vm.createContext({ window: {}, document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/camera.js'), 'utf8'), context);
  const camera = new context.window.CosmicPinball.Camera({ addEventListener() {} });
  const map = { width: 1000, height: 7000, finish: { y: 6800 } };
  camera.viewport = viewport; camera.reset(map); camera.y = 1000;
  const physics = { marbles: [{ x: 500, y: 200, finished: false }], getRanking() { return this.marbles; } };
  return { camera, map, physics };
}

test('start zoom expands smoothly while a desktop panel changes the board viewport', () => {
  const { camera, map, physics } = scene({ x: 380, y: 140, w: 600, h: 550 });
  const before = camera.worldToScreen(500, 1000), initialZoom = camera.zoom;
  camera.enter(map);
  camera.viewport = { x: 28, y: 140, w: 980, h: 550 };
  camera.update(0, physics, map, { status: 'countdown' });
  const anchored = camera.worldToScreen(500, 1000);
  assert.ok(Math.abs(before.x - anchored.x) < .001);
  assert.ok(Math.abs(before.y - anchored.y) < .001);
  let lastZoom = initialZoom;
  for (let tick = 0; tick < 64; tick++) {
    camera.update(1 / 60, physics, map, { status: 'countdown' });
    assert.ok(camera.zoom >= lastZoom - .0001, 'Entrance should zoom inward without a snap back');
    assert.ok(camera.zoom - lastZoom < .07, 'Zoom must stay smooth frame to frame');
    lastZoom = camera.zoom;
  }
  assert.ok(camera.zoom > initialZoom * 1.9);
  assert.equal(camera.entrance, null);
  assert.equal(camera.follow, true);
});

test('mobile entrance zooms without relying on a wider layout, and reset restores preparation framing', () => {
  const { camera, map, physics } = scene({ x: 14, y: 140, w: 347, h: 450 });
  const previewZoom = camera.zoom;
  camera.enter(map);
  for (let tick = 0; tick < 64; tick++) camera.update(1 / 60, physics, map, { status: 'countdown' });
  assert.ok(camera.zoom > previewZoom * 1.2);
  camera.reset(map);
  assert.equal(camera.zoom, previewZoom);
});

test('reduced motion uses a brief entrance and never advances physical marbles', () => {
  const { camera, map, physics } = scene({ x: 14, y: 140, w: 347, h: 450 });
  camera.enter(map, { reducedMotion: true });
  for (let tick = 0; tick < 12; tick++) camera.update(1 / 60, physics, map, { status: 'countdown' });
  assert.equal(camera.entrance, null);
  assert.equal(physics.marbles[0].y, 200);
});

function landingScene(viewport, count, radius, seed) {
  const context = vm.createContext({ window: {} });
  for (const file of ['maps.js', 'physics.js', 'camera.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
  }
  const P = context.window.CosmicPinball;
  const map = P.MAPS.classic;
  const physics = new P.Physics({ names: P.parseNames('착륙 확인*' + count), map, radius, seed });
  const camera = new P.Camera({}, { interactive: false });
  camera.viewport = viewport;
  return { camera, map, physics };
}

const landingViewports = [
  { x: 28, y: 140, w: 980, h: 550 },
  { x: 28, y: 120, w: 1384, h: 420 },
  { x: 14, y: 140, w: 347, h: 450 },
  { x: 14, y: 140, w: 292, h: 240 }
];

test('landing frames every real seeded spawn circle on desktop and mobile', () => {
  for (const viewport of landingViewports) {
    for (const count of [1, 6, 200, 500]) {
      for (const seed of ['landing-a', 'landing-b']) {
        const { camera, map, physics } = landingScene(viewport, count, 18, seed);
        const physicalState = JSON.stringify(physics.marbles);
        camera.prepareLanding(map, physics);
        assert.equal(camera.x, map.width / 2);
        assert.ok(camera.zoom > 0 && camera.zoom <= camera.baseZoom() * 1.04);
        for (const marble of physics.marbles) {
          const p = camera.worldToScreen(marble.x, marble.y), r = marble.r * camera.zoom;
          assert.ok(p.x - r >= viewport.x && p.x + r <= viewport.x + viewport.w, 'circle fits horizontally');
          assert.ok(p.y - r >= viewport.y && p.y + r <= viewport.y + viewport.h, 'circle fits vertically');
          assert.ok(marble.y + marble.r < 760, 'landing precedes first physical obstacle');
        }
        assert.equal(JSON.stringify(physics.marbles), physicalState, 'framing does not alter seeded physics');
        assert.equal(physics.time, 0);
      }
    }
  }
});

test('landing is deterministic and clears previous camera interaction without changing physical state', () => {
  const { camera, map, physics } = landingScene(landingViewports[0], 500, 18, 'repeat-landing');
  const before = JSON.stringify(physics.marbles);
  camera.prepareLanding(map, physics);
  const first = { x: camera.x, y: camera.y, zoom: camera.zoom };
  camera.x = 970; camera.y = 6200; camera.zoom = 2.8; camera.follow = false; camera.manualZoom = 2;
  camera.entrance = { elapsed: 1 }; camera.pointer.set(4, { x: 2, y: 3 }); camera.drag = {}; camera.pinch = {};
  camera.prepareLanding(map, physics);
  assert.deepEqual({ x: camera.x, y: camera.y, zoom: camera.zoom }, first);
  assert.equal(camera.follow, true);
  assert.equal(camera.manualZoom, 1);
  assert.equal(camera.entrance, null);
  assert.equal(camera.pointer.size, 0);
  assert.equal(camera.drag, null);
  assert.equal(camera.pinch, null);
  assert.equal(JSON.stringify(physics.marbles), before);
});

test('the first running frame smoothly follows the landing pose rather than resetting it', () => {
  for (const viewport of landingViewports) {
    for (const count of [6, 500]) {
      const { camera, map, physics } = landingScene(viewport, count, 18, 'first-running');
      const physicalState = JSON.stringify(physics.marbles);
      camera.prepareLanding(map, physics);
      const initial = { x: camera.x, y: camera.y, zoom: camera.zoom };
      const screen = physics.marbles.map(m => camera.worldToScreen(m.x, m.y));
      camera.update(0, physics, map, { status: 'running' });
      assert.deepEqual({ x: camera.x, y: camera.y, zoom: camera.zoom }, initial, 'zero-time handoff uses exactly the flight endpoint');
      camera.update(1 / 60, physics, map, { status: 'running' });
      assert.ok(Math.abs(camera.zoom - initial.zoom) < 0.03, 'first zoom change is bounded');
      for (let index = 0; index < physics.marbles.length; index++) {
        const m = physics.marbles[index], p = camera.worldToScreen(m.x, m.y);
        assert.ok(Math.hypot(p.x - screen[index].x, p.y - screen[index].y) < 30, 'first screen displacement stays below 30px');
        const r = m.r * camera.zoom;
        assert.ok(p.x - r >= viewport.x && p.x + r <= viewport.x + viewport.w);
        assert.ok(p.y - r >= viewport.y && p.y + r <= viewport.y + viewport.h, 'first normal frame retains all spawn circles');
      }
      assert.equal(JSON.stringify(physics.marbles), physicalState, 'camera update does not step or mutate physics');
      assert.equal(camera.entrance, null);
      assert.equal(camera.follow, true);
    }
  }
});
