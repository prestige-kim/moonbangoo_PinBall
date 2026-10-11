'use strict';
const {loadPhysics,loadRules}=require('./adapter.cjs');
const {oracle}=require('./oracle.cjs');
const {quantile}=require('./stats.cjs');
const P=loadPhysics();loadRules(P);
function names(count,groups=1){return Array.from({length:count},(_,i)=>({id:'marble-'+(i+1),name:'그룹'+(i%groups),copy:Math.floor(i/groups)+1,copies:Math.ceil(count/groups)}));}
function run(config,seed,options={}){
  const delay=P.PHYSICS_TUNING.rescueDelay;P.PHYSICS_TUNING.rescueDelay=config.rescue===false?Infinity:3;
  const p=new P.Physics({names:names(config.count,config.groups),seed,...config});
  const slots=p.marbles.slice().sort((a,b)=>a.y-b.y||a.x-b.x).map(m=>m.id);
  if(options.starts)P.restoreHandStart(p,options.starts);
  const seen=new Set(),log=[],cost=[],errors={finite:0,bounds:0,velocity:0,polygon:0,ranking:0,oracle:0,timeout:0};
  let rescues=0,maxSpeed=0,first=null;
  while(!p.complete&&p.time<(options.limit||240)){
    const before=performance.now();p.step();if(options.benchmark&&p.ticks>120)cost.push(performance.now()-before);
    for(let i=0;i<p.marbles.length;i++){
      const m=p.marbles[i];
      if(![m.x,m.y,m.vx,m.vy,m.r].every(Number.isFinite))errors.finite++;
      if(m.x-m.r<p.bounds.left-1e-4||m.x+m.r>p.bounds.right+1e-4||m.y-m.r<p.bounds.top-1e-4||m.y+m.r>p.bounds.bottom+1e-4)errors.bounds++;
      maxSpeed=Math.max(maxSpeed,Math.hypot(m.vx,m.vy));if(Math.hypot(m.vx,m.vy)>5000)errors.velocity++;
      if(m.finished&&!seen.has(m.id)){seen.add(m.id);log.push({id:m.id,time:m.finishTime,order:i});if(first===null)first=p.time;}
      if(p.ticks%12===0&&!m.finished)for(const o of p.map.obstacles){if(o.type!=='polygon')continue;let inside=false;for(let a=0,b=o.points.length-1;a<o.points.length;b=a++){const u=o.points[a],v=o.points[b];if((u.y>m.y)!==(v.y>m.y)&&m.x<(v.x-u.x)*(m.y-u.y)/(v.y-u.y)+u.x)inside=!inside;}if(inside)errors.polygon++;}
    }
    for(const e of p.drainEvents())if(e.type==='rescue')rescues++;
  }
  P.PHYSICS_TUNING.rescueDelay=delay;
  if(!p.complete)errors.timeout++;
  if(new Set(p.finished.map(m=>m.id)).size!==p.finished.length||p.complete&&seen.size!==config.count)errors.ranking++;
  if(p.complete){for(const rule of ['first','last','nth','top'])for(const n of [...new Set([1,Math.ceil(config.count/2),config.count])]){
    if(JSON.stringify(P.chooseWinners(p.finished,{rule,rankN:n}).map(m=>m.id))!==JSON.stringify(oracle(log,rule,n,config.count)))errors.oracle++;
  }}
  const ranking=p.finished.map(m=>[m.id,m.finishTime]);
  return {seed,time:p.time,first,complete:p.complete,remaining:config.count-p.finished.length,errors,rescues,maxSpeed,slot:slots.indexOf(p.finished[0]?.id),winner:p.finished[0]?.id,ranking,stepP50:quantile(cost,.5),stepP95:quantile(cost,.95)};
}
module.exports={P,names,run};
