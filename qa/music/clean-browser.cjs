'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{pour}=require('../four-maps/browser.cjs');
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true}),report={maps:[],errors:[],limitation:'Decoded media playback and gain state tested; no physical speaker listening or handset validation.'};
 const src=P=>P.app.audio;
 try{for(const map of ['classic','twinfold','cascade','rhythm']){
  const c=await browser.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:8765/');
  await p.evaluate(()=>{window.audioProbe={samples:0,maxPlayers:0,maxVoices:0,violations:0};setInterval(()=>{const a=window.CosmicPinball?.app?.audio;if(!a)return;const n=[...document.querySelectorAll('audio')].filter(s=>!s.paused).length;audioProbe.samples++;audioProbe.maxPlayers=Math.max(audioProbe.maxPlayers,n);audioProbe.maxVoices=Math.max(audioProbe.maxVoices,a.voices);if(n>1)audioProbe.violations++;},10);});
  await p.locator('#intro-start-button').click();await p.locator('[data-map="'+map+'"]').click();await p.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*17,초록*17,파랑*16',speed:3,sound:true,volume:.35});u.emit('change',u.readSettings());});
  async function playing(track){await p.waitForFunction(t=>{const a=CosmicPinball.app.audio;return a.musicTrack===t&&a.music&&!a.music.paused&&a.music.currentTime>.05;},track,{timeout:15000});}
  await playing('chipper-doodle-v2');await p.locator('#start-button').click();await playing('electrodoodle');await pour(p);await playing('bit-quest');
  // Mute/resume during an actual dense race.
  await p.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),sound:false});u.emit('change',u.readSettings());});assert(await p.evaluate(()=>[...document.querySelectorAll('audio')].every(a=>a.paused)));
  await p.evaluate(()=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),sound:true});u.emit('change',u.readSettings());});await playing('bit-quest');
  await p.waitForFunction(()=>document.querySelector('#results-dialog').open,{},{timeout:120000});await playing('winner-winner');await p.waitForTimeout(800);
  const state=await p.evaluate(()=>({probe:audioProbe,ranked:CosmicPinball.app.physics.finished.length,voices:CosmicPinball.app.audio.voices}));assert.equal(state.probe.violations,0);assert.equal(state.probe.maxPlayers,1);assert(state.probe.maxVoices<=4);assert.equal(state.ranked,50);
  await p.locator('#restart-button').click();await playing('electrodoodle');
  // Exercise fast scene changes and late play promises without running another race.
  await p.evaluate(async()=>{const a=CosmicPinball.app.audio;for(const s of ['setup','running','mixing','result','setup','running']){a.setMusicScene(s);await new Promise(r=>setTimeout(r,50));}});await playing('bit-quest');await p.waitForTimeout(700);
  const final=await p.evaluate(()=>audioProbe);assert.equal(final.violations,0);report.maps.push({map,...state,final,stages:['setup','mixing','running','result','restart'],muteResume:true});await c.close();
 }}finally{fs.mkdirSync('qa/music/results',{recursive:true});fs.writeFileSync('qa/music/results/clean-browser.json',JSON.stringify(report,null,2));await browser.close();}
 assert.equal(report.errors.length,0);console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
