// Run alone for comparable CPU timings: node tests/physics-benchmark.cjs [baseline-repo]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.join(__dirname, '..');
const context = vm.createContext({ window: {}, console });
for (const file of ['maps.js', 'physics.js', 'cinematic.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
}
const P = context.window.CosmicPinball;
for (const map of ['classic']) {
  for (const mode of ['fast', 'crowded']) {
    const config = mode === 'fast' ? { radius: 8, gravity: 1500, restitution: .35, skills: false }
      : { radius: 16, gravity: 350, restitution: .92, skills: true };
    const seed = 'stage1-' + map + '-' + mode;
    const p = new P.Physics({ map: P.MAPS[map], names: P.parseNames('참가자*500'), seed, ...config });
    Object.create(P.Cinematic.prototype).commitShuffle(p);
    const costs = []; let total = 0, rescues = 0;
    while (!p.complete && p.time < 240) {
      const before = performance.now(); p.step(); const cost = performance.now() - before;
      total += cost;
      if (p.ticks > 120 && p.ticks <= 1200) costs.push(cost);
      for (const event of p.drainEvents()) if (event.type === 'rescue' || event.rescue) rescues++;
    }
    assert.ok(p.complete && p.finished.length === 500, `${map}/${mode}: all 500 must finish`);
    costs.sort((a, b) => a - b);
    const percentile = fraction => +costs[Math.floor((costs.length - 1) * fraction)].toFixed(3);
    console.log(JSON.stringify({ map, mode, seed, ...config, finished: p.finished.length, simulatedSeconds: +p.time.toFixed(3),
      physicsMs: +total.toFixed(1), stepMedianMs: percentile(.5), stepP95Ms: percentile(.95), stepP99Ms: percentile(.99), rescues }));
  }
}
