'use strict';
const fs = require('node:fs'), vm = require('node:vm'), test = require('node:test'), assert = require('node:assert/strict');
function fixture() {
  const sounds = [], timers = new Map(); let next = 0;
  class Audio {
    constructor(src) { this.src = src; this.paused = true; this.volume = 0; this.currentTime = 0; this.events = {}; sounds.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener(name, cb) { this.events[name] = cb; }
  }
  const document = { hidden: false };
  const window = { Audio, setInterval(fn) { timers.set(++next, fn); return next; }, clearInterval(id) { timers.delete(id); } };
  vm.runInNewContext(fs.readFileSync('js/audio.js', 'utf8'), { window, document });
  return { a: new window.CosmicPinball.AudioEngine(), sounds, document, window, settle() { for(let i=0;i<20;i++) for(const fn of [...timers.values()]) fn(); }, timers };
}
test('no background music is fetched before a positive-volume user unlock', () => {
  const f = fixture(); f.a.setMusicScene('intro'); assert.equal(f.sounds.length, 0);
  f.a.configure({sound:false,volume:.35}); f.a.unlock(); assert.equal(f.sounds.length,0);
  f.a.configure({sound:true,volume:0}); f.a.unlock(); assert.equal(f.sounds.length,0);
  f.a.configure({sound:true,volume:.35}); f.a.unlock(); f.settle();
  assert.equal(f.sounds.length,1); assert.equal(f.a.music.paused,false); assert.equal(f.a.music.volume,.35*.55); assert.equal(f.timers.size,0);
});
test('adjacent scenes share playback; new scenes reset one reusable player', () => {
  const f=fixture(); f.a.setMusicScene('setup'); f.a.unlock();
  f.a.music.currentTime=9; f.a.setMusicScene('intro'); assert.equal(f.a.music.currentTime,9);
  f.a.setMusicScene('mixing'); assert.equal(f.a.music.currentTime,0); assert.match(f.a.music.src,/electrodoodle/);
  f.a.music.currentTime=7; f.a.setMusicScene('flight'); assert.equal(f.a.music.currentTime,7);
  f.a.setMusicScene('running'); assert.match(f.a.music.src,/bit-quest/); assert.equal(f.a.music.loop,true); assert.equal(f.sounds.length,1);
});
test('mute and tab hiding pause music; return restores the same position and volume', () => {
  const f=fixture(); f.a.setMusicScene('running'); f.a.unlock(); f.settle(); f.a.music.currentTime=8;
  f.a.configure({sound:false,volume:.35}); assert.equal(f.a.music.paused,true); assert.equal(f.timers.size,0);
  f.a.configure({sound:true,volume:.35}); assert.equal(f.a.music.paused,false);
  f.document.hidden=true; f.a.syncMusic(); assert.equal(f.a.music.paused,true);
  f.document.hidden=false; f.a.syncMusic(); assert.equal(f.a.music.paused,false); assert.equal(f.a.music.currentTime,8);
  f.a.configure({sound:true,volume:0}); assert.equal(f.a.music.paused,true);
});
test('result cue is one-shot and does not restart on visibility or settings changes', () => {
  const f=fixture(); f.a.setMusicScene('finished'); f.a.unlock(); assert.equal(f.sounds.length,0);
  f.a.setMusicScene('result'); assert.equal(f.a.music.loop,false);
  f.a.music.paused=true; f.a.music.events.ended(); f.a.syncMusic(); assert.equal(f.a.music.paused,true);
  f.a.setMusicScene('setup'); assert.equal(f.a.musicFinished,false); assert.equal(f.a.music.loop,true);
});
test('every deployed track has matching recorded hash and visible attribution', () => {
  const crypto=require('node:crypto'), records=JSON.parse(fs.readFileSync('assets/music/licenses/manifest.json'));
  const credits=fs.readFileSync('music-credits.html','utf8');
  for(const r of records) { assert.equal(crypto.createHash('sha256').update(fs.readFileSync(r.deployed_file)).digest('hex'),r.deployed_sha256); assert(credits.includes(r.title)); assert(credits.includes(r.source)); assert(credits.includes(r.isrc)); }
  assert(credits.includes('https://creativecommons.org/licenses/by/4.0/'));
  assert(fs.readFileSync('index.html','utf8').includes('href="./music-credits.html"'));
});

test('Web Audio gain controls music on mobile and reuses one media source across tracks', () => {
  const f=fixture(); let sources=0;
  class Context {
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    createGain(){return {gain:{value:0,targets:[],setTargetAtTime(v){this.targets.push(v);}},connect(){}};}
    createMediaElementSource(){sources++; return {connect(){}};}
  }
  f.window.AudioContext=Context; f.a.setMusicScene('setup'); f.a.unlock();
  assert.equal(sources,1); assert.equal(f.a.music.volume,1);
  assert.equal(f.a.musicGain.gain.targets.at(-1),.35*.55);
  f.a.configure({sound:true,volume:.7}); assert.equal(f.a.musicGain.gain.targets.at(-1),.7*.55);
  f.a.setMusicScene('running'); assert.equal(sources,1);
  f.a.configure({sound:false,volume:.7}); assert.equal(f.a.music.paused,true);
});
