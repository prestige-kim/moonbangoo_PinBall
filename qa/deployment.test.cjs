'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
test('favicon resolves under the Pages subpath',()=>{const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),m=html.match(/<link rel="icon" href="([^"]+)"/);assert.ok(m);assert.match(m[1],/^\.\//);assert.ok(fs.existsSync(path.resolve(__dirname,'..',m[1])));assert.equal(new URL(m[1],'https://prestige-kim.github.io/moonbangoo_PinBall/').pathname,'/moonbangoo_PinBall/assets/logo.svg');});
