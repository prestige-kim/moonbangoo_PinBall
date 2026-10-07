const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {}, document: {}, Math };
vm.createContext(sandbox);
for (const name of ['maps','physics','cinematic']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'),sandbox);
const P = sandbox.window.CosmicPinball;
const game = (count,seed='chamber-test') => new P.Physics({map:P.MAPS.classic,names:P.parseNames('구슬*'+count),seed});
const chamber = physics => new P.CINEMA.Chamber(P.CINEMA.descriptors(physics),physics.seed);
const snapshot = value => JSON.stringify(value);
function cinema(physics) {
  const value = Object.create(P.Cinematic.prototype);
  value.lastTime=0; value.entries(physics); return value;
}

test('hard spheres exchange axial order, collide and bounce off the glass wall', () => {
  const sim = chamber(game(6));
  const order = () => sim.bodies.slice().sort((a,b)=>a.x-b.x).map(b=>b.index).join(',');
  const initialOrder=order(); let travel=0, previous=sim.bodies.map(b=>({...b}));
  for(let tick=0;tick<216;tick++){sim.step(true);travel+=Math.hypot(sim.bodies[0].x-previous[0].x,sim.bodies[0].y-previous[0].y);previous=sim.bodies.map(b=>({...b}));}
  assert.notEqual(order(),initialOrder,'participants move past one another along the whole barrel');
  assert(sim.collisions>0,'sphere contacts must exchange momentum');
  assert(sim.wallHits>0,'closed glass chamber reflects the marbles');
  assert(travel>2,'cumulative travel, rather than net displacement, distinguishes energetic motion from a fixed wobble');
  assert(sim.bodies.every(b=>b.z===0&&b.vz===0),'visible contacts stay in one physical plane');
  for (const b of sim.bodies) {
    assert(Math.abs(b.x)+b.r<=3.2+1e-8); assert(Math.hypot(b.y,b.z)+b.r<=1+1e-8);
  }
});

test('fixed-step mixing is identical across frame grouping, including 500 participants', () => {
  for (const count of [1,6,50,200,500]) {
    const physics=game(count,'fixed-'+count), one=chamber(physics), many=chamber(physics);
    one.seek(4,true);
    for (let t=0;t<4;t+=1/24) many.seek(Math.min(4,t),true);
    many.seek(4,true);
    assert.equal(snapshot(one.bodies),snapshot(many.bodies));
    assert.equal(one.ticks,480);
    for (const b of one.bodies) {
      assert(Object.values(b).every(Number.isFinite));
      assert(Math.abs(b.x)+b.r<=3.2+1e-8); assert(Math.hypot(b.y,b.z)+b.r<=1+1e-8);
    }
  }
});

test('visible pinballs retain seeded race slots without changing time or race RNG', () => {
  const physics=game(50,'actual-shuffle'), twin=game(50,'actual-shuffle'), scene=cinema(physics);
  const seededFirst=scene.cache.entries.slice().sort((a,b)=>a.lane-b.lane)[0].index;
  const before=snapshot(physics.marbles), slots=physics.marbles.map(m=>[m.x,m.y,m.vx,m.vy]).sort();
  scene.chamber.seek(3.75,true);
  assert.equal(snapshot(physics.marbles),before,'mixing remains separate from the frozen race');
  scene.commitShuffle(physics);
  assert.notEqual(snapshot(physics.marbles),before,'the physical starting ownership must really change');
  assert.equal(snapshot(physics.marbles.map(m=>[m.x,m.y,m.vx,m.vy]).sort()),snapshot(slots),'the valid nonoverlapping slots are preserved');
  const leftFirst=physics.marbles.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
  assert.equal(seededFirst,leftFirst[0].colorIndex,'each visible identity arrives at its independently seeded slot');
  const committed=snapshot(physics.marbles); scene.commitShuffle(physics); assert.equal(snapshot(physics.marbles),committed);
  assert.equal(physics.time,0); assert.equal(physics.ticks,0);
  for(let i=0;i<5;i++) assert.equal(physics.random(),twin.random());
});

test('seeded shuffled starts replay across rendering schedules and vary with fresh seeds', () => {
  const a=game(6,'replay'), b=game(6,'replay'), one=cinema(a), many=cinema(b);
  one.commitShuffle(a);
  for(let t=0;t<=4;t+=1/60) many.chamber.seek(t,true);
  many.commitShuffle(b);
  assert.equal(snapshot(a.marbles),snapshot(b.marbles));
  const starts=new Set(), firstColumns=new Set();
  for(let i=0;i<16;i++) {
    const p=game(6,'fresh-'+i), s=cinema(p); s.commitShuffle(p);
    starts.add(snapshot(p.marbles.map(m=>[m.x,m.y])));
    firstColumns.add(p.marbles[0].x<333?'left':p.marbles[0].x>667?'right':'middle');
  }
  assert.equal(starts.size,16); assert.equal(firstColumns.size,3);
});

test('the visible board remains in one scene as the camera moves to the exact race transform', () => {
  for(const [width,height] of [[1280,720],[375,812],[587,668]]) {
    const camera={x:500,y:580,zoom:width<700?.3:.86,worldToScreen(x,y){return{x:width*.38+(x-this.x)*this.zoom,y:height*.46+(y-this.y)*this.zoom};}};
    const points=[[0,0],[50,120],[950,700]];
    const initial=P.CINEMA.boardView(width,height,camera,0,false);
    for(const p of [0,.12,.24,.4,.6,.8,.98,1]) {
      const view=P.CINEMA.boardView(width,height,camera,p,false);
      assert(view.scale>0); assert(view.amount>=0&&view.amount<=1);
      for(const [x,y]of points) {
        const onBoard=P.CINEMA.mapPoint(view.initial,x,y);
        const onScreen=P.CINEMA.mapPoint(view.scene,onBoard.x,onBoard.y);
        const current=P.CINEMA.mapPoint(view.current,x,y);
        assert(Math.hypot(onScreen.x-current.x,onScreen.y-current.y)<1e-8);
        if(p===1){const target=camera.worldToScreen(x,y);assert(Math.hypot(current.x-target.x,current.y-target.y)<1e-8);}
      }
      assert.equal(snapshot(view.initial),snapshot(initial.initial),'board world position never changes during the shot');
    }
  }
  const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
  assert.match(css,/\.scene-flight #game-canvas\{opacity:1;/,'race content is revealed by camera movement, never a whole-map fade');
});

test('shuffled physical races keep seeded results and allow different input owners to win', () => {
  const winners=new Set();
  let first;
  for(let seed=0;seed<12;seed++) {
    const p=game(6,'mixed-race-'+seed), s=cinema(p); s.commitShuffle(p);
    while(!p.complete&&p.time<180) {p.step();p.drainEvents();}
    assert(p.complete,'the shuffled slots still complete a physical race');
    winners.add(p.finished[0].colorIndex);
    if(!seed) first=snapshot(p.finished.map(m=>[m.id,m.finishTime]));
  }
  assert(winners.size>=3,'a permanent center/input owner must not win every round');
  const p=game(6,'mixed-race-0'),s=cinema(p);
  for(let t=0;t<4;t+=1/24)s.chamber.seek(t,true);
  s.commitShuffle(p);
  while(!p.complete&&p.time<180){for(let i=0;i<7&&!p.complete;i++)p.step();p.drainEvents();}
  assert.equal(snapshot(p.finished.map(m=>[m.id,m.finishTime])),first);
});

test('longer visible choreography preserves fixed-step shuffle ownership', () => {
  for(const count of [6,50,200,500]) {
    const a=game(count,'film-preservation-'+count),b=game(count,'film-preservation-'+count), scene=cinema(a),direct=cinema(b);
    // Render schedules drive the old virtual clock, despite a longer wall-clock shot.
    const timing=P.CINEMA.timing;
    for(let t=0;t<=timing.mixing;t+=1/30) scene.chamber.seek(Math.min(1,t/timing.mixing)*timing.chamberMix,true);
    for(let t=0;t<=timing.aiming;t+=1/60) scene.chamber.seek(timing.chamberMix+Math.min(1,t/timing.aiming)*timing.chamberAim,true);
    scene.commitShuffle(a);direct.commitShuffle(b);
    assert.equal(snapshot(scene.frozenTube),snapshot(direct.frozenTube));
    assert.equal(snapshot(a.marbles),snapshot(b.marbles));
    assert.equal(a.time,0);assert.equal(a.ticks,0);
  }
});
