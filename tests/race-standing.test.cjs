const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c={window:{}};vm.createContext(c);for(const name of ['maps','physics','race-standing']){const p=path.join(__dirname,'../js',name+'.js');if(fs.existsSync(p))vm.runInContext(fs.readFileSync(p,'utf8'),c);}const P=c.window.CosmicPinball;
test('initial equal-height participants have joint ranks and no arbitrary leader',()=>{for(const seed of ['A','B','C','D']){const p=new P.Physics({names:P.parseNames('귤*4,수박*2,키위*2'),map:P.MAPS.classic,seed});const original=JSON.stringify(p.marbles);for(let tick=0;tick<60;tick++){const ranks=p.getRanking(),display=P.raceStanding(ranks);assert.equal(display.leader,null);assert.deepEqual(Array.from(display.ranks),Array(8).fill(1));p.step(1/120);p.drainEvents();}const fresh=new P.Physics({names:P.parseNames('귤*4,수박*2,키위*2'),map:P.MAPS.classic,seed});assert.equal(JSON.stringify(fresh.marbles),original);}});
test('real lead, tied later positions, and finish order stay distinct',()=>{const a={id:'a',y:100,finished:false},b={id:'b',y:90,finished:false},d={id:'d',y:90,finished:false},e={id:'e',y:80,finished:false};const ranks=[a,b,d,e],before=JSON.stringify(ranks);assert.equal(P.raceStanding(ranks).leader,a);assert.deepEqual(Array.from(P.raceStanding(ranks).ranks),[1,2,2,4]);assert.equal(JSON.stringify(ranks),before);a.finished=b.finished=true;a.finishTime=b.finishTime=1;assert.deepEqual(Array.from(P.raceStanding(ranks).ranks),[1,2,3,4]);assert.equal(P.raceStanding(ranks).leader,a);assert.equal(P.raceStanding([]).leader,null);});

test('HUD leader ignores brief crossings, confirms a persistent lead, and commits finish immediately',()=>{
 const a={id:'a',y:100,finished:false},b={id:'b',y:90,finished:false},display=new P.LiveLeader();
 assert.equal(display.update([a,b],0),a);
 assert.equal(display.update([b,a],.1),a);
 assert.equal(display.update([a,b],.2),a);
 assert.equal(display.update([b,a],.3),a);
 assert.equal(display.update([b,a],.74),a);
 assert.equal(display.update([b,a],.76),b);
 a.finished=true;assert.equal(display.update([a,b],.77),a);
 assert.equal(display.update([],1),null);
});
test('HUD stabilization never changes actual ranking or finish data',()=>{
 const ranking=[{id:'a',y:100,finished:false},{id:'b',y:90,finished:false}],before=JSON.stringify(ranking),display=new P.LiveLeader();
 display.update(ranking,0);display.update(ranking.slice().reverse(),.1);
 assert.equal(JSON.stringify(ranking),before);
 const fresh=new P.LiveLeader();assert.equal(fresh.update([{id:'a',y:100},{id:'b',y:100}],0),null);
});
