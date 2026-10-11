'use strict';
const fs=require('node:fs'),path=require('node:path'),{loadPhysics,root}=require('./adapter.cjs');
const P=loadPhysics();let now=0;
for(const file of ['cinematic','throw-gate','hand-scene'])new Function('window','document','performance',fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'))({CosmicPinball:P},{},{now:()=>now});
function capture(seed,count=6,groups=3,size=[1280,720],gesture='circle',skills=false){
 const groupNames=P.COLOR_GROUPS.slice(0,groups).map(g=>g.name),entries=Array.from({length:count},(_,i)=>({id:'marble-'+(i+1),name:groupNames[Math.min(groups-1,Math.floor(i*groups/count))],copy:Math.floor(i/groups)+1,copies:Math.ceil(count/groups)}));
 const p=new P.Physics({names:entries,seed,skills}),c=Object.create(P.Cinematic.prototype);Object.assign(c,{width:size[0],height:size[1],lastTime:0,lastStage:null,resize(){}});
 const s=new P.HandScene(c);s.gate=new P.ThrowGate();s.begin(p);now=0;
 for(let t=0;t<120;t++){now+=1000/120;s.update(1/120);}const rig=s.rigAt(s.elapsed,s.area()),start={x:rig.x+rig.length*(gesture==='keyboard'?.38:.4),y:rig.y,time:1000};s.beginTilt(start);s.releaseTilt(gesture==='keyboard'?{...start,x:start.x-rig.length*.38,y:start.y+rig.length}:{...start,x:rig.x+rig.length*.12,y:rig.y+rig.length*.45});
 for(let t=0;t<2400&&!s.ready;t++){now+=1000/120;s.update(1/120);}if(!s.ready)throw new Error('pour timeout '+seed);
 if(gesture==='circle'){s.shuffle.begin(0,0,now);for(let t=1;t<=240;t++){now+=1000/120;s.shuffle.move(.12*Math.cos(t/120*8),.12*Math.sin(t/120*8),now);s.update(1/120);}s.shuffle.release();}
 P.commitHandStart(p,s.shuffle.bodies);return p.handStart;
}
module.exports={capture};
