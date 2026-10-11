(function(P){
  'use strict';
  // A seed now replays the race only together with this captured hand layout.
  // Project individual positions into the obstacle-free spawn area; never
  // restore seeded lanes or consume the race random stream during handoff.
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  P.commitHandStart=function(physics,bodies){
    if(physics.handStart)return physics.handStart;
    if(physics.time!==0||physics.ticks!==0)throw new Error('경기 시작 후 출발 위치를 변경할 수 없습니다.');
    if(!Array.isArray(bodies)||bodies.length!==physics.marbles.length)throw new Error('셔플 핀볼 개수가 일치하지 않습니다.');
    const byID=new Map();
    for(const body of bodies){
      if(byID.has(body.id)||body.pouring||![body.x,body.y,body.vx,body.vy,body.r].every(Number.isFinite)||body.r<=0)throw new Error('셔플 핀볼 ID 또는 좌표가 올바르지 않습니다.');
      byID.set(body.id,body);
    }
    const source=physics.marbles.map(m=>{const b=byID.get(m.id);if(!b)throw new Error('셔플 핀볼 ID가 경기와 다릅니다.');return {id:b.id,x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r};});
    const spawn=physics.map.spawn,r=Math.max(...physics.marbles.map(m=>m.r));
    const left=spawn.x+r,right=spawn.x+spawn.width-r,top=spawn.y+r,bottom=spawn.y+spawn.height-r;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,preferred=0;
    source.forEach((b,i)=>{minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x);minY=Math.min(minY,b.y);maxY=Math.max(maxY,b.y);preferred=Math.max(preferred,physics.marbles[i].r/b.r);});
    preferred*=1.04;
    const sx=Math.min(preferred,(right-left)/Math.max(1e-8,maxX-minX)),sy=Math.min(preferred,(bottom-top)/Math.max(1e-8,maxY-minY));
    const mx=(minX+maxX)/2,my=(minY+maxY)/2,hw=(maxX-minX)*sx/2,hh=(maxY-minY)*sy/2;
    const cx=clamp((left+right)/2+mx*preferred,left+hw,right-hw),cy=clamp((top+bottom)/2+my*preferred,top+hh,bottom-hh);
    const placed=source.map((b,i)=>({id:b.id,index:i,x:cx+(b.x-mx)*sx,y:cy+(b.y-my)*sy,r:physics.marbles[i].r,vx:0,vy:0}));
    // Aspect fitting can compress a dense cluster. Resolve only those contacts
    // with the existing spatial hash/constraints before flying to the endpoints.
    const solver=Object.create(P.HandShuffle.prototype);
    Object.assign(solver,{bodies:placed,radius:r,bounds:{left:spawn.x,right:spawn.x+spawn.width,top:spawn.y,bottom:spawn.y+spawn.height},collisions:0,wallHits:0});
    let correctionPasses=0;
    for(;correctionPasses<60;correctionPasses++){const worst=solver.contacts(solver.pairs());if(worst<.003)break;}
    let denseFit=false,remainingOverlap=0;
    for(const [a,b] of solver.pairs())remainingOverlap=Math.max(remainingOverlap,(a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y))/(a.r+b.r));
    if(remainingOverlap>.01){
      denseFit=true;
      const desired=source.map(b=>({x:cx+(b.x-mx)*sx,y:cy+(b.y-my)*sy}));
      const spacing=2*r+1.5,rowStep=spacing*Math.sqrt(3)/2,slots=[];
      for(let row=0;top+row*rowStep<=bottom;row++)for(let x=left+(row%2?spacing/2:0);x<=right;x+=spacing)slots.push({x,y:top+row*rowStep});
      if(slots.length<placed.length)throw new Error('출발 구역에 모든 핀볼을 배치할 공간이 부족합니다.');
      const ordered=placed.map((p,i)=>i).sort((a,b)=>desired[a].y-desired[b].y||desired[a].x-desired[b].x||a-b);
      for(const i of ordered){let best=0,distance=Infinity;for(let j=0;j<slots.length;j++){const q=slots[j],d=(q.x-desired[i].x)**2+(q.y-desired[i].y)**2;if(d<distance){best=j;distance=d;}}Object.assign(placed[i],slots[best]);slots.splice(best,1);}
      // Safe packing is only a starting scaffold. Slide each ID back toward its
      // captured position along collision-free segments; no seeded slot owners.
      for(let pass=0;pass<8;pass++)for(const i of pass%2?ordered.slice().reverse():ordered){
        const p=placed[i],dx=desired[i].x-p.x,dy=desired[i].y-p.y,a=dx*dx+dy*dy;if(a<1e-12)continue;let t=1;
        for(let j=0;j<placed.length;j++){if(j===i)continue;const q=placed[j],ox=p.x-q.x,oy=p.y-q.y,diameter=p.r+q.r+.02,b=2*(ox*dx+oy*dy),c=ox*ox+oy*oy-diameter*diameter;
          if(c<=0){if(b<0)t=0;continue;}const disc=b*b-4*a*c;if(disc<0||b>=0)continue;const hit=(-b-Math.sqrt(disc))/(2*a);if(hit>=0&&hit<t)t=Math.max(0,hit-1e-8);
        }p.x+=dx*t;p.y+=dy*t;
      }
    }
    const starts=placed.map((p,i)=>{
      let vx=source[i].vx*sx,vy=source[i].vy*sy;const speed=Math.hypot(vx,vy);if(speed>120){vx*=120/speed;vy*=120/speed;}
      return {id:p.id,x:p.x,y:p.y,vx,vy};
    });
    starts.forEach((p,i)=>Object.assign(physics.marbles[i],{x:p.x,y:p.y,vx:p.vx,vy:p.vy,_anchorY:p.y,_stuckAt:0,_rescues:0}));
    physics.handStart={version:1,seed:physics.seed,source,starts,transform:{sx,sy,cx,cy,mx,my},correctionPasses,denseFit};
    return physics.handStart;
  };
})(window.CosmicPinball=window.CosmicPinball||{});
