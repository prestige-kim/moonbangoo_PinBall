'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{loadPhysics}=require('../qa/sim/adapter.cjs');
const P=loadPhysics(),wind=P.MAPS.twinfold.obstacles.find(o=>o.type==='wind'&&o.y===10760);
function isolated(){const map={...P.MAPS.twinfold,obstacles:[wind]};return new P.Physics({map,names:P.parseNames('공*2'),seed:'visible-wind'});}
function place(m,x=420){Object.assign(m,{x,y:10600,vx:0,vy:200});}
test('wind gusts every 2 seconds, pauses between gusts and spreads falling balls to both sides',()=>{
 const p=isolated();for(const t of [0,.1,2,2.1,4])assert(P.windPulse(wind,t).active);for(const t of [.4,1,1.99,2.4,3])assert(!P.windPulse(wind,t).active);
 const [a,b]=p.marbles;place(a);place(b,580);p.time=1;p._fieldsStep(a);assert.equal(a.vy,200);p.time=2.1;p._fieldsStep(a);p._fieldsStep(b);
 assert(a.vy<0&&b.vy<0);assert(a.vx<0&&b.vx>0);assert.equal(p.drainEvents().filter(e=>e.type==='wind').length,2);
 a.vy=100;p._fieldsStep(a);assert.equal(a.vy,100,'one impulse per pulse');
 place(a);p.time=4.1;p._fieldsStep(a);assert.equal(a.vy,200,'give a lifted marble time to leave');
 const fresh=isolated().marbles[0];place(fresh);p._fieldsStep(fresh);assert(fresh.vy<0,'a later gust lifts a different marble');
});
test('a gust produces real upward motion, lateral spread, then gravity brings marbles to the finish',()=>{
 const p=isolated();p.ticks=240;p.time=2;place(p.marbles[0]);place(p.marbles[1],580);let peak=10600,lifted=false;while(!p.complete&&p.time<15){p.step();peak=Math.min(peak,p.marbles[0].y);if(p.marbles[0].vy<0)lifted=true;p.drainEvents();}
 assert(lifted);assert(peak<10460,'visible upward arc');assert(p.complete);assert.equal(p.finished.length,2);assert(Math.abs(p.marbles[0].x-420)>60);
});
test('wind rendering shows upward streams, a vent and distinct gust/idle states using the physics clock',()=>{
 new Function('window',fs.readFileSync('js/renderer.js','utf8'))({CosmicPinball:P});let curves=0,labels=[];
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),bezierCurveTo(){curves++;},fillText(t){labels.push(t);}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const r=Object.assign(Object.create(P.Renderer.prototype),{ctx,reducedMotion:false});r.drawWind(wind,{time:2.1});const active=curves;assert(labels.includes('상승 바람 ↑'));curves=0;r.drawWind(wind,{time:3});assert(curves<active);assert(labels.includes('바람길'));
});
