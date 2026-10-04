const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const context = { window: {}, console };
vm.createContext(context);
for (const file of ['maps.js', 'physics.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
}
const P = context.window.CosmicPinball;
const map = P.MAPS.classic;
const names = count => P.parseNames('참가자*' + count);
const spawn = (count, seed, radius = 12) => new P.Physics({ names: names(count), map, seed, radius });
const snapshot = game => JSON.stringify(game.marbles.map(m => [m.id, m.x, m.y, m.vx, m.vy, m.r, m.angle]));

function assertPacking(game, pairs = true) {
  const area = game.map.spawn;
  for (const m of game.marbles) {
    assert.ok(m.x - m.r >= area.x && m.x + m.r <= area.x + area.width, 'horizontal spawn bounds');
    assert.ok(m.y - m.r >= area.y && m.y + m.r <= area.y + area.height, 'vertical spawn bounds before obstacles');
  }
  if (!pairs) return;
  for (let i = 0; i < game.marbles.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = game.marbles[i], b = game.marbles[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r, 'no initial overlap');
    }
  }
}

function race(count, seed, grouping = [1]) {
  const game = spawn(count, seed);
  let frame = 0;
  while (!game.complete && game.time < 240) {
    const ticks = grouping[frame++ % grouping.length];
    for (let i = 0; i < ticks && !game.complete; i++) game.step();
    game.drainEvents();
  }
  assert.ok(game.complete, 'all participants naturally finish: ' + count + ', ' + seed);
  return game;
}

test('small groups occupy separated full-width lanes and participant ownership changes by seed', () => {
  const firstLanes = new Set();
  const singles = [];
  for (let seed = 0; seed < 32; seed++) {
    singles.push(spawn(1, 'single-' + seed).marbles[0].x);
    for (const count of [2, 3, 6]) {
      const game = spawn(count, 'spread-' + seed);
      assertPacking(game);
      const xs = game.marbles.map(m => m.x);
      assert.ok(Math.max(...xs) - Math.min(...xs) > map.spawn.width * 0.5, 'small group spans both sides');
      if (count === 2) firstLanes.add(game.marbles[0].x < map.width / 2 ? 'left' : 'right');
    }
  }
  assert.equal(firstLanes.size, 2, 'first input is not assigned one fixed lane');
  assert.ok(Math.max(...singles) - Math.min(...singles) > map.spawn.width * 0.85, 'a single participant samples the launch width across seeds');
});

test('one to 500 participants and radii seven to eighteen stay packed inside the spawn', () => {
  for (let radius = 7; radius <= 18; radius++) {
    for (const count of [1, 2, 6, 31, 50, 100, 200, 499, 500]) {
      assertPacking(spawn(count, 'packing-' + radius + '-' + count, radius));
    }
  }
});

test('a fixed seed reproduces positions and physical arrival order across rendering groups', () => {
  assert.equal(snapshot(spawn(50, 'explicit-fixed')), snapshot(spawn(50, 'explicit-fixed')));
  assert.notEqual(snapshot(spawn(50, 'explicit-fixed')), snapshot(spawn(50, 'another-fixed')));
  const a = race(50, 'replay-launch', [1]);
  const b = race(50, 'replay-launch', [2, 4, 1, 7]);
  const arrivals = game => JSON.stringify(game.finished.map(m => [m.id, m.finishTime, m.x]));
  assert.equal(arrivals(a), arrivals(b));
});

test('changing seeds removes a repeated first-input winner in small real races', () => {
  const winners = new Set();
  for (let seed = 0; seed < 12; seed++) winners.add(race(2, 'small-race-' + seed).finished[0].colorIndex);
  assert.equal(winners.size, 2, 'both input positions can win with physical trajectories');
});

test('200 classic races with six entrants produce varied input winners and starting ownership', () => {
  const samples = 200;
  const wins = [0, 0, 0, 0, 0, 0];
  const firstInputX = [];
  const times = [];
  const lanes = Array.from({ length: 6 }, () => new Set());
  for (let seed = 0; seed < samples; seed++) {
    const label = 'six-member-launch-' + seed;
    const initial = spawn(6, label);
    firstInputX.push(initial.marbles[0].x);
    for (const marble of initial.marbles) lanes[marble.colorIndex].add(Math.floor(marble.x / map.width * 3));
    const game = race(6, label);
    wins[game.finished[0].colorIndex]++;
    times.push(game.time);
  }
  assert.ok(wins.every(count => count > 0), 'every input position wins in the measured sample');
  assert.ok(lanes.every(visited => visited.size === 3), 'every input visits left, middle and right lanes');
  assert.ok(Math.max(...firstInputX) - Math.min(...firstInputX) > map.spawn.width * 0.85, 'first input is not fixed at the central slot');
  console.log('classic six-entrant / 200 seeded trajectories: ' + JSON.stringify({
    winnerCountsByInput: wins,
    firstInputXRange: [Math.min(...firstInputX), Math.max(...firstInputX)].map(value => +value.toFixed(2)),
    lastArrivalRange: [Math.min(...times), Math.max(...times)].map(value => +value.toFixed(2))
  }));
});
