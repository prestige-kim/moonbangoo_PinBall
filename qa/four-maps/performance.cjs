'use strict';
const fs=require('node:fs'),{run}=require('./helpers.cjs');const results=[];
// Run after other QA has finished: serial samples on one machine, no browser FPS inference.
for(const map of ['classic','twinfold','cascade','rhythm'])for(const count of [50])for(let i=0;i<5;i++){
 const r=run(map,count,'fourmaps-isolated-performance-'+map+'-'+count+'-'+i,{},null,[1],true);
 results.push({map,count,seed:r.seed,time:r.time,complete:r.complete,stepP50:r.stepP50,stepP95:r.stepP95});
}
fs.writeFileSync('qa/four-maps/results/performance.json',JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,cpus:require('node:os').cpus().length,serial:true,results},null,2));console.log(results.map(r=>({map:r.map,count:r.count,p95:r.stepP95})));
