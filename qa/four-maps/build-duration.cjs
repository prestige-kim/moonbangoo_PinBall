'use strict';
const fs=require('node:fs'),{quantile}=require('../sim/stats.cjs'),{loadPhysics}=require('../sim/adapter.cjs'),P=loadPhysics(),rows=[];
for(const map of ['twinfold','cascade','rhythm']){
 const result=JSON.parse(fs.readFileSync('qa/four-maps/results/'+map+'.json')),groups=new Map();
 if(result.hands.some(h=>JSON.parse(h.start.signature)[1].version!==P.MAPS[map].version))throw new Error('Duration evidence belongs to an older map version');
 for(const r of result.matrix){if(!r.complete||Object.values(r.errors).some(n=>n))throw new Error('Do not publish censored or failed samples');const c={map,mapVersion:P.MAPS[map].version,count:r.count,radius:r.config.radius||12,gravity:r.config.gravity||620,restitution:r.config.restitution||.72,skills:false},key=JSON.stringify(c);if(!groups.has(key))groups.set(key,{config:c,times:[]});groups.get(key).times.push(r.time);}
 for(const {config:c,times}of groups.values())rows.push({...c,n:times.length,p50:quantile(times,.5),p95:times.slice().sort((a,b)=>a-b)[Math.ceil(times.length*.95)-1],max:Math.max(...times),source:'fourmaps-development-spawn-matrix'});
}
fs.writeFileSync('js/maps-duration-data.js',"(function(P){'use strict';P.RACE_DURATION_SAMPLES=(P.RACE_DURATION_SAMPLES||[]).concat("+JSON.stringify(rows)+");})(window.CosmicPinball);\n");console.log('Map-specific measured rows:',rows.length);
