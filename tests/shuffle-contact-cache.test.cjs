const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={window:{},Math};vm.createContext(box);vm.runInContext(fs.readFileSync(__dirname+'/../js/shuffle.js','utf8'),box);const P=box.window.CosmicPinball;
test('cached spatial neighbors match an independent exhaustive candidate/order oracle',()=>{
 for(const n of [6,50,200,500]){
  const c=new P.HandShuffle(Array.from({length:n},(_,i)=>({id:'m'+i,index:i})),'CONTACT-CACHE-'+n),size=c.radius*2.15;
  for(const crowded of [false,true])for(const suspended of [false,true]){
   if(crowded)c.bodies.forEach((b,i)=>{b.x=(i%31-15)*size*.98;b.y=(Math.floor(i/31)-8)*size*1.01;});
   c.bodies.forEach((b,i)=>{b.pouring=suspended&&i%3===0;});
   const expected=[];
   for(let i=0;i<n;i++){
    const b=c.bodies[i];if(b.pouring)continue;const gx=Math.floor(b.x/size),gy=Math.floor(b.y/size),near=[];
    for(let j=0;j<i;j++){const a=c.bodies[j];if(a.pouring)continue;const dx=Math.floor(a.x/size)-gx,dy=Math.floor(a.y/size)-gy;if(Math.abs(dx)<=1&&Math.abs(dy)<=1)near.push({j,dx,dy});}
    near.sort((a,b)=>a.dx-b.dx||a.dy-b.dy||a.j-b.j);for(const a of near)expected.push([c.bodies[a.j].id,b.id]);
   }
   const actual=Array.from(c.pairs(),pair=>Array.from(pair,b=>b.id));assert.deepEqual(actual,expected);assert.equal(new Set(actual.map(p=>p.join(','))).size,actual.length);
  }
 }
});
