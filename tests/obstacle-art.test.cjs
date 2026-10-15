'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/renderer.js','utf8'),manifest=JSON.parse(fs.readFileSync('assets/obstacles/manifest.json'));
function load(ready=true){const urls=[],P={};class Image{constructor(){this.complete=ready;this.naturalWidth=2172;this.naturalHeight=724;}set src(v){urls.push(v);}}vm.runInNewContext(source,{window:{CosmicPinball:P},document:{currentScript:{src:'https://example.test/game/js/renderer.js?v=art'}},Image,URL});return {Renderer:P.Renderer,urls};}
test('generated material sprites are clipped to each real moving collider and use tight alpha bounds',()=>{
 const {Renderer}=load(),pose={x1:120,y1:300,x2:420,y2:380,thickness:12},before=JSON.stringify(pose);
 for(const asset of manifest.assets){const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true}),r=Object.assign(Object.create(Renderer.prototype),{ctx,mapStyle:{id:asset.id}});assert(r.obstacleMaterial(pose));const draw=calls.find(c=>c[0]==='drawImage');assert.deepEqual(draw.slice(2,6),asset.sourceRect);assert.equal(draw[draw.length-1],24);assert(calls.findIndex(c=>c[0]==='clip')<calls.findIndex(c=>c[0]==='drawImage'));assert(calls.some(c=>c[0]==='translate'&&c[1]===270&&c[2]===340));}
 assert.equal(JSON.stringify(pose),before);
});
test('art loading keeps Pages subdirectory URLs and caches one image per map',()=>{
 const {Renderer,urls}=load(),ctx=new Proxy({},{get:()=>()=>{},set:()=>true}),r=Object.assign(Object.create(Renderer.prototype),{ctx}),pose={x1:0,y1:0,x2:100,y2:0,thickness:8};
 for(const asset of manifest.assets){r.obstacleMaterial(pose,asset.id);r.obstacleMaterial(pose,asset.id);assert(urls.includes('https://example.test/game/assets/obstacles/'+asset.file));assert(fs.existsSync('assets/obstacles/'+asset.file));}assert.equal(urls.length,4);
});
test('pending image loads preserve the existing drawn obstacle fallback',()=>{
 const {Renderer}=load(false),r=Object.assign(Object.create(Renderer.prototype),{ctx:{drawImage(){assert.fail('pending image must not draw');}}});assert.equal(r.obstacleMaterial({x1:0,y1:0,x2:100,y2:0,thickness:8}),false);
});
