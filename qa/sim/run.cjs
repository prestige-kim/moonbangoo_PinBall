'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {quantile,chiSquare}=require('./stats.cjs');
if(!isMainThread){const {run}=require('./engine.cjs');parentPort.on('message',job=>{const out=[];for(let i=job.start;i<job.end;i++){const r=run(job.config,'release-audit-'+String(i).padStart(4,'0'));delete r.ranking;out.push(r);}parentPort.postMessage({id:job.id,start:job.start,rows:out});});}
else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
  const args=process.argv.slice(2),full=args.includes('--full'),quick=args.includes('--quick');
  const seeds=Number(args.find(a=>a.startsWith('--seeds='))?.split('=')[1]||(quick?3:300));
  const workers=Number(args.find(a=>a.startsWith('--workers='))?.split('=')[1]||Math.min(4,os.availableParallelism()));
  const outPath=path.resolve(args.find(a=>a.startsWith('--out='))?.slice(6)||'qa/results/simulation.json');
  const configs=[],keys=new Set();function add(c){const k=JSON.stringify(c);if(!keys.has(k)){keys.add(k);configs.push(c);}}
  const def={radius:12,gravity:620,restitution:.72};
  for(const count of [1,2,6,50,200,500])for(const skills of [false,true])add({count,groups:1,...def,skills});
  for(const count of full?[1,2,6,50,200,500]:[6])for(const radius of [8,12,16])for(const gravity of [350,620,1500])for(const restitution of [.35,.72,.92])for(const skills of [false,true])add({count,groups:1,radius,gravity,restitution,skills});
  const result={started:new Date().toISOString(),mode:full?'full physics cross-product':'stratified: all physics for 6, default for other counts',seeds,workers,configs:configs.map(config=>({config,rows:[]}))};
  const jobs=[];configs.forEach((config,id)=>{for(let start=0;start<seeds;start+=10)jobs.push({id,config,start,end:Math.min(seeds,start+10)});});
  let next=0,done=0;
  await Promise.all(Array.from({length:workers},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);w.on('message',r=>{result.configs[r.id].rows.push(...r.rows);done++;fs.writeFileSync(outPath+'.partial.json',JSON.stringify({jobsDone:done,jobsTotal:jobs.length,started:result.started}));if(done%10===0)console.log('simulation batches',done,'/',jobs.length);dispatch();});function dispatch(){if(next===jobs.length){w.terminate().then(resolve);return;}w.postMessage(jobs[next++]);}dispatch();})));
  for(const cell of result.configs){cell.rows.sort((a,b)=>a.seed.localeCompare(b.seed));const rows=cell.rows;
    cell.summary={runs:rows.length,violations:Object.fromEntries(Object.keys(rows[0].errors).map(k=>[k,rows.filter(r=>r.errors[k]).length])),representatives:rows.filter(r=>Object.values(r.errors).some(Boolean)).slice(0,10),time:{p50:quantile(rows.map(r=>r.time),.5),p95:quantile(rows.map(r=>r.time),.95),max:Math.max(...rows.map(r=>r.time)),over120:rows.filter(r=>r.time>120).length,under10:rows.filter(r=>r.time<10).length},rescues:{p50:quantile(rows.map(r=>r.rescues),.5),p95:quantile(rows.map(r=>r.rescues),.95),max:Math.max(...rows.map(r=>r.rescues))},maxSpeed:Math.max(...rows.map(r=>r.maxSpeed))};
    if(cell.config.count>1){const wins=Array(cell.config.count).fill(0),slots=wins.slice();for(const r of rows)if(r.winner){wins[Number(r.winner.split('-')[1])-1]++;slots[r.slot]++;}cell.summary.participantFairness=chiSquare(wins);cell.summary.slotFairness=chiSquare(slots);}
  }
  result.finished=new Date().toISOString();fs.writeFileSync(outPath,JSON.stringify(result,null,2));console.log('Saved',outPath,'games',configs.length*seeds);fs.unlinkSync(outPath+'.partial.json');
}
