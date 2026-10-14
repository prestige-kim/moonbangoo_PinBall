'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const fixture=require('./fixtures/preserved-main-sources.json');
test('protected runtime and audio assets preserve deployed bytes, with explicit map-background paint revisions',()=>{
 for(const [file,sha] of Object.entries(fixture.sha256)){
  const visual=fixture.intentionalVisualChanges?.[file];
  if(visual)assert(visual.reason && /^[a-f0-9]{64}$/.test(visual.sha256));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),visual?.sha256||sha,file+' diverged from '+fixture.baseline);
 }
});
