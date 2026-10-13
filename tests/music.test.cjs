'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
function fixture() {
  const sounds=[],timers=new Map();let next=0,clock=0;
  class Audio {
    constructor(src){this.src=src;this.paused=true;this.volume=0;this.currentTime=0;this.events={};sounds.push(this);}
    play(){this.paused=false;return {then:(ready,fail)=>{if(this.loading)this.ready=ready;else if(this.reject){this.paused=true;fail();}else ready();}};}
    pause(){this.paused=true;}
    addEventListener(name,cb){this.events[name]=cb;}
  }
  const document={hidden:false},window={Audio,performance:{now:()=>clock},setInterval(fn){timers.set(++next,fn);return next;},clearInterval(id){timers.delete(id);}};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),{window,document});
  return {a:new window.CosmicPinball.AudioEngine(),sounds,document,window,timers,
    advance(seconds){for(let i=0;i<Math.ceil(seconds*50);i++){clock+=20;for(const fn of [...timers.values()])fn();}},
    settle(){this.advance(2.2);}};
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('music waits for a positive-volume user gesture and reaches the configured level',()=>{
 const f=fixture();f.a.setMusicScene('intro');assert.equal(f.sounds.length,0);
 f.a.configure({sound:false,volume:.35});f.a.unlock();assert.equal(f.sounds.length,0);
 f.a.configure({sound:true,volume:0});f.a.unlock();assert.equal(f.sounds.length,0);
 f.a.configure({sound:true,volume:.35});f.a.unlock();f.settle();assert.equal(f.sounds.length,1);assert.equal(f.a.music.paused,false);near(f.a.music.volume,.35*.55);assert.equal(f.timers.size,0);
});
test('equal-power crossfade overlaps playback, preserves power and stops the old track after the fade',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();const old=f.a.music;old.currentTime=9;
 f.a.setMusicScene('mixing');const incoming=f.a.music;assert.notEqual(incoming,old);assert.equal(old.paused,false);assert.equal(old.currentTime,9);assert.equal(incoming.paused,false);near(incoming.volume,0);
 f.advance(.8);near(old.volume,Math.SQRT1_2*.35*.55);near(incoming.volume,old.volume);
 near([...f.a.musicDecks.values()].reduce((s,d)=>s+d.level*d.level,0),1);
 f.settle();assert.equal(old.paused,true);assert.equal(old.currentTime,0);near(incoming.volume,.35*.55);assert.equal(f.timers.size,0);
 incoming.currentTime=7;f.a.setMusicScene('flight');assert.equal(f.a.music,incoming);assert.equal(incoming.currentTime,7);
});
test('rapid scene changes and reversing a fade keep levels continuous and reuse at most four decks',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();f.a.setMusicScene('mixing');f.advance(.5);
 const before=[...f.a.musicDecks.values()].map(d=>d.level);f.a.setMusicScene('setup');
 [...f.a.musicDecks.values()].forEach((d,i)=>near(d.level,before[i]));f.settle();assert.match(f.a.music.src,/chipper/);assert.equal(f.a.music.paused,false);
 for(const scene of ['mixing','running','result','setup','mixing']){f.a.setMusicScene(scene);f.advance(.2);}
 f.settle();assert.equal(f.sounds.length,4);assert.equal(f.sounds.filter(s=>!s.paused).length,1);assert.match(f.a.music.src,/electrodoodle/);
});
test('buffering or blocked playback keeps the outgoing track audible until the incoming track is ready',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();const old=f.a.music;
 const next=f.a.musicDeck('electrodoodle');next.media.loading=true;f.a.setMusicScene('mixing');f.advance(3);
 assert.equal(old.paused,false);near(old.volume,.35*.55);near(next.media.volume,0);
 next.media.ready();f.advance(.8);assert(old.volume>0&&next.media.volume>0);f.settle();assert.equal(old.paused,true);
 const blocked=f.a.musicDeck('bit-quest');blocked.media.reject=true;f.a.setMusicScene('running');f.advance(3);assert.equal(next.media.paused,false);near(next.media.volume,.35*.55);
});
test('mute and hiding the tab pause both decks and freeze an in-progress fade',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();f.a.setMusicScene('mixing');f.advance(.6);
 const levels=[...f.a.musicDecks.values()].map(d=>d.level);f.a.configure({sound:false,volume:.35});assert(f.sounds.every(s=>s.paused));assert.equal(f.timers.size,0);f.advance(5);
 f.a.configure({sound:true,volume:.35});[...f.a.musicDecks.values()].forEach((d,i)=>near(d.level,levels[i]));
 f.document.hidden=true;f.a.syncMusic();assert(f.sounds.every(s=>s.paused));f.advance(5);f.document.hidden=false;f.a.syncMusic();f.settle();assert.equal(f.a.music.paused,false);
 f.a.configure({sound:true,volume:0});assert(f.sounds.every(s=>s.paused));assert.equal(f.timers.size,0);
});
test('race music continues until result reveal; unknown results fade to silence and result cue never restarts',()=>{
 const f=fixture();f.a.setMusicScene('running');f.a.unlock();f.settle();const race=f.a.music;
 f.a.setMusicScene('resultPending');assert.equal(f.a.music,race);assert.equal(race.paused,false);
 f.a.setMusicScene('result');assert.equal(f.a.music.loop,false);f.settle();f.a.music.paused=true;f.a.music.events.ended();f.a.syncMusic();assert.equal(f.a.music.paused,true);
 f.a.setMusicScene('running');f.settle();f.a.setMusicScene('finished');assert.equal(f.a.music.paused,false);f.settle();assert(f.sounds.every(s=>s.paused));
});
test('Web Audio gain supports mobile volume and keeps a single media source per cached track',()=>{
 const f=fixture();let sources=0;
 class Context {constructor(){this.state='running';this.currentTime=0;this.destination={};}createGain(){return {gain:{value:0,targets:[],setTargetAtTime(v){this.targets.push(v);}},connect(){}};}createMediaElementSource(){sources++;return {connect(){}};}}
 f.window.AudioContext=Context;f.a.setMusicScene('setup');f.a.unlock();f.settle();assert.equal(f.a.music.volume,1);near(f.a.musicGain.gain.targets.at(-1),.35*.55);
 f.a.configure({sound:true,volume:.7});near(f.a.musicGain.gain.targets.at(-1),.7*.55);
 f.a.setMusicScene('mixing');f.settle();f.a.setMusicScene('setup');f.settle();assert.equal(sources,2);
 f.a.configure({sound:false,volume:.7});assert(f.sounds.every(s=>s.paused));
});
test('deployed music retains recorded hashes, source links and visible attribution',()=>{
 const crypto=require('node:crypto'),records=JSON.parse(fs.readFileSync('assets/music/licenses/manifest.json')),credits=fs.readFileSync('music-credits.html','utf8');
 for(const r of records){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(r.deployed_file)).digest('hex'),r.deployed_sha256);assert(credits.includes(r.title));assert(credits.includes(r.source));assert(credits.includes(r.isrc));}
 assert(credits.includes('https://creativecommons.org/licenses/by/4.0/'));assert(fs.readFileSync('index.html','utf8').includes('href="./music-credits.html"'));
});

test('a slow incoming track is not canceled when an earlier fade finishes',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.advance(.5);
 const next=f.a.musicDeck('electrodoodle');next.media.loading=true;f.a.setMusicScene('mixing');f.advance(3);
 assert.equal(next.media.paused,false);assert.equal(f.sounds[0].paused,false);
 next.media.ready();f.settle();assert.equal(f.a.music.paused,false);assert.equal(f.sounds[0].paused,true);
});
