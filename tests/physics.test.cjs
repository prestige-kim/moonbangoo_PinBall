const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = { window: {}, console };
vm.createContext(context);
for (const file of ['maps.js', 'physics.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
}
const P = context.window.CosmicPinball;
assert.equal(P.parseNames('수박*2,키위*2,귤*2').length, 6);
assert.equal(P.parseNames('가\n나\n다').length, 3);
for (const invalid of ['', '가,,나', '가,가', '가*0', '가*1.5', '*2', '가*501', '<script>']) {
  assert.throws(() => P.parseNames(invalid), /./, invalid);
}

// The fall limit eases into terminal velocity while leaving horizontal motion.
const freeFallMap = { ...P.MAPS.classic, obstacles: [], height: 100000, finish: { y: 99000 } };
const freeFall = new P.Physics({ names: P.parseNames('낙하 확인'), map: freeFallMap, seed: 'soft-fall' });
freeFall.marbles[0].vx = 250;
for (let tick = 0; tick < 600; tick++) {
  freeFall.step(); freeFall.drainEvents();
  assert.ok(freeFall.marbles[0].vy <= P.PHYSICS_TUNING.fallMax, 'soft downward speed cap');
}
assert.equal(freeFall.gravity, 620, 'slower default gravity');
assert.ok(freeFall.marbles[0].vy > 640 && freeFall.marbles[0].vy < 680, 'smooth terminal fall speed');
assert.ok(Math.abs(freeFall.marbles[0].vx) > 100, 'horizontal impulses remain useful');

function run(map, count, seed = 'physics-test', skills = false, grouping = [1], config = {}) {
  const names = P.parseNames('참가자*' + count);
  const game = new P.Physics({ names, map, seed, skills, ...config });
  let frames = 0;
  let maxEvents = 0;
  const started = performance.now();
  while (!game.complete && game.time < 240) {
    const ticks = grouping[frames++ % grouping.length];
    for (let i = 0; i < ticks && !game.complete; i++) {
      game.step(1 / 120);
      for (const marble of game.marbles) {
        assert.ok(Number.isFinite(marble.x) && Number.isFinite(marble.y));
        assert.ok(marble.x >= marble.r - 0.0001 && marble.x <= map.width - marble.r + 0.0001, 'wall containment');
        assert.ok(marble.y >= marble.r - 0.0001 && marble.y <= map.height, 'vertical containment');
      }
    }
    maxEvents = Math.max(maxEvents, game.drainEvents().length);
  }
  assert.ok(game.complete, `${map.id} ${count}: only ${game.finished.length} finished after ${game.time.toFixed(1)}s`);
  assert.equal(new Set(game.finished.map(marble => marble.id)).size, count);
  for (let i = 1; i < game.finished.length; i++) assert.ok(game.finished[i].finishTime >= game.finished[i - 1].finishTime);
  return {
    game,
    duration: +(performance.now() - started).toFixed(1),
    snapshot: JSON.stringify(game.finished.map(({ id, finishTime, x }) => ({ id, finishTime, x }))),
    maxEvents
  };
}

for (const map of Object.values(P.MAPS)) {
  assert.ok(map.height >= 6500 && map.height <= 7200, 'extended map height');
  assert.ok(map.obstacles.some(obstacle => (obstacle.y || obstacle.y2 || (obstacle.points && obstacle.points[0].y) || 0) > map.finish.y - 500), 'inhabited final course section');
  for (const count of [2, 50, 200]) {
    const result = run(map, count);
    // Duration is an outcome of the corrected geometry (especially portal paths).
    // Course length is checked above; do not pin a seeded trajectory to the old solver's time window.
    assert.ok(result.game.time <= 120, 'default race finishes without prolonged stalls');
    console.log(`${map.id.padEnd(7)} ${String(count).padStart(3)} marbles: ${result.game.time.toFixed(2)}s simulated / ${result.duration}ms CPU / ${result.maxEvents} max queued events`);
  }
  const single = run(map, 50, 'deterministic', true);
  const grouped = run(map, 50, 'deterministic', true, [2, 4, 1, 3, 8]);
  assert.equal(single.snapshot, grouped.snapshot, `${map.id} seed/render grouping reproducibility`);
  const other = run(map, 50, 'different-seed', true);
  assert.notEqual(single.snapshot, other.snapshot, `${map.id} seeds affect physical trajectories`);

  const largeSpawn = new P.Physics({ names: P.parseNames('행운 구슬*500'), map, seed: 'packing', radius: 18 });
  for (const marble of largeSpawn.marbles) {
    assert.ok(marble.x - marble.r >= map.spawn.x && marble.x + marble.r <= map.spawn.x + map.spawn.width, 'spawn horizontal bounds');
    assert.ok(marble.y - marble.r >= map.spawn.y && marble.y + marble.r <= map.spawn.y + map.spawn.height, 'spawn vertical bounds');
  }
  for (let i = 0; i < largeSpawn.marbles.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = largeSpawn.marbles[i], b = largeSpawn.marbles[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r, 'spawn circles do not overlap');
    }
  }
  const extreme = run(map, 500, 'extreme-settings', true, [4], { radius: 16, gravity: 350, restitution: 0.92 });
  console.log(`${map.id.padEnd(7)} 500 marbles / low gravity / high bounce / skills: ${extreme.game.time.toFixed(2)}s simulated / ${extreme.duration}ms CPU`);
}
console.log('Input validation, wall containment, complete arrivals, seeded skills and render grouping reproducibility passed.');
