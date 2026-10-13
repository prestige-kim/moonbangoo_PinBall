'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const fixture=require('./fixtures/preserved-main-sources.json');
test('all non-map runtime modules preserve the pre-map main implementation byte for byte',()=>{
 for(const [file,sha] of Object.entries(fixture.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sha,file+' diverged from '+fixture.baseline);
});
