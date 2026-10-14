'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{loadPhysics}=require('../qa/sim/adapter.cjs');
const P=loadPhysics(),wind=P.MAPS.twinfold.obstacles.find(o=>o.type==='wind'&&o.y===10760);
function isolated(){const map={...P.MAPS.twinfold,obstacles:[wind]};return new P.Physics({map,names:P.parseNames('공*2'),seed:'visible-wind'});}
function place(m,x=420){Object.assign(m,{x,y:10600,vx:0,vy:200});}
test('wind gusts every 3.5 seconds, pauses between gusts and spreads falling balls to both sides',()=>{
 const p=isolated();for(const t of [0,.1,3.5,3.6,7])assert(P.windPulse(wind,t).active);for(const t of [.4,1,3.49,3.9,6.9])assert(!P.windPulse(wind,t).active);
 const [a,b]=p.marbles;place(a);place(b,580);p.time=1;p._fieldsStep(a);assert.equal(a.vy,200);p.time=3.6;p._fieldsStep(a);p._fieldsStep(b);
 assert(a.vy<0&&b.vy<0);assert(a.vx<0&&b.vx>0);assert.equal(p.drainEvents().filter(e=>e.type==='wind').length,2);
 a.vy=100;p._fieldsStep(a);assert.equal(a.vy,100,'one impulse per pulse');
 place(a);p.time=3.75;p._fieldsStep(a);assert.equal(a.vy,200,'give a lifted marble time to leave');
 const fresh=isolated().marbles[0];place(fresh);p._fieldsStep(fresh);assert(fresh.vy<0,'a later gust lifts a different marble');
});
test('a gust produces real upward motion, lateral spread, then gravity brings marbles to the finish',()=>{
 const p=isolated();p.ticks=420;p.time=3.5;place(p.marbles[0]);place(p.marbles[1],580);let peak=10600,lifted=false;while(!p.complete&&p.time<15){p.step();peak=Math.min(peak,p.marbles[0].y);if(p.marbles[0].vy<0)lifted=true;p.drainEvents();}
 assert(lifted);assert(peak<10460,'visible upward arc');assert(p.complete);assert.equal(p.finished.length,2);assert(Math.abs(p.marbles[0].x-420)>60);
});
test('wind rendering shows upward streams, a vent and distinct gust/idle states using the physics clock',()=>{
 new Function('window',fs.readFileSync('js/renderer.js','utf8'))({CosmicPinball:P});let curves=0,labels=[];
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),bezierCurveTo(){curves++;},fillText(t){labels.push(t);}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const r=Object.assign(Object.create(P.Renderer.prototype),{ctx,reducedMotion:false});r.drawWind(wind,{time:3.6});const active=curves;assert(labels.includes('상승 바람 ↑'));curves=0;r.drawWind(wind,{time:4.5});assert(curves<active);assert(labels.includes('바람길'));
});

test('drawn wind packets change geometry between frames, dissipate, and respect reduced motion',()=>{
 new Function('window',fs.readFileSync('js/renderer.js','utf8'))({CosmicPinball:P});
 function trace(time,reducedMotion){const commands=[];const ctx=new Proxy({},{get:(o,k)=>(...v)=>{if(['moveTo','bezierCurveTo','quadraticCurveTo','translate','scale','rotate'].includes(k))commands.push([k,...v]);},set:()=>true});const r=Object.assign(Object.create(P.Renderer.prototype),{ctx,reducedMotion,quality:'high'});r.drawWindGust(wind,time);return commands;}
 assert.notDeepEqual(trace(.18,false),trace(.32,false),'clouds must evolve rather than display a single image');
 assert.equal(trace(.9,false).length,0,'clouds dissipate during the interval');
 assert.deepEqual(trace(.18,true),trace(.32,true),'reduced motion keeps cloud geometry still');
});
