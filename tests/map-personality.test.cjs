'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{P,run,assertRun,assertGaps}=require('../qa/four-maps/helpers.cjs');
test('each course has a distinct full background motif and palette',()=>{
 for(const id of ['twinfold','cascade','rhythm'])new Function('window',fs.readFileSync('js/maps/'+id+'-style.js','utf8'))({CosmicPinball:P});
 const styles=Object.values(P.MAP_STYLES);assert.equal(styles.length,4);assert.equal(new Set(styles.map(s=>s.motif)).size,4);assert.equal(new Set(styles.map(s=>s.board)).size,4);assert.equal(new Set(styles.map(s=>s.background.join())).size,4);
 const box={window:{CosmicPinball:P}};vm.runInNewContext(fs.readFileSync('js/renderer.js','utf8'),box);const r=Object.create(P.Renderer.prototype);r.sprites=new Map();r.buildBackground=function(){this.rebuilds=(this.rebuilds||0)+1;};
 for(const id of ['classic','twinfold','cascade','rhythm']){r.sprites.set('previous',{});r.setMap(id);assert.equal(r.mapStyle.id,id);assert.equal(r.sprites.size,0);const n=r.rebuilds;r.setMap(id);assert.equal(r.rebuilds,n);}assert.equal(r.rebuilds,4);
});
test('added collision events come from the actual terrain in all courses',()=>{
 for(const id of ['classic','twinfold','cascade','rhythm']){const r=run(id,50,'map-personality-interactions-'+id);assert(r.complete);assert(r.addedHits>0,id+' additions must be contacted');assert(r.hitObstacles>10,id+' should engage multiple obstacles');assert(P.MAPS[id].obstacles.filter(o=>o.id.includes('-detail-')||o.id.includes('-echo-')).length>=15);if(id!=='classic')assertRun(r);}
});
