'use strict';
const fs=require('node:fs'),{run}=require('./helpers.cjs');
const configs=[{}];for(const radius of [8,16])for(const gravity of [350,1500])for(const restitution of [.35,.92])configs.push({radius,gravity,restitution});
const rows=[];
for(const map of ['classic','twinfold','cascade','rhythm'])for(const count of [1,2,6,25,49,50])for(let sample=0;sample<2;sample++)for(let i=0;i<configs.length;i++){
 const r=run(map,count,'max50-'+map+'-'+count+'-'+sample+'-'+i,configs[i]);
 // Classic retains its original skills/recovery policy; these events are permitted there.
 r.fail= !r.complete||Object.entries(r.errors).some(([k,n])=>n&&!(map==='classic'&&k==='forbidden'));if(r.fail)console.log('FAIL',JSON.stringify(r));rows.push(r);
}
const summary={samples:rows.length,failures:rows.filter(r=>r.fail).length,maps:['classic','twinfold','cascade','rhythm'].map(map=>{const r=rows.filter(r=>r.map===map);return {map,samples:r.length,failures:r.filter(x=>x.fail).length,default50:r.filter(x=>x.count===50&&Object.keys(x.config).length===0).map(x=>x.time),minimumTime:Math.min(...r.map(x=>x.time)),maximumTime:Math.max(...r.map(x=>x.time))};})};
fs.mkdirSync('qa/four-maps/results',{recursive:true});fs.writeFileSync('qa/four-maps/results/max50-matrix.json',JSON.stringify({summary,rows},null,2));console.log(JSON.stringify(summary,null,2));if(summary.failures)process.exitCode=1;
