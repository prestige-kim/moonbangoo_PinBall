'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),out={baseline:'78b23b4',files:[],functions:[]};
for(const f of ['js/maps.js','js/physics.js','js/shuffle.js','js/shuffle-input.js','js/hand-start.js','js/throw-gate.js','js/cinematic.js']){const a=execFileSync('git',['show','78b23b4:'+f]),b=fs.readFileSync(f);assert.equal(hash(a),hash(b),f);out.files.push({file:f,sha256:hash(b),unchanged:true});}
function portion(s,start,end){return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));}
for(const [file,start,end]of [['js/hand-scene.js','    stepPour(dt, area) {','    drawTube('],['js/main.js','  function updateRace(','  function frame(']]){const a=execFileSync('git',['show','78b23b4:'+file],{encoding:'utf8'}),b=fs.readFileSync(file,'utf8');assert.equal(portion(a,start,end),portion(b,start,end),start);out.functions.push({file,start,sha256:hash(portion(b,start,end)),unchanged:true});}
fs.writeFileSync('qa/interaction/results/invariants.json',JSON.stringify(out,null,2));console.log('PASS seven protected modules and pour/race functions unchanged');
