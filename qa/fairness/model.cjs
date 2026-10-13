'use strict';
const fs=require('node:fs'),path=require('node:path'),{loadPhysics,loadRules,root}=require('../sim/adapter.cjs'),{oracle}=require('../sim/oracle.cjs');
const P=loadPhysics();loadRules(P);let now=0;
for(const file of ['cinematic','throw-gate','hand-scene'])new Function('window','document','performance',fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'))({CosmicPinball:P},{},{now:()=>now});
function entries(groups){return P.parseNames(groups.map((n,i)=>P.COLOR_GROUPS[i].name+'*'+n).join(','));}
function permutation(n,seed){const out=Array.from({length:n},(_,i)=>i),r=P.seedRandom(seed+'|participant-slot-v2');for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function gesture(seed,protocol){if(protocol==='B')return {kind:'none',duration:0};if(protocol==='C')return {kind:'circle',duration:2,direction:1,radius:.12,speed:8};const r=P.seedRandom(seed+'|gesture');return {kind:['circle','eight','shake','none'][Math.floor(r()*4)],duration:r()*6,direction:r()<.5?-1:1,radius:.03+r()*.17,speed:2+r()*10};}
function capture(config,seed,protocol){
 const p=new P.Physics({names:entries(config.groups),seed,map:config.map?P.MAPS[config.map]:undefined,radius:config.radius||12,gravity:config.gravity||620,restitution:config.restitution||.72,skills:!!config.skills}),c=Object.create(P.Cinematic.prototype);Object.assign(c,{width:1280,height:720,lastTime:0,lastStage:null,resize(){}});
 const s=new P.HandScene(c),gate=s.gate=new P.ThrowGate();s.begin(p);now=0;
 const update=()=>{now+=1000/120;s.update(1/120);};for(let i=0;i<120;i++)update();
 const rig=s.rigAt(s.elapsed,s.area()),start={x:rig.x+rig.length*.4,y:rig.y,time:now};if(!s.beginTilt(start))throw new Error('tilt rejected');s.releaseTilt({...start,x:rig.x+rig.length*.12,y:rig.y+rig.length*.45});for(let t=0;t<2400&&!s.ready;t++)update();if(!s.ready)throw new Error('pour timeout');
 const params=gesture(seed,protocol);
 if(params.kind!=='none'){
  s.shuffle.begin(0,0,now);
  for(let i=1;i<=Math.round(params.duration*120);i++){const t=i/120,q=t*params.speed*params.direction,r=params.radius;now+=1000/120;const x=r*Math.cos(q),y=params.kind==='eight'?r*Math.sin(2*q):params.kind==='shake'?0:r*Math.sin(q);s.shuffle.move(x,y,now);s.update(1/120);}
  s.shuffle.release();
 }else for(let i=0;i<Math.round(params.duration*120);i++)update();
 if(config.candidate==='a'&&(params.kind==='none'||params.duration<2)){params.autoMixSeconds=2;s.shuffle.begin(0,0,now);for(let i=1;i<=240;i++){now+=1000/120;s.shuffle.move(.12*Math.cos(i/120*8),.12*Math.sin(i/120*8),now);s.update(1/120);}s.shuffle.release();}
 // Same public event semantics as main.js, including event-time sweep impulses.
 const a=s.area(),b=s.shuffle.bodies.slice().sort((u,v)=>u.x*u.x+u.y*u.y-v.x*v.x-v.y*v.y||u.index-v.index)[0],z=s.viewScale;
 const from={x:b.x*z,y:b.y*z},mouth=P.EDGE_GEOMETRY.opening(P.EDGE_GEOMETRY.bounds(a));gate.begin(from.x,from.y,now,a);s.shuffle.begin(from.x/z,from.y/z,now);
 const moves=[{x:mouth.x-.02,y:mouth.y+.02},{x:mouth.x+.05,y:mouth.y-.05}];let decision;
 for(const point of moves){now+=30;const touched=s.shuffle.move(point.x/z,point.y/z,now);gate.move(point.x,point.y,now,touched);decision=gate.takeExit(now);if(decision.fired)break;}
 if(!decision?.fired)throw new Error('real outlet rejected '+seed);s.shuffle.release();P.commitHandStart(p,s.shuffle.bodies);
 if(config.candidate==='b'){const old=p.handStart.starts.map(x=>({...x})),perm=permutation(old.length,seed);p.handStart.starts=old.map((x,i)=>({...old[perm[i]],id:x.id}));p.handStart.starts.forEach((x,i)=>Object.assign(p.marbles[i],{x:x.x,y:x.y,vx:x.vx,vy:x.vy,_anchorY:x.y}));}
 return {p,params,decision,start:p.handStart};
}
function run(config,seed,protocol){
 const before=performance.now(),{p,params,start}=capture(config,seed,protocol),count=p.marbles.length,ids=p.marbles.map(m=>m.id),order=new Map(ids.map((id,i)=>[id,i])),slots=p.marbles.slice().sort((a,b)=>a.y-b.y||a.x-b.x).map(m=>m.id),log=[],seen=new Set(),errors={finite:0,bounds:0,ranking:0,oracle:0,timeout:0};let rescues=0;
 while(!p.complete&&p.time<900){p.step();for(const e of p.drainEvents())if(e.type==='rescue')rescues++;if(p.finished.length!==seen.size)for(const m of p.marbles)if(m.finished&&!seen.has(m.id)){seen.add(m.id);log.push({id:m.id,time:m.finishTime,order:order.get(m.id)});}if(count<=12||p.ticks%120===0)for(const m of p.marbles){if(![m.x,m.y,m.vx,m.vy].every(Number.isFinite))errors.finite++;if(m.x-m.r<p.bounds.left-1e-4||m.x+m.r>p.bounds.right+1e-4||m.y-m.r<p.bounds.top-1e-4||m.y+m.r>p.bounds.bottom+1e-4)errors.bounds++;}}
 if(!p.complete)errors.timeout++;if(seen.size!==count||p.finished.length!==count||new Set(p.finished.map(m=>m.id)).size!==count)errors.ranking++;
 for(const rule of ['first','last','nth','top'])for(const rankN of [...new Set([1,Math.ceil(count/2),count])])if(p.complete&&JSON.stringify(P.chooseWinners(p.finished,{rule,rankN}).map(m=>m.id))!==JSON.stringify(oracle(log,rule,rankN,count)))errors.oracle++;
 const winner=p.finished[0],index=order.get(winner?.id);let group=0,n=config.groups[0];while(index>=n&&group<config.groups.length-1)n+=config.groups[++group];
 return {seed,protocol,skills:!!config.skills,time:p.time,complete:p.complete,winner:winner?.id,group,slot:slots.indexOf(winner?.id),rescues,errors,gesture:params,cpuMs:performance.now()-before,startVersion:start.version};
}
module.exports={P,entries,permutation,gesture,capture,run};
