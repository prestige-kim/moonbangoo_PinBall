'use strict';
const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
test('R02 automatic keyboard launch is retired while existing panel keys remain',()=>{const main=fs.readFileSync('js/main.js','utf8'),ui=fs.readFileSync('js/ui.js','utf8');assert.ok(!main.includes('keyboardLaunchPending'));assert.ok(!main.includes("event.key !== 'Enter'"));assert.ok(ui.includes("event.key === 'Escape'"));assert.ok(ui.includes("event.key !== 'Tab'"));});
