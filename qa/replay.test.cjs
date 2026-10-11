'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadPhysics}=require('./sim/adapter.cjs'),P=loadPhysics();
const snap=p=>p.finished.map(m=>[m.id,m.finishTime]);
function fixture(n=6){const p=new P.Physics({names:P.parseNames('공*'+n),seed:'REPLAY-RELEASE-0'}),h=new P.HandShuffle(p.marbles,p.seed);P.commitHandStart(p,h.bodies);return p;}
function finish(p){while(!p.complete&&p.time<240){p.step();p.drainEvents();}assert.ok(p.complete);return snap(p);}
test('saved hand start restores exact seeded results without consuming RNG',()=>{const a=fixture(),record=JSON.parse(JSON.stringify(a.handStart)),b=new P.Physics({names:P.parseNames('공*6'),seed:a.seed});let calls=0;const rand=b.random;b.random=()=>{calls++;return rand();};P.restoreHandStart(b,record);assert.equal(calls,0);assert.deepEqual(finish(a),finish(b));});
test('replay rejects corrupt, mismatched and incompatible snapshots before moving any ball',()=>{for(const mutate of [r=>r.seed='other',r=>r.version=999,r=>r.starts.pop(),r=>r.starts[0].x=Infinity,r=>r.starts[0].y=999999,r=>r.starts[0].id=r.starts[1].id,r=>r.signature='old-engine']){const p=fixture(),r=JSON.parse(JSON.stringify(p.handStart));mutate(r);const b=new P.Physics({names:P.parseNames('공*6'),seed:p.seed}),before=JSON.stringify(b.marbles);assert.throws(()=>P.restoreHandStart(b,r));assert.equal(JSON.stringify(b.marbles),before);}});
test('500 saved start positions restore byte-for-byte and preserve launch RNG',()=>{const a=fixture(500),b=new P.Physics({names:P.parseNames('공*500'),seed:a.seed});P.restoreHandStart(b,JSON.parse(JSON.stringify(a.handStart)));assert.deepEqual(b.marbles.map(m=>[m.id,m.x,m.y,m.vx,m.vy]),a.marbles.map(m=>[m.id,m.x,m.y,m.vx,m.vy]));assert.equal(a.random(),b.random());});
