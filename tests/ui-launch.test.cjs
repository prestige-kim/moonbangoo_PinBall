// The launch UI now follows a continuous cinematic scene instead of a manual firework gesture.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function event(type, properties = {}, target) {
  const value = new Event(type, { cancelable: true });
  for (const [key, item] of Object.entries(properties)) Object.defineProperty(value, key, { value: item, configurable: true });
  if (target) Object.defineProperty(value, 'target', { value: target, configurable: true });
  return value;
}
function scene(width = 400, height = 800) {
  let document;
  class Node extends EventTarget {
    constructor(id) {
      super(); this.id = id; this.disabled = false; this.hidden = false; this.tabIndex = 0; this.textContent = ''; this.dataset = {}; this.attributes = new Map(); this.children = []; this.firstChild = { textContent: '' };
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name), toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } };
      const values = new Map(); this.style = { values, setProperty: (name, value) => values.set(name, value), removeProperty: name => values.delete(name) };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getBoundingClientRect() {
      if (this.id === 'masthead') return { left: 0, right: width, top: 0, bottom: 80, width, height: 80 };
      if (this.id === 'stage-heading') return { left: 20, right: width - 20, top: 95, bottom: 127, width: width - 40, height: 32 };
      if (this.id === 'race-panel') return { left: width - 170, right: width - 24, top: 150, bottom: 346, width: 146, height: 196 };
      if (this.id === 'camera-hints') return { left: 20, right: width - 20, top: height - 96, bottom: height - 82, width: width - 40, height: 14 };
      if (this.id === 'system-footer') return { left: 18, right: width - 18, top: height - 21, bottom: height - 1, width: width - 36, height: 20 };
      if (this.id === 'mobile-setup-button') return { left: 100, right: 280, top: height - 67, bottom: height - 24, width: 180, height: 43 };
      return { left: width / 2 - 174, right: width / 2 + 174, top: 50, bottom: 750, width: 348, height: 700 };
    }
    getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
    querySelector(selector) { return node(this.id + (selector === 'small' ? '-small' : '-text')); }
    querySelectorAll() { return controls; }
    focus() { document.activeElement = this; }
  }
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Node(id)); return nodes.get(id); };
  const controls = ['panel-close', 'names', 'advanced-summary', 'radius', 'seed', 'start-button'].map(node);
  node('radius').hidden = true; node('seed').hidden = true;
  const main = node('main'); main.children = ['setup-panel', 'stage-heading', 'race-panel', 'camera-hints', 'mobile-setup-button', 'countdown', 'toast-stack'].map(node);
  document = new EventTarget(); document.body = node('body'); document.activeElement = null;
  document.getElementById = node;
  document.querySelector = selector => node(selector.replace(/^\./, ''));
  document.querySelectorAll = selector => selector === '.masthead,.system-footer' ? [node('masthead'), node('system-footer')] : [];
  const window = { innerWidth: width, innerHeight: height, CosmicPinball: {}, setTimeout: () => 0 };
  const context = vm.createContext({ window, document, console, requestAnimationFrame: handler => handler() });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8'), context);
  const ui = Object.create(window.CosmicPinball.UI.prototype);
  Object.assign(ui, { handlers: {}, scene: null, status: 'intro', sceneReveal: 0, panelOpen: false, focusMode: false, locked: false, lastMobile: width <= 850 });
  ui.hideResults = () => {}; ui.hideCountdown = () => {};
  ui.bind(); ui.setScene('intro');
  const emit = (id, type, props = {}) => node(id).dispatchEvent(event(type, props, node(id)));
  const key = (key, shiftKey = false) => { const value = event('keydown', { key, shiftKey }); document.dispatchEvent(value); return value; };
  return { ui, node, emit, key, document, controls };
}

test('intro exposes only its welcome action and keeps the settings ancestor available for later', () => {
  const s = scene();
  assert.equal(s.document.activeElement.id, 'intro-start-button');
  assert.equal(s.node('scene-welcome').inert, false);
  assert.equal(s.node('setup-panel').inert, true); assert.equal(s.node('race-panel').inert, true);
  assert.equal(s.node('masthead').inert, true); assert.equal(s.node('main').inert, false);
  assert.equal(s.node('game-canvas').attributes.get('aria-hidden'), 'true');
  let enters = 0; s.ui.on('enter', () => enters++); s.emit('intro-start-button', 'click');
  assert.equal(enters, 1);
});

test('setup reuses the real panel as an accessible centered dialog and focuses participant input', () => {
  const s = scene(); s.ui.setScene('setup');
  assert.equal(s.document.activeElement.id, 'names');
  assert.equal(s.node('main').inert, false, 'the panel must not inherit an inert main');
  assert.equal(s.node('setup-panel').inert, false); assert.equal(s.node('setup-panel').attributes.get('role'), 'dialog');
  assert.equal(s.node('setup-panel').attributes.get('aria-modal'), 'true');
  assert.equal(s.node('scene-welcome').inert, true); assert.equal(s.node('race-panel').inert, true);
  assert.equal(s.ui.panelOpen, true);
});

test('close and Escape return setup to intro and restore welcome focus', () => {
  const s = scene(); let cancels = 0;
  s.ui.on('setupcancel', () => { cancels++; s.ui.setScene('intro'); });
  s.ui.setScene('setup'); s.emit('panel-close', 'click');
  assert.equal(cancels, 1); assert.equal(s.ui.scene, 'intro'); assert.equal(s.document.activeElement.id, 'intro-start-button');
  s.ui.setScene('setup'); const escape = s.key('Escape');
  assert.equal(escape.defaultPrevented, true); assert.equal(cancels, 2); assert.equal(s.ui.scene, 'intro');
});

test('setup Tab wraps visible enabled controls and skips closed advanced fields', () => {
  const s = scene(); s.ui.setScene('setup');
  assert.deepEqual(Array.from(s.ui.getSetupControls(), item => item.id), ['panel-close', 'names', 'advanced-summary', 'start-button']);
  s.node('start-button').focus(); const tab = s.key('Tab');
  assert.equal(tab.defaultPrevented, true); assert.equal(s.document.activeElement.id, 'panel-close');
  const back = s.key('Tab', true); assert.equal(back.defaultPrevented, true); assert.equal(s.document.activeElement.id, 'start-button');
});

test('one setup submit starts the sequence; hidden automatic scenes reject further submissions', () => {
  const s = scene(); let starts = 0;
  s.ui.on('start', () => { starts++; s.ui.setScene('mixing'); }); s.ui.setScene('setup');
  s.emit('settings-form', 'submit'); s.emit('settings-form', 'submit');
  assert.equal(starts, 1); assert.equal(s.node('setup-panel').inert, true); assert.equal(s.node('race-panel').inert, true);
  for (const stage of ['mixing', 'aiming', 'flight']) {
    s.ui.setScene(stage); s.emit('settings-form', 'submit'); s.key('Tab');
    assert.equal(s.document.activeElement.id, 'scene-status'); assert.equal(s.ui.focusMode, true);
  }
  assert.equal(starts, 1);
});

test('flight and running have identical final board coordinates at desktop and mobile widths', () => {
  for (const width of [400, 1280]) {
    const s = scene(width); const snapshots = [];
    for (const stage of ['mixing', 'aiming', 'flight', 'running']) { s.ui.setScene(stage); snapshots.push(JSON.stringify(s.ui.getViewport())); }
    assert.ok(snapshots.every(value => value === snapshots[0]), 'viewport changed on handoff at width ' + width);
    assert.equal(s.node('race-panel').inert, false); assert.equal(s.node('game-canvas').attributes.get('aria-hidden'), 'false');
  }
});

test('reveal waits until the final 15 percent for HUD and never fades the cinematic canvas itself', () => {
  const s = scene(); s.ui.setScene('flight'); s.ui.setSceneProgress({ reveal: .8 });
  assert.equal(Number(s.node('body').style.values.get('--hud-reveal')), 0);
  s.ui.setSceneProgress({ reveal: .925 }); assert.ok(Math.abs(Number(s.node('body').style.values.get('--hud-reveal')) - .5) < 1e-9);
  assert.equal(s.node('cinema-canvas').style.values.has('opacity'), false);
  s.ui.setSceneProgress({ reveal: 2 }); assert.equal(s.ui.sceneReveal, 1);
  s.ui.setScene('running'); assert.equal(s.document.activeElement.id, 'game-canvas');
});


test('refreshing the same setup preserves slider and map focus instead of refocusing names', () => {
  const s = scene(); s.ui.setScene('setup');
  s.node('radius').hidden = false; s.node('radius').focus();
  s.ui.setScene('setup');
  assert.equal(s.document.activeElement.id, 'radius');
  s.node('map-classic').focus(); s.ui.setScene('setup');
  assert.equal(s.document.activeElement.id, 'map-classic');
  assert.equal(s.node('setup-panel').inert, false);
});


test('short mobile landscape excludes the race HUD while portrait preserves board width', () => {
  const portrait = scene(375, 812); portrait.ui.setScene('running');
  const portraitView = portrait.ui.getViewport();
  assert.equal(portraitView.w, 375 - 28, 'portrait keeps full board width');
  assert.ok(portraitView.y >= portrait.node('race-panel').getBoundingClientRect().bottom + 12, 'portrait leader stays below the HUD');
  const landscape = scene(812, 375); const views = [];
  for (const stage of ['flight', 'running']) { landscape.ui.setScene(stage); views.push(landscape.ui.getViewport()); }
  assert.equal(JSON.stringify(views[0]), JSON.stringify(views[1]), 'flight-to-game handoff has one viewport');
  assert.ok(views[1].x + views[1].w <= landscape.node('race-panel').getBoundingClientRect().left - 18,
    'leading marble can be tracked beside the HUD');
});
