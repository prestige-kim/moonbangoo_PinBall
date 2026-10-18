'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const fixture=require('./fixtures/preserved-main-sources.json');
test('protected runtime and audio assets preserve deployed bytes, with explicit reviewed paint and runtime revisions',()=>{
 for(const [file,sha] of Object.entries(fixture.sha256)){
  const runtime=fixture.intentionalRuntimeChanges?.[file];
  if(runtime)assert(runtime.reason && runtime.baseline && runtime.tests?.length && runtime.tests.every(file=>fs.existsSync(file)),file+' runtime revision requires reasons, baseline and replacement checks');
  const visual=runtime||fixture.intentionalVisualChanges?.[file];
  if(visual)assert(visual.reason && /^[a-f0-9]{64}$/.test(visual.sha256));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),visual?.sha256||sha,file+' diverged from '+fixture.baseline);
 }
});
