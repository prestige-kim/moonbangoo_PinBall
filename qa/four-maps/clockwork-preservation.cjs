'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),{P}=require('./helpers.cjs');
const baseline='ed65d96aabeb5c531d1ca8e9f3a1ae6a099a20b9';
for(const id of ['twinfold','cascade','rhythm'])new Function('window',fs.readFileSync('js/maps/'+id+'-style.js','utf8'))({CosmicPinball:P});
new Function('window',fs.readFileSync('js/themes.js','utf8'))({CosmicPinball:P});
new Function('window',cp.execFileSync('git',['show',baseline+':js/renderer.js'],{encoding:'utf8'}))({CosmicPinball:P});const Before=P.Renderer;
new Function('window',fs.readFileSync('js/renderer.js','utf8'))({CosmicPinball:P});const After=P.Renderer,rows=[];
function trace(Renderer,map,time,reduced,pattern){const calls=[],ctx=new Proxy({},{get:(_,key)=>key==='createLinearGradient'||key==='createRadialGradient'?(...args)=>{calls.push([key,...args]);return {kind:key,addColorStop(...a){calls.push(['colorStop',...a]);}};}:(...args)=>calls.push([key,...args]),set:(_,key,value)=>(calls.push(['set',key,value&&value.kind?value.kind:value]),true)}),p=new P.Physics({map,names:P.parseNames('공')});p.time=time;
 const r=Object.assign(Object.create(Renderer.prototype),{ctx,theme:P.THEMES.cosmic,mapStyle:P.MAP_STYLES[map.id],quality:'high',reducedMotion:reduced,currentZoom:1,dpr:1,pinSprite:()=> 'unchanged-pin-sprite'}),before=JSON.stringify(p.marbles);
 if(pattern!==null)r.mapPattern(ctx,1000,520,pattern);else for(const o of map.obstacles)r.drawObstacle(o,p,null,time,{top:0,bottom:12000});assert.equal(JSON.stringify(p.marbles),before);return calls;}
for(const id of ['classic','twinfold','cascade']){
 for(const time of [0,.2,1.2,3.6])for(const reduced of [false,true]){assert.deepEqual(trace(After,P.MAPS[id],time,reduced,null),trace(Before,P.MAPS[id],time,reduced,null),id+' render changed');rows.push({id,time,reduced,equal:true});}
 for(const board of [false,true]){assert.deepEqual(trace(After,P.MAPS[id],0,false,board),trace(Before,P.MAPS[id],0,false,board));rows.push({id,board,equal:true});}
}
const out='docs/four-maps/rhythm-clockwork';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/render-preservation.json',JSON.stringify({baseline,cases:rows.length,failures:0,rows},null,2));console.log('Other-map obstacle and background render traces: '+rows.length+' / '+rows.length+' identical');
