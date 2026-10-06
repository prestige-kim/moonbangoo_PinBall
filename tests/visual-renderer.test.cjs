const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {}, document: { addEventListener() {} } };
vm.createContext(sandbox);
for (const file of ['themes', 'maps', 'renderer']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), sandbox);
const P = sandbox.window.CosmicPinball;

function plan(count, area) {
  const renderer = Object.create(P.Renderer.prototype);
  renderer.nameSprite = () => ({ width: 44, height: 23 });
  const marbles = Array.from({ length: count }, (_, id) => ({ id, x: 60 + id % 25 * 35, y: 200 + Math.floor(id / 25) * 31, r: 12, finished: false }));
  const camera = { zoom: .7, worldToScreen(x, y) { return { x: area.x + x * .7, y: area.y + (y - 190) * .7 }; } };
  return { renderer, marbles, labels: renderer.planLabels(marbles, marbles[0], camera, area) };
}

test('6, 50, 200 and 500 marbles get bounded, viewport-safe name labels', () => {
  for (const area of [{ x: 350, y: 100, w: 800, h: 580 }, { x: 14, y: 350, w: 347, h: 265 }]) {
    for (const count of [6, 50, 200, 500]) {
      const { labels, marbles } = plan(count, area);
      assert.ok(labels.length <= (count <= 12 ? 12 : count <= 50 ? 7 : count <= 200 ? 3 : 1), count + ' label cap');
      for (const item of labels) {
        assert.ok(item.x >= area.x && item.y >= area.y && item.x + item.label.width <= area.x + area.w && item.y + item.label.height <= area.y + area.h,
          count + ' label leaves HUD-free area');
      }
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j];
        assert.ok(a.x + a.label.width <= b.x || b.x + b.label.width <= a.x || a.y + a.label.height <= b.y || b.y + b.label.height <= a.y,
          count + ' names overlap');
      }
      assert.equal(marbles.length, count);
    }
  }
});

test('finished display uses distinct recent slots without mutating rank, coordinates or arrival time', () => {
  const renderer = Object.create(P.Renderer.prototype), map = P.MAPS.classic;
  for (const count of [6, 50, 200, 500]) {
    const finished = Array.from({ length: count }, (_, id) => ({ id, x: id % 2 ? 30 : 970, y: map.finish.y, finishTime: id / 10 }));
    const original = JSON.stringify(finished), entries = renderer.finishDisplay(finished, map);
    assert.equal(entries.length, Math.min(count, 12));
    assert.equal(new Set(entries.map(item => item.x + '/' + item.y)).size, entries.length);
    assert.ok(entries.every(item => item.y > map.finish.y && item.y < map.height - 32));
    assert.deepEqual(entries.map(item => item.rank), Array.from({ length: entries.length }, (_, i) => count - entries.length + i + 1));
    assert.equal(JSON.stringify(finished), original);
  }
});

test('both paired portals have a directed visible route', () => {
  const renderer = Object.create(P.Renderer.prototype), routes = renderer.portalPairs(P.MAPS.hybrid);
  assert.equal(routes.length, 6);
  assert.deepEqual(Array.from(routes, route => route.pair.charAt(0)).sort(), ['a', 'a', 'a', 'b', 'b', 'b']);
  assert.ok(routes.every(route => route.targetY > route.y));
  assert.equal(renderer.portalPairs(P.MAPS.classic).length, 0);
});
