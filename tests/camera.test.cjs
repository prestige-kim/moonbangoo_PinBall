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
