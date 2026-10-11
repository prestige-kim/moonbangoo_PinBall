'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process');
for(const dir of ['qa','qa/sim','qa/browser'])for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.cjs')))cp.execFileSync(process.execPath,['--check',path.join(dir,file)]);
const raw=zlib.gunzipSync(fs.readFileSync('qa/results/simulation.json.gz')),summary=JSON.parse(fs.readFileSync('qa/results/simulation-summary.json'));
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),summary.sha256Uncompressed);
const result=JSON.parse(raw);assert.equal(result.configs.length,64);
for(const cell of result.configs){assert.equal(cell.rows.length,300);assert.equal(new Set(cell.rows.map(r=>r.seed)).size,300);assert.equal(cell.rows.filter(r=>!r.complete).length,0);assert.equal(cell.rows.filter(r=>Object.values(r.errors).some(Boolean)).length,0);}
const html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:\?[^"#]*)?"/g))assert.ok(fs.existsSync(m[1]),m[1]);
for(const file of ['js/main.js','js/ui.js','js/hand-start.js']){const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,12);assert.ok(html.includes(file+'?v=release-'+hash),file+' cache hash');}
const doc=fs.readFileSync('docs/release-check/REPORT.md','utf8');assert.ok(doc.startsWith('# 배포 판정: 배포 불가'));assert.equal(/[\u3040-\u30FF]/.test(doc),false);
for(const m of doc.matchAll(/\]\((\.\.\/[^)]+)\)/g))assert.ok(fs.existsSync(path.resolve('docs/release-check',m[1])),m[1]);
const smoke=JSON.parse(fs.readFileSync('qa/results/controller-smoke.json'));assert.equal(smoke.runs.length,5);assert.ok(smoke.runs.every(r=>r.equal&&r.complete));
console.log('Verified: QA syntax; 64 x 300 complete unique seeds; zero recorded invariant failures; archive SHA-256; relative assets; content cache hashes; report evidence links; controller helper smoke 5/5.');
