'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
class Checkpoint{
 constructor(dir,definition,resume=false){this.dir=dir;this.file=path.join(dir,'manifest.json');if(fs.existsSync(dir)){if(!resume)throw new Error('Checkpoint exists: use --resume after a graceful pause');this.state=JSON.parse(fs.readFileSync(this.file));assert.deepEqual(this.state.definition,definition,'Checkpoint source/config/runtime changed');if(this.state.pending.length)throw new Error('Interrupted in-flight batches: refusing to reuse their seeds. Preserve this evidence; do not silently retry holdout.');}else{if(resume)throw new Error('No checkpoint to resume');fs.mkdirSync(dir,{recursive:true});this.state={definition,pending:[],completed:[],started:new Date().toISOString()};this.flush();}}
 flush(){fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.state));fs.renameSync(this.file+'.tmp',this.file);}
 begin(number){if(this.state.completed.includes(number)||this.state.pending.includes(number))throw new Error('Batch already started');this.state.pending.push(number);this.flush();}
 finish(number,result){if(!this.state.pending.includes(number))throw new Error('Batch was not started');const file=path.join(this.dir,number+'.json.gz');fs.writeFileSync(file+'.tmp',zlib.gzipSync(Buffer.from(JSON.stringify(result))));fs.renameSync(file+'.tmp',file);this.state.completed.push(number);this.state.pending=this.state.pending.filter(n=>n!==number);this.flush();}
 rows(){return this.state.completed.map(n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(this.dir,n+'.json.gz')))));}
}
module.exports={Checkpoint};
