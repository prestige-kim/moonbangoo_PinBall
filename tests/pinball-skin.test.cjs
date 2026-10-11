const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(){
 const images=[];let created=0;
 function ctx(){return new Proxy({images:[],createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=2;y<14;y++)for(let x=2;x<14;x++)data[(y*w+x)*4+3]=255;return{data};},drawImage(...args){this.images.push(args);},measureText(){return {width:30};}}, {get:(o,k)=>k in o?o[k]:()=>{}});}
 function canvas(){created++;const c=ctx();return {width:1280,height:720,clientWidth:1280,clientHeight:720,getContext:()=>c,context:c};}
 class Image{constructor(){this.naturalWidth=16;this.naturalHeight=16;images.push(this);}set src(v){this.url=v;}}
 const box={window:{},document:{createElement:canvas,addEventListener(){}},Image,innerWidth:1280,innerHeight:720,devicePixelRatio:2,Math};vm.createContext(box);
 for(const f of ['themes','maps','physics','renderer','cinematic'])vm.runInContext(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8'),box);
 const P=box.window.CosmicPinball;return {P,images,canvas,created:()=>created};
}
test('tube, shuffle, flight blends and race draw the identical chrome sprite at the same pixel size',()=>{
 const {P,canvas}=boot(),c=canvas(),renderer=Object.assign(Object.create(P.Renderer.prototype),{ctx:c.context,sprites:new Map(),theme:P.THEMES.cosmic,currentZoom:1,dpr:2});
 const cinema=Object.assign(Object.create(P.Cinematic.prototype),{ctx:c.context,renderer,dpr:2,quality:'high',sprites:new Map()});
 const ball=Object.freeze({id:'same-ID',colorIndex:3,x:120,y:100,r:14,angle:1});
 renderer.drawMarble(ball,6,null,{top:0,bottom:200},0,0,false);const race=c.context.images.at(-1);
 for(const blend of [0,.5,1]){c.context.images.length=0;cinema.drawOrb({coat:4},{x:120,y:100,radius:14,focus:.4},blend,ball,6,false);assert.equal(c.context.images.length,1,'one shared image, no material crossfade');assert.equal(c.context.images[0][0],race[0]);assert.equal(c.context.images[0].at(-1),race.at(-1));}
});
test('500 IDs and theme changes reuse a bounded resolution pyramid rather than 500 image copies',()=>{
 const {P}=boot(),r=Object.assign(Object.create(P.Renderer.prototype),{sprites:new Map(),theme:P.THEMES.cosmic});assert(P.Pinball);
 const first=r.marbleSprite('red',90);for(let i=0;i<500;i++)assert.equal(r.marbleSprite('hsl('+i+',70%,50%)',90),first);
 for(const theme of Object.values(P.THEMES)){r.theme=theme;assert.equal(r.marbleSprite('blue',90),first);}
 const small=r.marbleSprite('red',30),large=r.marbleSprite('red',800);assert(small.width<first.width&&large.width>=800);assert(P.Pinball.cache.size<=5);
});
test('one async photo load replaces all cached fallbacks and normalizes the transparent bounds',()=>{
 const {P,images}=boot();assert(P.Pinball);P.Pinball.load();P.Pinball.load();assert.equal(images.length,1);
 const before=P.Pinball.sprite(128),revision=P.Pinball.revision;images[0].onload();const after=P.Pinball.sprite(128);
 assert.notEqual(before,after);assert.equal(P.Pinball.status,'photo');assert.equal(P.Pinball.revision,revision+1);assert.equal(P.Pinball.cache.size,1);
 const draw=after.context.images[0];assert.equal(draw[0],images[0]);assert.equal(draw[1],2);assert.equal(draw[2],2);assert.equal(draw[3],12);assert.equal(draw[4],12);
});
test('failed photo loading remains visible in the same neutral steel fallback',()=>{
 const {P,images}=boot();assert(P.Pinball);P.Pinball.load();const before=P.Pinball.sprite(64);images[0].onerror();assert.equal(P.Pinball.status,'fallback');assert.equal(P.Pinball.sprite(64),before);
});
test('a late photo redraws the static welcome once without advancing any marble',()=>{
 const {P,canvas,images}=boot(),renderer=new P.Renderer(canvas()),cinema=new P.Cinematic(canvas(),renderer),physics=new P.Physics({names:P.parseNames('핀볼*6'),seed:'SKIN-STATIC'});
 const state={stage:'intro',physics,time:0},before=JSON.stringify(physics.marbles);cinema.render(state);const draws=cinema.ctx.images.length;
 cinema.render({...state,time:1});assert.equal(cinema.ctx.images.length,draws);
 images[0].onload();cinema.render({...state,time:2});assert(cinema.ctx.images.length>draws,'photo readiness invalidates only the still-image cache');const refreshed=cinema.ctx.images.length;
 cinema.render({...state,time:3});assert.equal(cinema.ctx.images.length,refreshed);assert.equal(JSON.stringify(physics.marbles),before);assert.equal(physics.time,0);
});
test('name groups share colors and patterns without changing individual IDs or physics',()=>{
 const {P}=boot(),physics=new P.Physics({names:P.parseNames('명성*2,지연*3,중빈*4'),seed:'GROUPS'}),before=JSON.stringify(physics.marbles);
 P.Pinball.configureGroups(physics.marbles);
 const marks=physics.marbles.map(m=>P.Pinball.group(m.name));
 assert.equal(marks[0],marks[1]);assert.equal(marks[2],marks[4]);assert.equal(marks[5],marks[8]);
 assert.equal(new Set(marks.map(m=>m.color)).size,3);assert.equal(new Set(marks.map(m=>m.segments)).size,3);
 assert.equal(JSON.stringify(physics.marbles),before);assert.equal(new Set(physics.marbles.map(m=>m.id)).size,9);
 const expected=marks.map(m=>m.color).join();P.CINEMA.descriptors(physics);assert.equal(physics.marbles.map(m=>P.Pinball.group(m.name).color).join(),expected);
});
test('500 grouped balls keep one metal sprite pyramid and stable marks across themes',()=>{
 const {P}=boot(),physics=new P.Physics({names:P.parseNames('명성*200,지연*200,중빈*100'),seed:'GROUP-500'});
 P.Pinball.configureGroups(physics.marbles);const group=P.Pinball.group('명성'),sprite=P.Pinball.sprite(64);
 for(const theme of Object.values(P.THEMES)){for(const m of physics.marbles){assert.equal(P.Pinball.sprite(64),sprite);assert(P.Pinball.group(m.name));}assert.equal(P.Pinball.group('명성'),group);}
 assert.equal(P.Pinball.groups.size,3);assert.equal(P.Pinball.cache.size,1);
});
test('group identification ring stays identical across shuffle, flight and race',()=>{
 const {P,canvas}=boot(),c=canvas(),renderer=Object.assign(Object.create(P.Renderer.prototype),{ctx:c.context,sprites:new Map(),theme:P.THEMES.cosmic,currentZoom:1,dpr:2});
 const cinema=Object.assign(Object.create(P.Cinematic.prototype),{ctx:c.context,renderer,dpr:2});
 const balls=[{name:'명성'},{name:'지연'},{name:'중빈'}];P.Pinball.configureGroups(balls);
 const strokes=[];c.context.stroke=function(){strokes.push([this.strokeStyle,this.lineWidth]);};
 for(const item of balls){const b={...item,id:item.name,x:120,y:100,r:14};strokes.length=0;renderer.drawMarble(b,9,null,{top:0,bottom:200},0,0,false);const expected=JSON.stringify(strokes);assert(strokes.length>0);
 for(const blend of [0,.5,1]){strokes.length=0;cinema.drawOrb({name:b.name},{x:120,y:100,radius:14},blend,b,9,false);assert.equal(JSON.stringify(strokes),expected);}}
});
