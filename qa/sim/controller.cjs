'use strict';
const fs=require('node:fs'),boot=require('./controller-fixture.cjs');
// Reuse the existing real-main.js controller fixture. DOM/rendering only are mocked.
const out={at:new Date().toISOString(),runs:[],limitWallSeconds:900};
function execute(seed,fps,speed,jitter=false){const b=boot();Object.assign(b.P.app.ui.values,{seed,speed});b.callbacks.start();b.launch();let frames=0;const schedule=[144,30,60,8,90,5,120,20];while(b.P.app.status==='running'&&frames<900*fps){b.advance(1/(jitter?schedule[frames%schedule.length]:fps),jitter?schedule[frames%schedule.length]:fps);frames++;}return {status:b.P.app.status,time:b.P.app.physics.time,ranking:JSON.stringify(b.P.app.physics.finished.map(m=>[m.id,m.finishTime]))};}
const seeds=Number(process.argv.find(a=>a.startsWith('--seeds='))?.split('=')[1]||300);
const outPath=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'qa/results/controller.json';
for(let i=0;i<seeds;i++){
 const seed='release-controller-'+String(i).padStart(4,'0'),base=execute(seed,60,1);
 for(const [fps,speed,jitter]of [[30,1,false],[144,1,false],[60,1,true],[60,.5,false],[60,3,false]]){const r=execute(seed,fps,speed,jitter);out.runs.push({seed,fps,speed,jitter,complete:r.status==='finished',equal:r.ranking===base.ranking,time:r.time});}
 if(i%10===0){fs.writeFileSync(outPath,JSON.stringify(out,null,2));console.log('controller',i,'/',seeds);}
}
fs.writeFileSync(outPath,JSON.stringify(out,null,2));
