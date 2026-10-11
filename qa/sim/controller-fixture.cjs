'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../../tests/integration.test.cjs'),source=fs.readFileSync(file,'utf8'),boundary=source.indexOf("test('welcome");
if(boundary<0)throw new Error('controller fixture boundary changed');
module.exports=new Function('require','__dirname','process',source.slice(0,boundary).replace('process.env.INTEGRATION_REPO_ROOT ||', 'process.env.QA_SOURCE_ROOT || process.env.INTEGRATION_REPO_ROOT ||')+'\nreturn boot;')(require,path.dirname(file),process);
