const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Override only for the pre-implementation missing-module regression run.
const source = fs.readFileSync(process.env.SHUFFLE_INPUT_SOURCE || path.join(__dirname, '../js/shuffle-input.js'), 'utf8');
function scene() {
  const canvas = new EventTarget(), window = new EventTarget(), document = new EventTarget();
  const captured = new Set(), calls = [], area = { x: 200, y: 300, s: 400 };
  let enabled = true;
  canvas.setPointerCapture = id => captured.add(id);
  canvas.releasePointerCapture = id => captured.delete(id);
  document.hidden = false;
  window.CosmicPinball = {};
  vm.runInNewContext(source, { window, document });
  const record = type => point => calls.push({ type, ...(point ? { point: { ...point } } : {}) });
  const input = new window.CosmicPinball.ShuffleInput(canvas, {
    enabled: () => enabled, area: () => area,
    begin: record('begin'), move: record('move'), release: record('release'), cancel: record('cancel')
  });
  function emit(type, props = {}, target = canvas) {
    const event = new Event(type, { cancelable: true });
    const values = type.startsWith('pointer') ? {
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
      clientX: 200, clientY: 300, timeStamp: 0, ...props
    } : props;
    for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value, configurable: true });
    target.dispatchEvent(event);
    return event;
  }
  return { input, canvas, window, document, captured, calls, area, emit, enable: value => { enabled = value; } };
}
const types = s => s.calls.map(call => call.type);

test('mouse and touch use identical normalized position and event-time models', () => {
  const results = [];
  for (const pointerType of ['mouse', 'touch']) {
    const s = scene();
    s.emit('pointerdown', { pointerType, clientX: 220, clientY: 280, timeStamp: 10 });
    s.emit('pointermove', { pointerType, clientX: 260, clientY: 320, timeStamp: 37 });
    s.emit('pointerup', { pointerType, clientX: 280, clientY: 360, timeStamp: 51 });
    results.push(s.calls);
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], [
    { type: 'begin', point: { x: .05, y: -.05, time: 10 } },
    { type: 'move', point: { x: .15, y: .05, time: 37 } },
    { type: 'release', point: { x: .2, y: .15, time: 51 } }
  ]);
});

test('captured drag keeps outside coordinates and releases capture only once', () => {
  const s = scene();
  assert.equal(s.emit('pointerdown').defaultPrevented, true);
  assert.equal(s.captured.has(1), true);
  assert.equal(s.emit('pointermove', { clientX: 1400, clientY: -500, timeStamp: 45 }).defaultPrevented, true);
  s.emit('pointerup', { clientX: 1400, clientY: -500, timeStamp: 50 });
  s.emit('pointerup', { timeStamp: 51 });
  s.emit('lostpointercapture', { pointerId: 1 });
  assert.deepEqual(types(s), ['begin', 'move', 'release']);
  assert.deepEqual(s.calls[1].point, { x: 3, y: -2, time: 45 });
  assert.equal(s.captured.size, 0);
});

test('coalesced positions retain individual input timestamps independent of render timing', () => {
  const s = scene(); s.emit('pointerdown', { timeStamp: 20 });
  const samples = [
    { clientX: 204, clientY: 308, timeStamp: 24 },
    { clientX: 212, clientY: 316, timeStamp: 30 },
    { clientX: 240, clientY: 320, timeStamp: 39 }
  ];
  s.emit('pointermove', { timeStamp: 40, getCoalescedEvents: () => samples });
  s.emit('pointermove', { clientX: 244, clientY: 324, timeStamp: 44, getCoalescedEvents: () => [] });
  assert.deepEqual(s.calls.slice(1).map(call => call.point), [
    { x: .01, y: .02, time: 24 }, { x: .03, y: .04, time: 30 },
    { x: .1, y: .05, time: 39 }, { x: .11, y: .06, time: 44 }
  ]);
});

test('pointer cancellation and lost capture never release or duplicate cancellation', () => {
  for (const reason of ['pointercancel', 'lostpointercapture']) {
    const s = scene(); s.emit('pointerdown');
    s.emit(reason, { pointerId: 1 }); s.emit('pointerup', { timeStamp: 100 });
    s.emit(reason, { pointerId: 1 });
    assert.deepEqual(types(s), ['begin', 'cancel'], reason);
    assert.equal(s.captured.size, 0, reason);
    s.emit('pointerdown', { pointerId: 2, timeStamp: 120 });
    assert.equal(s.calls.at(-1).type, 'begin', reason + ' allows a new gesture after lift');
  }
});

test('blur, hidden page, resize and orientation changes cancel safely and allow restart', () => {
  for (const reason of ['blur', 'visibilitychange', 'resize', 'orientationchange']) {
    const s = scene(); s.emit('pointerdown'); s.document.hidden = reason === 'visibilitychange';
    s.emit(reason, {}, reason === 'visibilitychange' ? s.document : s.window);
    s.emit('pointerup', { timeStamp: 100 });
    assert.deepEqual(types(s), ['begin', 'cancel'], reason);
    assert.equal(s.captured.size, 0);
    s.emit('pointerdown', { pointerId: 2, timeStamp: 120 });
    assert.equal(s.calls.at(-1).type, 'begin', reason);
  }
  const visible = scene(); visible.emit('pointerdown'); visible.emit('visibilitychange', {}, visible.document);
  assert.deepEqual(types(visible), ['begin'], 'a visible document does not cancel');
});

test('second touch cancels until all contacts lift, without jumps or duplicated launch', () => {
  const s = scene();
  s.emit('pointerdown', { pointerType: 'touch' });
  s.emit('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 700 });
  s.emit('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 900, timeStamp: 40 });
  s.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: -100, timeStamp: 45 });
  s.emit('pointerup', { pointerId: 2, pointerType: 'touch', timeStamp: 50 });
  s.emit('pointerdown', { pointerId: 3, pointerType: 'touch', timeStamp: 55 });
  s.emit('pointerup', { pointerId: 1, pointerType: 'touch', timeStamp: 60 });
  s.emit('pointerup', { pointerId: 3, pointerType: 'touch', timeStamp: 70 });
  assert.deepEqual(types(s), ['begin', 'cancel']);
  s.emit('pointerdown', { pointerId: 4, pointerType: 'touch', timeStamp: 80 });
  s.emit('pointerup', { pointerId: 4, pointerType: 'touch', timeStamp: 100 });
  assert.deepEqual(types(s), ['begin', 'cancel', 'begin', 'release']);
});

test('all-up outside the canvas clears the multitouch block after capture cancellation', () => {
  const s = scene(); s.emit('pointerdown', { pointerType: 'touch' });
  s.emit('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false });
  s.emit('pointerup', { pointerId: 1, pointerType: 'touch' }, s.window);
  s.emit('pointerup', { pointerId: 2, pointerType: 'touch' }, s.window);
  s.emit('pointerdown', { pointerId: 3, pointerType: 'touch', timeStamp: 100 });
  assert.deepEqual(types(s), ['begin', 'cancel', 'begin']);
});

test('second touch outside the canvas cancels the active captured gesture', () => {
  const s = scene(); s.emit('pointerdown', { pointerType: 'touch' });
  s.emit('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false }, s.window);
  s.emit('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 900, timeStamp: 100 });
  assert.deepEqual(types(s), ['begin', 'cancel']);
});

test('right click and an initial nonprimary contact never begin a gesture', () => {
  const s = scene();
  assert.equal(s.emit('pointerdown', { button: 2 }).defaultPrevented, false);
  s.emit('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false });
  s.emit('pointermove', { pointerId: 2, timeStamp: 30 }); s.emit('pointerup', { pointerId: 2 });
  assert.deepEqual(s.calls, []);
  s.emit('pointerdown', { pointerId: 3 }); assert.deepEqual(types(s), ['begin']);
});

test('disabled settings preserve default pointer and drag behavior for panel scrolling', () => {
  const s = scene(); s.enable(false);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'dragstart']) {
    assert.equal(s.emit(type, { clientX: 900, timeStamp: 100 }).defaultPrevented, false, type);
  }
  assert.deepEqual(s.calls, []); assert.equal(s.captured.size, 0);
  s.enable(true); assert.equal(s.emit('dragstart').defaultPrevented, true);
});

test('disabling shuffle during a gesture cancels at release instead of launching', () => {
  const s = scene(); s.emit('pointerdown'); s.enable(false);
  s.emit('pointermove', { clientX: 900, timeStamp: 90 });
  s.emit('pointerup', { clientX: 1000, timeStamp: 100 });
  assert.deepEqual(types(s), ['begin', 'cancel']); assert.equal(s.captured.size, 0);
});

test('an unrelated release cannot terminate the pointer owner or create a release', () => {
  const s = scene(); s.emit('pointerdown');
  s.emit('pointerup', { pointerId: 7, clientX: 1200, timeStamp: 90 });
  assert.deepEqual(types(s), ['begin']); assert.equal(s.captured.has(1), true);
  s.emit('pointerup', { clientX: 360, clientY: 380, timeStamp: 130 });
  assert.deepEqual(s.calls.at(-1), { type: 'release', point: { x: .4, y: .2, time: 130 } });
});
