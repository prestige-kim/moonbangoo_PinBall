(function(global){
 'use strict';
 const a=global.CosmicPinball.app,P=global.CosmicPinball;
 const lab=global.FlightReview={pause:false,pending:[],variant:'baseline',args:null,state:null};
 const raf=global.requestAnimationFrame.bind(global);
 global.requestAnimationFrame=fn=>raf(t=>{if(lab.pause)lab.pending.push(fn);else fn(t);});
 a.handFlight.begin=function(...args){lab.args=args;return P.HandFlight.prototype.begin.apply(this,args);};
 a.handFlight.render=function(state){lab.state={...state};const result=P.HandFlight.prototype.render.call(this,state);if(lab.capture)lab.pause=true;return result;};
 lab.select=variant=>{lab.variant=variant;global.FlightPrototype.set(variant==='proposal');if(lab.args)P.HandFlight.prototype.begin.apply(a.handFlight,lab.args);};
 lab.seek=p=>{
  if(!lab.state)throw Error('먼저 셔플 후 공을 발사해 주세요.');
  const state={...lab.state,progress:p},r=a.renderer;
  r.render({physics:a.physics,map:a.physics.map,camera:a.camera,effects:a.effects,time:state.time,dt:0,status:'flight',hideMarbles:true});
  a.ui.setSceneProgress(P.HandFlight.prototype.render.call(a.handFlight,state));
  return a.handFlight.lastPoses;
 };
 lab.composite=()=>{const r=a.renderer,c=a.cinematic,out=document.createElement('canvas');out.width=c.width;out.height=c.height;const ctx=out.getContext('2d');ctx.drawImage(r.canvas,0,0,r.canvas.width,r.canvas.height,0,0,out.width,out.height);ctx.drawImage(c.canvas,0,0,c.canvas.width,c.canvas.height,0,0,out.width,out.height);return out;};
 lab.resume=()=>{lab.capture=false;lab.pause=false;const pending=lab.pending.splice(0);for(const fn of pending)raf(fn);};
})(window);
