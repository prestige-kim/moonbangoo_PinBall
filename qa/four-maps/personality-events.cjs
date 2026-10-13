'use strict';
const fs=require('node:fs'),{run}=require('./helpers.cjs'),rows=[];
for(const map of ['classic','twinfold','cascade','rhythm'])for(let i=0;i<8;i++){
 const r=run(map,50,'map-personality-before-after-'+map+'-'+i);if(!r.complete)throw Error(map+' timeout');rows.push({map,seed:r.seed,time:r.time,hitEvents:r.hitEvents,addedHits:r.addedHits,hitObstacles:r.hitObstacles});
}
fs.writeFileSync(process.argv[2],JSON.stringify(rows,null,2));
