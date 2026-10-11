const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, console });
for (const file of ['maps.js', 'physics.js', 'cinematic.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
}
const P = context.window.CosmicPinball;
const names = n => P.parseNames('참가자*' + n);
const scene = obstacles => ({ ...P.MAPS.classic, obstacles, finish: { y: 6900 } });
const game = (obstacles, radius = 8) => new P.Physics({ map: scene(obstacles), names: names(1), seed: 'contact-regression', radius });

function segmentDistance(m, o) {
  const x = o.x2 - o.x1, y = o.y2 - o.y1;
  const t = Math.max(0, Math.min(1, ((m.x - o.x1) * x + (m.y - o.y1) * y) / (x * x + y * y || 1)));
  return Math.hypot(m.x - o.x1 - t * x, m.y - o.y1 - t * y);
}
function penetration(m, o) {
  if (['pin', 'circle', 'bumper'].includes(o.type)) return m.r + o.r - Math.hypot(m.x - o.x, m.y - o.y);
  if (['segment', 'rotor', 'moving'].includes(o.type)) return m.r + (o.thickness ?? 6) - segmentDistance(m, o);
  if (o.type !== 'polygon') return 0;
  let inside = false, distance = Infinity;
  for (let i = 0, j = o.points.length - 1; i < o.points.length; j = i++) {
    const a = o.points[j], b = o.points[i];
    if ((a.y > m.y) !== (b.y > m.y) && m.x < (b.x - a.x) * (m.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    distance = Math.min(distance, segmentDistance(m, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
  }
  return inside ? m.r + distance : m.r - distance;
}

test('a pin and a sweeping bar resolve their simultaneous contacts without pushing back into the pin', () => {
  const pin = { type: 'pin', id: 'pin', x: 365, y: 1290, r: 9 };
  const angle = .9 + (193 / 120) * 1.1;
  const bar = { type: 'segment', id: 'bar', x1: 500 - Math.cos(angle) * 160, y1: 1250 - Math.sin(angle) * 160,
    x2: 500 + Math.cos(angle) * 160, y2: 1250 + Math.sin(angle) * 160, thickness: 9 };
  const p = game([pin, bar]), m = p.marbles[0];
  Object.assign(m, { x: 366.3391, y: 1299.1956, vx: 0, vy: 0 });
  p.step();
  for (const o of [pin, bar]) assert.ok(penetration(m, o) < .1, `${o.id}: ${penetration(m, o)}`);
});

test('exact centers and polygon edges have a valid separating normal', () => {
  const obstacles = [
    { type: 'pin', id: 'center', x: 500, y: 1000, r: 12 },
    { type: 'segment', id: 'line', x1: 400, y1: 1000, x2: 600, y2: 1000, thickness: 8 },
    { type: 'polygon', id: 'edge', points: [{ x: 400, y: 1000 }, { x: 600, y: 1000 }, { x: 500, y: 1100 }] }
  ];
  for (const obstacle of obstacles) {
    const p = game([obstacle]), m = p.marbles[0];
    Object.assign(m, { x: 500, y: 1000, vx: 0, vy: 0 });
    p._obstacles(m);
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y));
    assert.ok(penetration(m, obstacle) < .1, obstacle.id + ' remains embedded');
  }
});

test('rotated rounded boost areas apply force exactly within the visible region, including corners', () => {
  for (const direction of [{ dx: .8, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }]) {
    const field = { type: 'boost', id: 'boost', x: 500, y: 1500, width: 180, height: 100, power: 1000, ...direction };
    const p = game([field]), m = p.marbles[0], a = Math.atan2(field.dy, field.dx) - Math.PI / 2;
    for (const [x, y, expected] of [[0, 0, true], [85, 0, true], [0, 45, true], [70, 40, true], [89, 49, false], [100, 0, false], [0, 60, false]]) {
      Object.assign(m, { x: field.x + Math.cos(a) * x - Math.sin(a) * y, y: field.y + Math.sin(a) * x + Math.cos(a) * y, vx: 0, vy: 0 });
      p._fieldsStep(m);
      assert.equal(Math.hypot(m.vx, m.vy) > 0, expected, JSON.stringify({ direction, x, y }));
    }
  }
});

test('the visible inner rail also contains initial positions, bounces and finished marbles', () => {
  for (const map of Object.values(P.MAPS)) {
    for (const radius of [8, 16, 18]) {
      const p = new P.Physics({ map, names: names(500), radius, seed: 'rail-packing' });
      for (const m of p.marbles) {
        assert.ok(m.x - m.r >= 36 && m.x + m.r <= map.width - 36, 'spawn lies inside the inner rail');
        assert.ok(m.y + m.r <= map.spawn.y + map.spawn.height, '500 balls fit above the first obstacle');
      }
      const m = p.marbles[0];
      Object.assign(m, { x: 5, vx: -300, y: 1000 }); p._walls(m);
      assert.ok(m.x - m.r >= 36 && m.vx > 0, 'left wall aligns with the rail');
      Object.assign(m, { x: map.width - 5, vx: 300 }); p._walls(m);
      assert.ok(m.x + m.r <= map.width - 36 && m.vx < 0, 'right wall aligns with the rail');
      Object.assign(m, { x: 0, y: map.finish.y + 1, vy: 100 }); p.step();
      assert.ok(m.finished && m.x - m.r >= 36, 'finish keeps the same walls');
    }
  }
});

test('stuck recovery is a distinct, repeatable event and lets a balanced ball finish with skills disabled', () => {
  const pin = { type: 'pin', id: 'balance', x: 500, y: 1000, r: 12 };
  const run = grouping => {
    const p = game([pin]), m = p.marbles[0], events = [];
    Object.assign(m, { x: 500, y: 980, vx: 0, vy: 0, _anchorY: 980 });
    let frame = 0;
    while (!p.complete && p.time < 45) {
      for (let i = 0, n = grouping[frame++ % grouping.length]; i < n && !p.complete; i++) {
        p.step();
        for (const e of p.drainEvents()) if (e.type === 'rescue' || e.rescue) events.push([e.type, p.ticks, e.id, m.vx, m.vy]);
      }
    }
    assert.ok(p.complete, 'balanced ball reaches finish without random skills');
    assert.ok(events.length > 0, 'recovery was needed');
    assert.ok(events.every(e => e[0] === 'rescue'), 'recovery must not masquerade as a map boost');
    assert.ok(events[0][1] >= 360, 'no recovery before three seconds without progress');
    return JSON.stringify({ events, finish: m.finishTime, x: m.x });
  };
  assert.equal(run([1]), run([2, 4, 1, 7]));
});

test('classic: 500 balls leave no deep obstacle overlap after each physics tick', () => {
  const p = new P.Physics({ map: P.MAPS.classic, names: names(500), seed: 'CLASSIC-CONTACT-500', radius: 8, gravity: 1500, restitution: .35 });
  Object.create(P.Cinematic.prototype).commitShuffle(p);
  let worst = 0, where;
  while (!p.complete && p.time < 60) {
    p.step(); p.drainEvents();
    const obstacles = p.map.obstacles.map(o => ['rotor', 'moving'].includes(o.type) ? { ...o, ...p.getObstaclePose(o) } : o);
    for (const m of p.marbles) for (const o of obstacles) {
      if (m.finished || (o.y !== undefined && Math.abs(m.y - o.y) > (o.length || o.r || 0) + 30)) continue;
      const amount = penetration(m, o);
      if (amount > worst) { worst = amount; where = { time: p.time, marble: m.id, obstacle: o.id }; }
    }
  }
  assert.ok(p.complete && p.finished.length === 500, 'all 500 balls finish the audited race');
  assert.ok(worst < .1, `remaining penetration ${worst}: ${JSON.stringify(where)}`);
});

test('ordinary equal-mass contacts conserve momentum and dissipate kinetic energy',()=>{
 for(const angle of [0,.7,1.6,2.4]){const p=new P.Physics({map:scene([]),names:names(2),seed:'ENERGY',radius:11}),[a,b]=p.marbles,nx=Math.cos(angle),ny=Math.sin(angle);Object.assign(a,{x:400,y:900,vx:nx*90-ny*20,vy:ny*90+nx*20});Object.assign(b,{x:400+nx*21,y:900+ny*21,vx:-nx*40+ny*10,vy:-ny*40-nx*10});const momentum=[a.vx+b.vx,a.vy+b.vy],energy=a.vx*a.vx+a.vy*a.vy+b.vx*b.vx+b.vy*b.vy;p._pairs();assert(Math.abs(a.vx+b.vx-momentum[0])<1e-8);assert(Math.abs(a.vy+b.vy-momentum[1])<1e-8);assert(a.vx*a.vx+a.vy*a.vy+b.vx*b.vx+b.vy*b.vy<=energy+1e-8);assert(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r);}
});
test('ordinary static impacts use restitution while moving surfaces use relative velocity',()=>{
 const p=game([]),m=p.marbles[0];Object.assign(m,{vx:-120,vy:25});p._respond(m,1,0,null,0,0);assert(Math.abs(m.vx-120*p.restitution)<1e-8);assert.equal(m.vy,25);Object.assign(m,{vx:-120,vy:25});p._respond(m,1,0,null,30,0);assert(Math.abs(m.vx-(30+150*p.restitution))<1e-8);assert.equal(m.vy,25);
});
test('an unobstructed race step applies configured gravity at the fixed 120Hz clock',()=>{
 const p=game([]),m=p.marbles[0];Object.assign(m,{x:500,y:1000,vx:0,vy:0});p.step();assert(Math.abs(m.vy-p.gravity/120)<1e-8);assert(Math.abs(m.y-(1000+p.gravity/120/120))<1e-8);assert.equal(p.time,1/120);
});
