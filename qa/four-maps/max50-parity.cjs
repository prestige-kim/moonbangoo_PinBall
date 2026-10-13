'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{run}=require('./helpers.cjs'),rows=[];
for(const map of ['classic','twinfold','cascade','rhythm'])for(const count of [1,2,6,25,49,50])for(const skills of [false,true]){
 const r=run(map,count,'max50-parity-'+map+'-'+count+'-'+skills,{skills});
 rows.push({map,count,skills,complete:r.complete,time:r.time,rankingHash:crypto.createHash('sha256').update(JSON.stringify(r.ranking)).digest('hex')});
}
fs.writeFileSync(process.argv[2],JSON.stringify(rows,null,2));
