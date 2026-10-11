'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function lum(h){const v=h.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
test('default small helper and setting labels meet 4.5:1 against paper and panel',()=>{const css=fs.readFileSync(__dirname+'/../style.css','utf8'),root=css.match(/:root\{color-scheme:light;([^}]+)/)[1];for(const role of ['muted','subtle']){const fg=root.match(new RegExp('--'+role+':(#[a-f0-9]{6})','i'))[1];for(const bg of ['#F4EDE0','#FBF7EF']){const a=lum(fg),b=lum(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,role+' '+fg+' on '+bg);}}});
