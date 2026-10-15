'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function setup(map,count,w,h,reduced=false){
 const scope={window:{},document:{},Math};vm.createContext(scope);
 for(const name of ['maps','map-registry','maps/twinfold','maps/cascade','maps/rhythm','physics','cinematic','hand-flight'])vm.runInContext(fs.readFileSync(name==='hand-flight'?'qa/flight-transition/baseline-hand-flight.js':'js/'+name+'.js','utf8'),scope);
 const P=scope.window.CosmicPinball,original=P.HandFlight.prototype.begin;
 vm.runInContext(fs.readFileSync('qa/flight-transition/prototype.js','utf8'),scope);scope.window.FlightPrototype.set(true);
 const options={names:P.parseNames('참가자*'+count),map:P.MAPS[map],seed:'flight-prototype-test',radius:12,gravity:620,restitution:.72},physics=new P.Physics(options),twin=new P.Physics(options);
 const area={x:w/2,y:h/2,s:Math.min(w-32,h-48),w,h},camera={zoom:Math.min((w-60)/1100,.75),worldToScreen(x,y){return {x:w/2+(x-500)*this.zoom,y:h*.4+(y-350)*this.zoom};}};
 const entries=P.CINEMA.descriptors(physics),hand={camera,entries,area:()=>area,shuffle:{bodies:entries.map((e,i)=>({id:e.id,x:.08+Math.cos(i)*.07,y:-.1+Math.sin(i)*.05,vx:.3,vy:-.1,r:.018}))}};
 const flight=new P.HandFlight({camera});flight.begin(physics,hand,{dx:1,dy:-.2,inputSpeed:1},2.8,reduced);return {scope,P,original,physics,twin,flight,hand,area};
}
const near=(a,b,t=1e-6)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
test('separate proposal preserves release continuity, exact own slots, physics and RNG for all four maps and supported counts',()=>{
 for(const map of ['classic','twinfold','cascade','rhythm'])for(const count of [6,25,49,50])for(const [w,h] of [[1280,800],[390,844],[844,390]])for(const reduced of [false,true]){
  const s=setup(map,count,w,h,reduced),before=JSON.stringify(s.physics.marbles),f=s.flight;
  for(let j=0;j<count;j++){
   const a=f.pose(j,0),b=f.pose(j,1e-6),body=s.hand.shuffle.bodies[j];near(a.x,s.area.x+body.x*s.area.s);near(a.y,s.area.y+body.y*s.area.s);near((b.x-a.x)/1e-6,body.vx*s.area.s,.01);near((b.y-a.y)/1e-6,body.vy*s.area.s,.01);
   const end=f.pose(j,f.duration),view=f.cameraAt(1),m=s.physics.marbles[j];near(view.a*end.x+view.e,view.final.a*m.x+view.final.e);near(view.d*end.y+view.f,view.final.d*m.y+view.final.f);near(end.vx,0);near(end.vy,0);assert.equal(end.id,m.id);
  }
  assert.equal(JSON.stringify(s.physics.marbles),before);assert.equal(s.physics.time,0);assert.equal(s.physics.ticks,0);for(let j=0;j<5;j++)assert.equal(s.physics.random(),s.twin.random());
 }
});
test('proposal keeps the board fixed and carries viewport corrections continuously to the exact new landing',()=>{
 const s=setup('rhythm',50,1280,800),f=s.flight,first=f.cameraAt(0);
 for(const p of [.1,.3,.5,.9]){const v=f.cameraAt(p);for(const k of ['a','d','e','f'])near(v.current[k],first.current[k]);}
 const p=.4,before=f.cameraAt(p),camera={zoom:.31,worldToScreen(x,y){return {x:195+(x-500)*this.zoom,y:410+(y-570)*this.zoom};}};assert(f.retarget(camera,p));const after=f.cameraAt(p);for(const k of ['a','d','e','f'])near(after[k],before[k]);const end=f.cameraAt(1),o=camera.worldToScreen(0,0);near(end.current.a,.31);near(end.current.e,o.x);near(end.current.f,o.y);
});
test('proposal can restore original flight methods and is absent from the production entrypoint',()=>{
 const s=setup('classic',6,1280,800);s.scope.window.FlightPrototype.set(false);assert.equal(s.P.HandFlight.prototype.begin,s.original);assert(!fs.readFileSync('index.html','utf8').includes('flight-transition'));assert(!fs.readFileSync('js/main.js','utf8').includes('FlightPrototype'));
});
