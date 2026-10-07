(function (P) {
  'use strict';
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  function visualRandom(seed) {
    let hash=2166136261;
    for(const letter of String(seed)+'|hand-visual-only'){hash^=letter.charCodeAt(0);hash=Math.imul(hash,16777619);}
    return ()=>{hash+=0x6d2b79f5;let n=Math.imul(hash^hash>>>15,1|hash);n^=n+Math.imul(n^n>>>7,61|n);return ((n^n>>>14)>>>0)/4294967296;};
  }
  // All distances are in units of the usable screen's short side. No race RNG
  // or race marble is mutated by this visual-only simulation.
  class HandShuffle {
    constructor(entries,seed) {
      this.radius=Math.min(.034,.125/Math.sqrt(Math.max(1,entries.length)));
      this.clusterRadius=.185;this.pointerRadius=.16;this.pointerCoreRadius=.035;
      this.bounds={left:-.46,right:.46,top:-.46,bottom:.46};
      this.bodies=[];this.collisions=0;this.wallHits=0;this.ticks=0;
      this.pointer=null;
      const random=visualRandom(seed);
      for(let i=0;i<entries.length;i++) {
        const entry=entries[i];let x=0,y=0,attempt=0;
        do {
          const angle=random()*Math.PI*2,distance=Math.sqrt(random())*(this.clusterRadius-this.radius);
          x=Math.cos(angle)*distance;y=Math.sin(angle)*distance;
          attempt++;
        }while(attempt<30000&&this.bodies.some(b=>Math.hypot(x-b.x,y-b.y)<this.radius*2.06));
        this.bodies.push({index:entry.index===undefined?i:entry.index,id:entry.id===undefined?String(i):entry.id,
          x,y,vx:0,vy:0,r:this.radius,spin:random()*Math.PI*2});
      }
      // Resolve the very rare crowded random-placement fallback with the same
      // collision constraints used during interaction, keeping IDs in order.
      for(let pass=0;pass<8;pass++)if(this.contacts(this.pairs())<.005)break;
    }
    begin(x,y,timeMs) {
      this.pointer={x,y,vx:0,vy:0,timeMs,age:0};
    }
    move(x,y,timeMs) { this.setPointer(x,y,timeMs); }
    setPointer(x,y,timeMs) {
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(timeMs))return;
      if(!this.pointer){this.begin(x,y,timeMs);return;}
      const p=this.pointer,seconds=(timeMs-p.timeMs)/1000;
      if(seconds<=0)return;
      let vx=(x-p.x)/seconds,vy=(y-p.y)/seconds;
      const speed=Math.hypot(vx,vy),limit=2.8;
      if(speed>limit){vx*=limit/speed;vy*=limit/speed;}
      Object.assign(p,{x,y,vx,vy,timeMs,age:0});
    }
    release() {this.pointer=null;}
    snapshot() {return this.bodies.map(b=>({...b}));}
    wall(b) {
      const limits=this.bounds,r=b.r;
      if(b.x<limits.left+r){b.x=limits.left+r;if(b.vx<0)b.vx*=-.52;b.vy*=.97;this.wallHits++;}
      if(b.x>limits.right-r){b.x=limits.right-r;if(b.vx>0)b.vx*=-.52;b.vy*=.97;this.wallHits++;}
      if(b.y<limits.top+r){b.y=limits.top+r;if(b.vy<0)b.vy*=-.52;b.vx*=.97;this.wallHits++;}
      if(b.y>limits.bottom-r){b.y=limits.bottom-r;if(b.vy>0)b.vy*=-.52;b.vx*=.97;this.wallHits++;}
    }
    pairs() {
      const cell=this.radius*2.15,grid=new Map(),pairs=[];
      for(let i=0;i<this.bodies.length;i++) {
        const b=this.bodies[i],gx=Math.floor(b.x/cell),gy=Math.floor(b.y/cell),key=(gy+4096)*8192+gx;
        if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
      }
      for(let i=0;i<this.bodies.length;i++) {
        const b=this.bodies[i],gx=Math.floor(b.x/cell),gy=Math.floor(b.y/cell);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) {
          const near=grid.get((gy+dy+4096)*8192+gx+dx);if(!near)continue;
          for(const j of near)if(j<i)pairs.push([this.bodies[j],b]);
        }
      }
      return pairs;
    }
    contacts(pairs) {
      let worst=0;
      for(const [a,b] of pairs) {
        let nx=b.x-a.x,ny=b.y-a.y;const diameter=a.r+b.r,d2=nx*nx+ny*ny;
        if(d2>=diameter*diameter)continue;
        const distance=Math.sqrt(d2);
        if(distance<1e-9){nx=1;ny=0;}else{nx/=distance;ny/=distance;}
        worst=Math.max(worst,(diameter-distance)/diameter);
        const correction=(diameter-distance)*.505;
        a.x-=nx*correction;a.y-=ny*correction;b.x+=nx*correction;b.y+=ny*correction;
        const approach=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(approach<0) {
          const impulse=-approach*.79;
          a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;
          // Small tangent friction dissipates sliding without locking a cluster.
          const tangent=((b.vx-a.vx)*-ny+(b.vy-a.vy)*nx)*.035;
          a.vx-=ny*tangent;a.vy+=nx*tangent;b.vx+=ny*tangent;b.vy-=nx*tangent;
          this.collisions++;
        }
      }
      for(const b of this.bodies)this.wall(b);
      return worst;
    }
    step(dt=1/120) {
      if(!Number.isFinite(dt)||dt<=0)return;
      // Adaptive substeps limit each body to a fraction of its collision radius.
      // The caller still advances this module with the shared fixed game clock.
      dt=Math.min(dt,1/30);
      let maximumSpeed=0;for(const b of this.bodies)maximumSpeed=Math.max(maximumSpeed,Math.hypot(b.vx,b.vy));
      const substeps=clamp(Math.ceil((maximumSpeed+.08)*dt/(this.radius*.40)),1,12),h=dt/substeps;
      for(let sub=0;sub<substeps;sub++) {
        const p=this.pointer;
        // Input velocity comes from event timestamps, and becomes stale when
        // the finger stops. Rendering more frames cannot manufacture momentum.
        const freshness=p?Math.exp(-Math.max(0,p.age-.025)*24):0;
        const damping=Math.exp(-h*(p?1.65:1.9));
        const handSpeed=p?Math.hypot(p.vx,p.vy)*freshness:0;
        const pressureActivity=clamp((handSpeed-.015)/.25,0,1);
        for(const b of this.bodies) {
          const distance=Math.hypot(b.x,b.y),returnStrength=p?.10:.65;
          let ax=-b.x*returnStrength,ay=.016-b.y*returnStrength;
          if(distance>.18){const extra=(distance-.18)*2.4/distance;ax-=b.x*extra;ay-=b.y*extra;}
          if(p) {
            const dx=p.x-b.x,dy=p.y-b.y,near=Math.hypot(dx,dy);
            if(near<this.pointerRadius) {
              const weight=Math.pow(1-near/this.pointerRadius,2);
              // A moving finger has a small soft core: local radial pressure
              // deflects contacts around its real path. A stationary finger
              // contributes none, and this never depends on a body ID or phase.
              const core=this.pointerCoreRadius+b.r;
              if(near<core&&near>1e-8&&pressureActivity>0) {
                const pressure=(core-near)*120*pressureActivity;
                ax-=dx/near*pressure;ay-=dy/near*pressure;
              }
              // Local velocity transfer and a modest hand attraction: all
              // rotation comes from the actual path, never ID-specific waves.
              ax+=weight*((p.vx*freshness-b.vx)*18+dx*7*freshness);
              ay+=weight*((p.vy*freshness-b.vy)*18+dy*7*freshness);
            }
          }
          b.vx=(b.vx+ax*h)*damping;b.vy=(b.vy+ay*h)*damping;
          const speed=Math.hypot(b.vx,b.vy);if(speed>3){b.vx*=3/speed;b.vy*=3/speed;}
          b.x+=b.vx*h;b.y+=b.vy*h;b.spin+=b.vx*h/b.r;this.wall(b);
        }
        let pairs=this.pairs();
        for(let pass=0;pass<8;pass++) {
          if(pass===3||pass===6)pairs=this.pairs();
          const worst=this.contacts(pairs);
          if(pass>=1&&worst<.012)break;
        }
        if(p)p.age+=h;
      }
      this.ticks++;
    }
  }
  P.HandShuffle=HandShuffle;
})(window.CosmicPinball=window.CosmicPinball||{});
