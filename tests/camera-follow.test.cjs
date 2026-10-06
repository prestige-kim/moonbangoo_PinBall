const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, document: { addEventListener() {} } });
for (const file of ['maps.js', 'physics.js', 'cinematic.js', 'camera.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
const P = context.window.CosmicPinball;

const viewports = {
  desktop: { x: 355, y: 145, w: 820, h: 560 },
  portrait: { x: 14, y: 358, w: 347, h: 266 },
  landscape: { x: 14, y: 145, w: 560, h: 90 }
};

test('the leading marble remains inside the usable HUD-free view at all maps, speeds and orientations', () => {
  for (const map of Object.values(P.MAPS)) for (const speed of [0.5, 1, 3]) {
    for (const [orientation, area] of Object.entries(viewports)) {
      const camera = new P.Camera({}, { interactive: false });
      camera.viewport = area;
      const marble = { id: 0, x: 500, y: 520, r: 12, vx: 0, vy: 700, finished: false };
      const physics = { time: 0, marbles: [marble], getRanking() { return this.marbles; } };
      camera.prepareLanding(map, physics);
      let previous = camera.worldToScreen(marble.x, marble.y);
      for (let frame = 0; frame < 100; frame++) {
        const dt = 1 / 60;
        physics.time += dt * speed;
        marble.y += marble.vy * dt * speed;
        camera.update(dt, physics, map, { status: 'running' });
        const position = camera.worldToScreen(marble.x, marble.y);
        const radius = marble.r * camera.zoom;
        const inset = Math.min(20, area.h * .12);
        assert.ok(position.y + radius <= area.y + area.h - inset + .1,
          `${map.id}/${speed}/${orientation} frame ${frame}: leading marble fell below usable view (${position.y.toFixed(1)})`);
        assert.ok(position.y - radius >= area.y + inset - .1,
          `${map.id}/${speed}/${orientation} frame ${frame}: leading marble moved under top HUD`);
        if (frame > 1) assert.ok(Math.abs(position.y - previous.y) < 45,
          `${map.id}/${speed}/${orientation} frame ${frame}: camera jerked`);
        previous = position;
      }
    }
  }
});


test('real 3x races do not leave a sustained empty board after a leader finishes or teleports', () => {
  for (const map of Object.values(P.MAPS)) for (const area of Object.values(viewports)) {
    const physics = new P.Physics({ map, names: P.parseNames('구슬*6'), seed: 'CAMERA-AUDIT-' + map.id, gravity: 1500, restitution: .35, radius: 12 });
    Object.create(P.Cinematic.prototype).commitShuffle(physics);
    const camera = new P.Camera({}, { interactive: false });
    camera.viewport = area; camera.prepareLanding(map, physics);
    let frames = 0, blank = 0, longestBlank = 0, stepBalance = 0;
    while (!physics.complete && physics.time < 90) {
      const dt = 1 / 60; stepBalance += dt * 3;
      while (stepBalance >= P.PHYSICS_STEP) { physics.step(); stepBalance -= P.PHYSICS_STEP; }
      physics.drainEvents(); camera.update(dt, physics, map, { status: 'running' });
      const visible = physics.marbles.some(m => {
        const point = camera.worldToScreen(m.x, m.y), r = m.r * camera.zoom;
        return point.y + r >= area.y && point.y - r <= area.y + area.h && point.x + r >= area.x && point.x - r <= area.x + area.w;
      });
      blank = visible ? 0 : blank + 1; longestBlank = Math.max(longestBlank, blank); frames++;
    }
    assert.ok(physics.complete, `${map.id} did not finish`);
    assert.ok(longestBlank <= 18, `${map.id}/${area.w}x${area.h}: ${longestBlank} consecutive empty frames`);
    assert.ok(frames < 1200, `${map.id}: camera check exceeded 20 seconds of display time`);
  }
});

test('drag and wheel stop following; the follow key resumes without changing the race', () => {
  const canvasEvents = new Map(), docEvents = new Map(), changes = [];
  const doc = { addEventListener(name, fn) { docEvents.set(name, fn); } };
  const custom = vm.createContext({ window: {}, document: doc, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/camera.js'), 'utf8'), custom);
  const canvas = { clientWidth: 1000, clientHeight: 700, addEventListener(name, fn) { canvasEvents.set(name, fn); },
    dispatchEvent(event) { changes.push(event); }, setPointerCapture() {}, getBoundingClientRect() { return { left: 0, top: 0 }; } };
  const camera = new custom.window.CosmicPinball.Camera(canvas);
  const map = { width: 1000, height: 7160, finish: { y: 6960 } };
  const marble = { x: 500, y: 800, r: 12, vy: 700, finished: false };
  const physics = { time: 0, marbles: [marble], getRanking() { return this.marbles; } };
  camera.reset(map);
  canvasEvents.get('pointerdown')({ pointerId: 1, button: 0, clientX: 500, clientY: 350 });
  canvasEvents.get('pointermove')({ pointerId: 1, clientX: 540, clientY: 380 });
  assert.equal(camera.follow, false); assert.equal(changes.at(-1).detail, false);
  const manual = { x: camera.x, y: camera.y, zoom: camera.zoom };
  physics.time += 3 / 60; marble.y += 35; camera.update(1 / 60, physics, map, { status: 'running' });
  assert.deepEqual({ x: camera.x, y: camera.y, zoom: camera.zoom }, manual);
  canvasEvents.get('pointerup')({ pointerId: 1 });
  docEvents.get('keydown')({ key: 'f', target: { tagName: 'CANVAS' }, ctrlKey: false, metaKey: false, altKey: false });
  assert.equal(camera.follow, true); assert.equal(changes.at(-1).detail, true);
  canvasEvents.get('wheel')({ deltaY: -100, clientX: 500, clientY: 350, preventDefault() {} });
  assert.equal(camera.follow, false); assert.ok(camera.zoom > manual.zoom);
  const wheelZoom = camera.zoom;
  canvasEvents.get('pointerdown')({ pointerId: 2, button: 0, clientX: 400, clientY: 350 });
  canvasEvents.get('pointerdown')({ pointerId: 3, button: 0, clientX: 600, clientY: 350 });
  canvasEvents.get('pointermove')({ pointerId: 3, clientX: 680, clientY: 350 });
  assert.ok(camera.zoom > wheelZoom, 'pinching outward enlarges the map');
  assert.equal(camera.follow, false, 'pinch stays in manual mode');
  canvasEvents.get('pointerup')({ pointerId: 2 }); canvasEvents.get('pointerup')({ pointerId: 3 });
  assert.equal(physics.time, 3 / 60, 'camera gestures never advance physics');
});
