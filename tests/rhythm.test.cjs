'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{P,run,assertRun,assertGaps}=require('../qa/four-maps/helpers.cjs');
const map=P.MAPS.rhythm;
test('rhythm v3 alternates four shutters, six offbeat paddles and four sequential final gates',()=>{
 assert.equal(map.version,3);assert.equal(map.obstacles.filter(o=>o.role==='beat-shutter').length,4);assert.equal(map.obstacles.filter(o=>o.role==='beat-paddle').length,6);assert.equal(map.obstacles.filter(o=>o.role==='beat-chain').length,4);
 const p=new P.Physics({map,names:P.parseNames('공'),skills:true});assert.equal(p.skills,false);
 const shutters=map.obstacles.filter(o=>o.role==='beat-shutter');for(let i=0;i<4;i+=2){const [a,b]=shutters.slice(i,i+2),t=((Math.PI/2-a.phase)/a.speed+4.8)%4.8;
  p.time=t;assert(p.getObstaclePose(a).x2>700);assert(p.getObstaclePose(b).x1>964);
  p.time=t+2.4;assert(p.getObstaclePose(a).x2<36);assert(p.getObstaclePose(b).x1<300);
 }
 const chain=map.obstacles.filter(o=>o.role==='beat-chain');for(let i=0;i<4;i++){
  const o=chain[i];p.time=.8+i*.8;const closed=p.getObstaclePose(o);assert(o.side===-1?closed.x2>630:closed.x1<370);
  p.time+=1.6;const open=p.getObstaclePose(o);assert(o.side===-1?open.x2<36:open.x1>964);assert(o.y>=7900&&o.y<=9700);
 }
 const paddles=map.obstacles.filter(o=>o.role==='beat-paddle');for(let i=0;i<6;i+=2){assert.equal(paddles[i].speed,-paddles[i+1].speed);assert(Math.abs(paddles[i+1].angle-paddles[i].angle-Math.PI/2)<1e-8);}
});
test('six fixed guide pairs block all vertical rays even when shutters withdraw',()=>{
 for(let i=0;i<6;i++){const a=map.obstacles.find(o=>o.id==='rhythm-guide-'+i+'-left'),b=map.obstacles.find(o=>o.id==='rhythm-guide-'+i+'-right');assert(a.x1<=36&&a.x2>=b.x1&&b.x2>=964);}
});
test('shutter, paddle and chain timing cause real contact-dependent arrival delays',()=>{
 for(const role of ['beat-shutter','beat-paddle','beat-chain']){const o=map.obstacles.find(o=>o.role===role),times=[],hits=[];
  for(let i=0;i<16;i++){const phase=o.beat.period*i/16,p=new P.Physics({map:{...map,obstacles:[o]},names:P.parseNames('공')});Object.assign(p.marbles[0],{x:role==='beat-paddle'?o.x+60:420,y:o.y-180,vx:0,vy:120});p.time=phase;p.ticks=Math.round(phase*120);let contacts=0;
   while(p.time-phase<8&&p.marbles[0].y<o.y+180){p.step();for(const e of p.drainEvents()){assert(!['rescue','skill','portal','boost'].includes(e.type));if(e.type==='hit'&&e.obstacle)contacts++;}}
   assert(p.marbles[0].y>=o.y+180,role+' must release');times.push(p.time-phase);hits.push(contacts);
  }
  assert(Math.max(...times)-Math.min(...times)>.5,role+' must split timing by more than half a second');assert(hits.some(n=>n>0)&&hits.some(n=>n===0),'both interception and open passage must occur');
 }
});
test('rhythm completes 1..50 balls without force recovery, and grouping does not change results',()=>{
 for(const n of [1,2,6,25,49,50])assertRun(run('rhythm',n,'fourmaps-dev-rhythm-v3-smoke-'+n));
 assert.deepEqual(run('rhythm',6,'repeat',{},null,[1]).ranking,run('rhythm',6,'repeat',{},null,[4,2,1]).ranking);
});
test('rhythm keeps >=96 independent clearance through the complete 9.6 second combined cycle',()=>assertGaps('rhythm',9.6));
test('rhythm rendering follows actual collision poses and paused physical time without changing state',()=>{
 new Function('window',fs.readFileSync('js/renderer.js','utf8'))({CosmicPinball:P});const o=map.obstacles.find(o=>o.role==='beat-chain'),p=new P.Physics({map,names:P.parseNames('공')});p.time=.8;
 function trace(reduced){const calls=[];const ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});const r=Object.assign(Object.create(P.Renderer.prototype),{ctx,reducedMotion:reduced});r.drawRhythmObstacle(o,p);return calls;}
 const before=JSON.stringify(p.marbles),pose=p.getObstaclePose(o),a=trace(false);assert(a.some(c=>c[0]==='moveTo'&&c[1]===pose.x1&&c[2]===pose.y1));assert(a.some(c=>c[0]==='lineTo'&&c[1]===pose.x2&&c[2]===pose.y2));assert(a.some(c=>c[0]==='fillText'&&c[1].includes('연쇄 게이트')));assert.deepEqual(a,trace(true));assert.deepEqual(a,trace(false));assert.equal(JSON.stringify(p.marbles),before);
 p.time=2.4;assert.notDeepEqual(trace(false),a);
});
