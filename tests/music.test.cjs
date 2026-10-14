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
function single(f){assert(f.sounds.filter(s=>!s.paused).length<=1,'only one background player may run');}
test('outgoing track stops before incoming playback and same-track scenes retain position',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();const old=f.a.music;old.currentTime=9;
 f.a.setMusicScene('mixing');assert.equal(f.a.music,old);f.advance(.08);assert(old.volume>0&&old.volume<.35*.55);single(f);
 f.advance(.12);assert(old.paused);const incoming=f.a.music;assert.notEqual(incoming,old);assert(!incoming.paused);assert.equal(old.currentTime,0);single(f);
 f.settle();near(incoming.volume,.35*.55);assert.equal(f.timers.size,0);
 incoming.currentTime=7;f.a.setMusicScene('flight');assert.equal(f.a.music,incoming);assert.equal(incoming.currentTime,7);
});
test('rapid changes and reversals never mix tracks or resurrect a stale player',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();
 for(const scene of ['mixing','running','result','setup','mixing','setup','result','running']){f.a.setMusicScene(scene);for(let i=0;i<7;i++){f.advance(.02);single(f);}}
 f.settle();single(f);assert.match(f.a.music.src,/bit-quest/);assert(f.sounds.length<=4);assert.equal(f.sounds.filter(s=>!s.paused).length,1);
});
test('buffering and denied playback leave silence rather than layering songs',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();const old=f.a.music;
 const next=f.a.musicDeck('electrodoodle');next.media.loading=true;f.a.setMusicScene('mixing');f.advance(3);
 assert(old.paused);near(old.volume,0);near(next.media.volume,0);single(f);next.media.ready();f.settle();assert(!next.media.paused);single(f);
 const blocked=f.a.musicDeck('bit-quest');blocked.media.reject=true;f.a.setMusicScene('running');f.advance(3);assert(f.sounds.every(s=>s.paused));blocked.media.reject=false;f.a.unlock();f.settle();assert(!blocked.media.paused);single(f);
});
test('mute and hidden tabs freeze fades and resume only the current player',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.advance(.12);const level=f.a.activeDeck.level;
 f.a.configure({sound:false,volume:.35});assert(f.sounds.every(s=>s.paused));assert.equal(f.timers.size,0);f.advance(5);
 f.a.configure({sound:true,volume:.35});near(f.a.activeDeck.level,level);single(f);
 f.document.hidden=true;f.a.syncMusic();assert(f.sounds.every(s=>s.paused));f.advance(5);f.document.hidden=false;f.a.syncMusic();f.settle();assert(!f.a.music.paused);single(f);
 f.a.configure({sound:true,volume:0});assert(f.sounds.every(s=>s.paused));assert.equal(f.timers.size,0);
});
test('scene changes while muted resume the latest song instead of the previous one',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();f.a.configure({sound:false,volume:.35});f.a.setMusicScene('mixing');f.a.setMusicScene('running');f.a.configure({sound:true,volume:.35});f.settle();single(f);assert.match(f.a.music.src,/bit-quest/);
});
test('result music starts on reveal, plays once, and unknown results fade to silence',()=>{
 const f=fixture();f.a.setMusicScene('running');f.a.unlock();f.settle();const race=f.a.music;
 f.a.setMusicScene('resultPending');assert.equal(f.a.music,race);f.a.setMusicScene('result');f.settle();assert(race.paused);assert.equal(f.a.music.loop,false);single(f);
 f.a.music.paused=true;f.a.music.events.ended();f.a.syncMusic();assert(f.a.music.paused);
 f.a.setMusicScene('running');f.settle();f.a.setMusicScene('finished');f.settle();assert(f.sounds.every(s=>s.paused));
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

test('a stale slow play promise cannot restore an old scene after a newer scene starts',()=>{
 const f=fixture();f.a.setMusicScene('setup');f.a.unlock();f.settle();const slow=f.a.musicDeck('electrodoodle');slow.media.loading=true;f.a.setMusicScene('mixing');f.advance(.3);const stale=slow.media.ready;
 f.a.setMusicScene('running');f.settle();stale();single(f);assert(slow.media.paused);assert.match(f.a.music.src,/bit-quest/);assert(!f.a.music.paused);
});
test('dense impacts share a cooldown, finish cue plays once, and extra melodies are suppressed',()=>{
 const f=fixture(),a=f.a,calls=[];a.context={currentTime:0,state:'running'};a.tone=(...args)=>calls.push(args);a.setMusicScene('running');
 for(let i=0;i<100;i++){a.context.currentTime=i/100;a.play(i%2?'hit':'bumper',1);}assert(calls.length<=4);assert(calls.every(c=>c[1]<=.10&&c[2]<=.04));
 calls.length=0;for(let i=0;i<50;i++){a.play('finish',1);a.play('lead',1);a.play('win',1);}assert.equal(calls.length,1);a.setMusicScene('mixing');a.setMusicScene('running');a.play('finish');assert.equal(calls.length,2);
});
