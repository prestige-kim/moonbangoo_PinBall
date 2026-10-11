'use strict';
const fs=require('node:fs'),{run}=require('./engine.cjs');
const r=JSON.parse(fs.readFileSync('qa/results/extended.json','utf8'));
for(const [count,groups] of [[2,2],[6,6]])for(const skills of [false,true]){if(r.groupInvariance.some(x=>x.count===count&&x.groups===groups&&x.skills===skills))continue;const c={count,groups:1,radius:12,gravity:620,restitution:.72,skills},seed='release-group-'+count,a=run(c,seed),b=run({...c,groups},seed);r.groupInvariance.push({count,groups,skills,equal:JSON.stringify(a.ranking)===JSON.stringify(b.ranking)});}
fs.writeFileSync('qa/results/extended.json',JSON.stringify(r,null,2));
