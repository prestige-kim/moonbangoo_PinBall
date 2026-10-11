'use strict';
const fs=require('node:fs'),{run}=require('./engine.cjs');
const results=[];for(const skills of [false,true])for(let i=0;i<10;i++){const row=run({count:500,groups:8,radius:12,gravity:620,restitution:.72,skills},'release-benchmark-'+i,{benchmark:true});delete row.ranking;results.push(row);console.log('CPU 500',skills,i,row.stepP50,row.stepP95);}
fs.writeFileSync('qa/results/step-benchmark.json',JSON.stringify({at:new Date().toISOString(),conditions:'Native Node production physics adapter; 500 balls default physics; 10 seeds per skill arm, all steps after first second; no rendering; concurrent audit processes may contend for CPU',results},null,2));
