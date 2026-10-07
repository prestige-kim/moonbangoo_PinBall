const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {}, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/throw-gate.js'), 'utf8'), sandbox);
const P = sandbox.window.CosmicPinball;
const gate = () => new P.ThrowGate();
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('launch thresholds are public frozen normalized constants', () => {
  assert.equal(Object.isFrozen(P.THROW_THRESHOLDS), true);
  assert.equal(P.THROW_THRESHOLDS.travel, .18);
  assert.equal(P.THROW_THRESHOLDS.boundary, .24);
  assert.equal(P.THROW_THRESHOLDS.outwardSpeed, 1.4);
  assert.equal(P.THROW_THRESHOLDS.windowMs, 100);
});

test('only a long fast outward release fires, once', () => {
  const g = gate(); g.begin(0, 0, 0); g.move(.16, 0, 50); g.move(.35, 0, 100);
  const preview = g.evaluate(100);
  assert.equal(preview.eligible, true); assert.equal(preview.fired, undefined);
  near(preview.distance, .35); near(preview.radius, .35); near(preview.outwardSpeed, 3.5);
  near(preview.dx, .35); near(preview.dy, 0);
  assert.equal(g.release(.35, 0, 100).fired, true);
  assert.equal(g.release(.5, 0, 110).fired, false);
  assert.equal(g.evaluate(110).eligible, false);
});

test('slow outside, short fast outside and fast motion inside each fail one condition', () => {
  const slow = gate(); slow.begin(0, 0, 0); slow.move(.3, 0, 500);
  assert.equal(slow.release(.31, 0, 600).fired, false);
  const short = gate(); short.begin(.2, 0, 0); short.move(.36, 0, 40);
  assert.equal(short.release(.36, 0, 40).eligible, false);
  const inside = gate(); inside.begin(-.2, 0, 0); inside.move(.2, 0, 100);
  assert.equal(inside.release(.2, 0, 100).eligible, false);
});

test('circular motion near and inside boundary never fires on a tangent or radial chord', () => {
  for (const radius of [.2, .239, .25, .35]) {
    const g = gate(); g.begin(radius, 0, 0);
    for (let i = 1; i <= 40; i++) {
      const angle = i * Math.PI / 20;
      g.move(Math.cos(angle) * radius, Math.sin(angle) * radius, i * 5);
      assert.equal(g.evaluate(i * 5).eligible, false);
    }
    assert.equal(g.release(radius, 0, 200).fired, false);
  }
});

test('boundary jitter and inward motion do not borrow tangential speed', () => {
  const g = gate(); g.begin(0, 0, 0); g.move(.242, 0, 300);
  for (let i = 1; i <= 30; i++) {
    g.move(i % 2 ? .243 : .239, i % 3 * .003, 300 + i * 10);
    assert.equal(g.evaluate(300 + i * 10).eligible, false);
  }
  assert.equal(g.release(.244, 0, 610).fired, false);
  const inward = gate(); inward.begin(.7, 0, 0); inward.move(.3, 0, 100);
  assert.equal(inward.release(.3, 0, 100).fired, false);
  assert.equal(inward.evaluate(100).outwardSpeed, 0);
});

test('stopping before release removes stale speed without changing event history', () => {
  const g = gate(); g.begin(0, 0, 0); g.move(.4, 0, 100);
  assert.equal(g.evaluate(100).eligible, true);
  const stopped = g.evaluate(220);
  assert.equal(stopped.eligible, false); near(stopped.outwardSpeed, 0);
  assert.equal(g.evaluate(100).eligible, true, 'evaluation is read only');
  assert.equal(g.release(.4, 0, 220).fired, false);
  const partial = gate(); partial.begin(0, 0, 0); partial.move(.4, 0, 100);
  near(partial.evaluate(150).outwardSpeed, 2);
  assert.equal(partial.release(.4, 0, 200).fired, false);
});

test('window interpolation and begin stationary history use exactly 100ms', () => {
  const g = gate(); g.begin(0, 0, 0); g.move(.3, 0, 150); g.move(.5, 0, 200);
  const value = g.evaluate(200);
  near(value.dx, .3); near(value.outwardSpeed, 3);
  const shortHistory = gate(); shortHistory.begin(0, 0, 1000); shortHistory.move(.3, 0, 1040);
  near(shortHistory.evaluate(1040).outwardSpeed, 3);
  assert.equal(shortHistory.release(.3, 0, 1040).fired, true);
});

test('the same event coordinates and timestamps ignore render evaluation schedules and count', () => {
  for (const count of [6, 50, 200, 500]) {
    const a = gate(), b = gate(); a.begin(0, 0, 10); b.begin(0, 0, 10);
    for (const [x, y, t] of [[.04,.01,30],[.12,.02,65],[.21,.01,95],[.36,-.02,130]]) {
      a.move(x,y,t); b.move(x,y,t);
      a.evaluate(t); a.evaluate(t+3); a.evaluate(t+6);
      if (count > 50) b.evaluate(t+20);
    }
    assert.equal(JSON.stringify(a.release(.39,-.025,140)), JSON.stringify(b.release(.39,-.025,140)));
    assert.equal(a.evaluate(140).eligible, false);
  }
});

test('cancel and invalid or backward events cannot trigger or duplicate a release', () => {
  const g = gate(); g.begin(0,0,0); g.move(.4,0,100); g.cancel();
  assert.equal(g.release(.4,0,100).fired, false);
  g.begin(0,0,200); g.move(.4,0,300);
  g.move(20,20,250); g.move(Infinity,0,310); g.move(0,NaN,320); g.move(.5,0,NaN);
  near(g.evaluate(300).radius,.4);
  assert.equal(g.release(.4,0,300).fired,true);
  assert.equal(g.release(.4,0,300).fired,false);
  g.begin(NaN,0,400); assert.equal(g.release(.4,0,500).fired,false);
});

test('zero and duplicate event timestamps have finite speed and no instantaneous launch', () => {
  const g = gate(); g.begin(0,0,0); g.move(.4,0,0);
  const first = g.evaluate(0); near(first.outwardSpeed,0);
  assert.equal(first.eligible,false); assert.equal(g.release(.4,0,0).fired,false);
  const duplicate = gate(); duplicate.begin(0,0,0); duplicate.move(.2,0,100); duplicate.move(.3,0,100);
  const result = duplicate.release(.3,0,100);
  assert.equal(result.fired,true); near(result.outwardSpeed,3);
  for (const value of Object.values(result)) assert.ok(typeof value === 'boolean' || Number.isFinite(value));
});
