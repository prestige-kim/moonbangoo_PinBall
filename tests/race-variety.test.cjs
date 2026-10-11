const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({window:{}});for(const file of ['maps','physics'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+file+'.js','utf8'),context);const P=context.window.CosmicPinball;
function sample(dynamic){let lateWins=0,changes=0,totalTime=0;for(let seed=0;seed<32;seed++){
 const map=JSON.parse(JSON.stringify(P.MAPS.classic));if(!dynamic)map.obstacles=map.obstacles.filter(o=>!o.id.startsWith('race-rotor-'));
 const physics=new P.Physics({map,names:P.parseNames('빨강*2,초록*2,파랑*2'),seed:'race-audit-'+seed});let late=null,last=null;
 while(!physics.finished.length&&physics.time<150){physics.step();physics.drainEvents();if(physics.ticks%24===0){const rank=physics.getRanking();if(!late&&rank[0].y>=map.finish.y-960)late=rank[0].id;if(rank[0].y>2000&&rank[0].y-rank[1].y>30){if(last&&last!==rank[0].id)changes++;last=rank[0].id;}}}
 assert(physics.finished.length,'first finisher must arrive');lateWins+=late===physics.finished[0].id;totalTime+=physics.time;
 }return {lateWins,changes,meanTime:totalTime/32};}
test('winding rotating course retains overtakes and uncertain late winners on a fixed seed cohort',()=>{
 const before=sample(false),after=sample(true);console.log({before,after});
 assert(after.lateWins<=24,'at least a quarter of late leaders must be overtaken');assert(after.changes>before.changes);assert(after.meanTime<40);
});
test('rotating obstacles share deterministic contact poses and stay inside the board',()=>{
 const a=new P.Physics({names:P.parseNames('빨강*6'),seed:'same'}),b=new P.Physics({names:P.parseNames('빨강*6'),seed:'same'});
 for(let i=0;i<1200;i++){a.step();b.step();a.drainEvents();b.drainEvents();}
 assert.equal(JSON.stringify(a.marbles),JSON.stringify(b.marbles));
 const gates=P.MAPS.classic.obstacles.filter(o=>o.id.startsWith('sweep-gate-'));assert.equal(gates.length,4);
 for(const gate of gates){const first=a.getObstaclePose(gate);a.time+=.75;const next=a.getObstaclePose(gate);a.time-=.75;assert.notEqual(first.x,next.x);assert(Math.min(first.x1,first.x2)>36&&Math.max(first.x1,first.x2)<964);}
 const rotors=P.MAPS.classic.obstacles.filter(o=>o.id.startsWith('race-rotor-'));assert.equal(rotors.length,8);
 for(const rotor of rotors){const pose=a.getObstaclePose(rotor);assert(pose.x1>36&&pose.x2<964);assert(pose.y1>700&&pose.y2<6960);}
});
