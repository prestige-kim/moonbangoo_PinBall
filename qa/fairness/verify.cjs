'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const seen=new Set();let games=0;
for(const [phase,n,cases]of [['baseline',5000,4],['candidate-a',3000,4],['candidate-b',3000,4],['final',5000,4],['screen',3000,15],['duration',100,24]]){
 const base='qa/fairness/results/'+phase,summary=JSON.parse(fs.readFileSync(base+'.json')),bytes=zlib.gunzipSync(fs.readFileSync(base+'.json.gz')),raw=JSON.parse(bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),summary.sha256);assert.equal(raw.cases.length,cases);assert.equal(raw.seeds,n);
 for(const c of raw.cases){assert.equal(c.rows.length,n);assert.equal(new Set(c.rows.map(r=>r.seed)).size,n);for(const row of c.rows){const key=(phase.startsWith('candidate')?phase+'|':'')+row.seed;assert.ok(!seen.has(key),'seed reused '+key);seen.add(key);if(phase==='final'||phase==='screen')assert.ok(row.seed.startsWith('holdout-'));else assert.ok(row.seed.startsWith('dev-'));}games+=c.rows.length;}
}
console.log('Verified raw archives, sample counts, seed separation and SHA-256:',games,'games. Paired dev candidates intentionally share input seeds.');
