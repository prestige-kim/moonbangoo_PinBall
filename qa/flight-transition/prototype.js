/* Standalone review prototype. Loaded only by docs/flight-transition/lab.html or QA.
   No production entrypoint imports this file; no physics or replay slots are edited. */
(function (global) {
  'use strict';
  const P=global.CosmicPinball,original={begin:P.HandFlight.prototype.begin,render:P.HandFlight.prototype.render,cameraAt:P.HandFlight.prototype.cameraAt,pose:P.HandFlight.prototype.pose};
  const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const point=(m,x,y)=>({x:m.a*x+m.e,y:m.d*y+m.f});
  const average=a=>({x:a.reduce((s,p)=>s+p.x,0)/a.length,y:a.reduce((s,p)=>s+p.y,0)/a.length});
  function begin(...args){
    original.begin.apply(this,args);
    // Use the actual landing viewport as the shared world from release onward.
    // No miniature offscreen board or follow/zoom chase is needed.
    // Retarget/resize correction stays original.
    this.initial=Object.assign({},this.final);
    this.propulsion=this.area.s*.045;
    for(const item of this.items)item.delay*=1/3;
    for(const item of this.items){const p=point(this.initial,item.marble.x,item.marble.y);item.targetX=p.x;item.targetY=p.y;item.endRadius=item.marble.r*this.initial.a;}
    this.targetCenter=average(this.items.map(i=>({x:i.targetX,y:i.targetY})));
    this.finalCenter=Object.assign({},this.targetCenter);
    return this;
  }
  const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+x*6));};
  const derivative=x=>x<=0||x>=1?0:30*x*x*(1-x)*(1-x);
  function pose(index,seconds){
    const i=this.items[index];if(!i)return null;
    const t=Math.max(0,Number(seconds)||0),p=clamp(t/this.duration);
    const radius=i.radius+(i.endRadius-i.radius)*smooth(p);
    if(p===1)return {id:i.id,index,x:i.targetX,y:i.targetY,vx:0,vy:0,radius:i.endRadius,focus:1,amount:1,depth:0};
    if(t<=i.delay)return {id:i.id,index,x:i.x+i.vx*t,y:i.y+i.vy*t,vx:i.vx,vy:i.vy,radius,focus:1,amount:p,depth:0};
    const duration=this.duration-i.delay,q=(t-i.delay)/duration,x=i.x+i.vx*i.delay,y=i.y+i.vy*i.delay;
    // A compact C2 inertia window preserves the captured velocity at release
    // without carrying its tangent across the whole 2.8-second transfer.
    const bound=(position,velocity,extent)=>velocity>0?extent-i.radius-position:velocity<0?position-i.radius:Infinity;
    const room=Math.max(0,Math.min(bound(x,i.vx,this.area.w),bound(y,i.vy,this.area.h)));
    const window=Math.max(.002,Math.min(.12,room/(Math.max(1,Math.abs(i.vx),Math.abs(i.vy))*duration)));
    const u=q/window,inertia=duration*q*(1-ease(u)),inertiaV=1-ease(u)-q/window*derivative(u);
    const bump=this.propulsion*64*q*q*q*Math.pow(1-q,3),bumpV=this.propulsion*192*q*q*Math.pow(1-q,2)*(1-2*q)/duration;
    return {id:i.id,index,x:x+(i.targetX-x)*ease(q)+i.vx*inertia+this.direction.x*bump,y:y+(i.targetY-y)*ease(q)+i.vy*inertia+this.direction.y*bump,
      vx:(i.targetX-x)*derivative(q)/duration+i.vx*inertiaV+this.direction.x*bumpV,vy:(i.targetY-y)*derivative(q)/duration+i.vy*inertiaV+this.direction.y*bumpV,radius,focus:1,amount:p,depth:0};
  }
  function cameraAt(progress) {
    const p=clamp(Number(progress)||0),adjust=this.correctionAt(p),scale=Math.exp(adjust.logScale);
    let scene={a:scale,b:0,c:0,d:scale,e:adjust.e,f:adjust.f};
    if(p===1)scene={a:this.landingFinal.a/this.initial.a,b:0,c:0,d:this.landingFinal.d/this.initial.d,e:this.landingFinal.e-this.initial.e*this.landingFinal.a/this.initial.a,f:this.landingFinal.f-this.initial.f*this.landingFinal.d/this.initial.d};
    const current={a:scene.a*this.initial.a,b:0,c:0,d:scene.d*this.initial.d,e:scene.a*this.initial.e+scene.e,f:scene.d*this.initial.f+scene.f};
    return {...scene,scene,initial:this.initial,current,final:this.landingFinal,bottom:this.bottom,amount:smooth(p),scale:scene.a};
  }
  function render(state){
    const c=this.cinema,r=c.renderer,camera=state.camera,physics=state.physics||this.physics;
    if(!r||!camera)return original.render.call(this,state);
    c.resize();const p=clamp(Number(state.progress)||0),ctx=c.ctx,w=c.width,h=c.height;
    this.retarget(camera,p);
    const samples=this.items.map((_,i)=>this.pose(i,p*this.duration)),view=this.cameraAt(p,samples),m=view.current;
    const framing=Object.create(camera),area=camera.area();
    framing.zoom=m.a;framing.x=(area.x+area.w/2-m.e)/m.a;framing.y=(area.y+area.h/2-m.f)/m.d;
    r.render({physics,map:physics.map,camera:framing,effects:state.effects,time:state.time||0,dt:0,status:'flight',hideMarbles:true});
    ctx.clearRect(0,0,w,h);
    if(p<1){
      // The real renderer paints the moving board, including live obstacle art.
      // A paper dissolve replaces the detached arch/miniature/cached board.
      ctx.drawImage(r.canvas,0,0,r.canvas.width,r.canvas.height,0,0,w,h);
      const paper=1-smooth((p-.04)/.48);
      if(paper>0&&r.background){ctx.save();ctx.globalAlpha=paper;ctx.drawImage(r.background,0,0,w,h);ctx.restore();}
    }
    ctx.save();ctx.transform(view.a,0,0,view.d,view.e,view.f);
    const reduced=state.reducedMotion===undefined?this.reduced:!!state.reducedMotion;
    this.lastPoses=this.items.map((item,i)=>{const pose=samples[i];c.drawOrb(item.entry,pose,smooth((p-.45)/.55),item.marble,this.items.length,reduced);const screen=point(view.scene,pose.x,pose.y);return {id:pose.id,index:i,x:screen.x,y:screen.y,radius:pose.radius*view.a,focus:1};});ctx.restore();
    this.reviewView=view;this.reviewPaper=1-smooth((p-.04)/.48);
    return {reveal:smooth((p-.55)/.45),cameraAmount:view.amount};
  }
  global.FlightPrototype={set(enabled){P.HandFlight.prototype.begin=enabled?begin:original.begin;P.HandFlight.prototype.render=enabled?render:original.render;P.HandFlight.prototype.cameraAt=enabled?cameraAt:original.cameraAt;P.HandFlight.prototype.pose=enabled?pose:original.pose;},original};
})(window);
