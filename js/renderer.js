(function (P) {
  'use strict';
  const TAU = Math.PI * 2;
  const INK = '#4a3a28', PAPER = '#f4ede0', PAPER_HI = '#fbf7ef';
  const METALS = {
    ivory: ['#b59a70','#d9c7a4','#f8efdc','#cfb98f','#efe1c4','#b99b6c','#dfcea9'],
    gold: ['#7a5623','#b68c47','#e3c88b','#a57b37','#d2b06b','#8f6a2c','#c29d59'],
    silver: ['#7d848d','#c9ced4','#f7f8fa','#a3aab3','#e6e9ed','#8a919a','#cfd4da'],
    rainbow: ['#c499aa','#f3d29d','#efedb8','#a9d5bd','#a7c6dc','#c0afd5','#e7b4c8']
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function rgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return hex || '#ffffff';
    let h = hex.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
  }
  function pill(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function wave(ctx,x0,x1,y,amp,period,phase) { ctx.beginPath(); const start=x0-period; ctx.moveTo(start,y+Math.sin((start+phase)/period*TAU)*amp); for(let x=start;x<=x1+period;x+=period/24)ctx.lineTo(x,y+Math.sin((x+phase)/period*TAU)*amp); ctx.stroke(); }
  function sun(ctx,x,y,r,count) { ctx.beginPath();ctx.arc(x,y,r*.42,0,TAU);ctx.stroke();for(let i=0;i<(count||20);i++){const a=i/(count||20)*TAU;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6);ctx.lineTo(x+Math.cos(a)*r*(i%2?.85:1),y+Math.sin(a)*r*(i%2?.85:1));ctx.stroke();} }
  function fish(ctx,x,y,r,facing) { ctx.save();ctx.translate(x,y);ctx.scale(facing||1,1);ctx.beginPath();ctx.moveTo(-r*.85,0);ctx.bezierCurveTo(-r*.25,-r*.72,r*.65,-r*.7,r,0);ctx.bezierCurveTo(r*.65,r*.7,-r*.25,r*.72,-r*.85,0);ctx.lineTo(-r*1.35,-r*.43);ctx.lineTo(-r*1.35,r*.43);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(r*.55,-r*.1,r*.055,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(r*.28,-r*.4);ctx.quadraticCurveTo(r*.05,0,r*.28,r*.4);ctx.stroke();ctx.restore(); }
  function sparkle(ctx,x,y,r) { ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+r*.2,y-r*.2,x+r,y);ctx.quadraticCurveTo(x+r*.2,y+r*.2,x,y+r);ctx.quadraticCurveTo(x-r*.2,y+r*.2,x-r,y);ctx.quadraticCurveTo(x-r*.2,y-r*.2,x,y-r);ctx.fill(); }
  function marbleColor(index, total, theme) {
    theme = typeof theme === 'string' ? P.THEMES[theme] : theme || P.THEMES.cosmic;
    const tone = theme.marble;
    return `hsl(${Math.round(((Number(index) || 0) / Math.max(total, 1) * 360 + tone.hueOffset) % 360)},${tone.saturation}%,${tone.lightness}%)`;
  }
  class Renderer {
    constructor(canvas) {
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.theme=P.THEMES.cosmic;this.quality='high';this.reducedMotion=false;
      this.sprites=new Map();this.nameSprites=new Map();this.currentZoom=1;this.winProgress=0;this.lastWinner=null;this.logo=null;
      if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{this.logo=image;this.sprites.clear();this.buildBackground();};image.src='./assets/logo.svg';}
      this.noise=makeCanvas(192,192);const ctx=this.noise.getContext('2d'),data=ctx.createImageData(192,192);let seed=6197;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
      for(let i=0;i<data.data.length;i+=4){data.data[i]=116;data.data[i+1]=86;data.data[i+2]=47;data.data[i+3]=rand()<.4?Math.floor(rand()*13):0;}ctx.putImageData(data,0,0);ctx.strokeStyle='rgba(130,101,62,.055)';ctx.lineWidth=.6;
      for(let i=0;i<75;i++){const x=rand()*192,y=rand()*192;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*5,y+rand()*1.5);ctx.stroke();}this.resize();
    }
    brandMark(ctx,x,y,r){if(!this.logo)return;ctx.save();ctx.drawImage(this.logo,x-r,y-r*.87,r*2,r*1.74);ctx.restore();}
    material(){return METALS[this.theme.material]?this.theme.material:{cosmic:'ivory',candy:'rainbow',gold:'gold',ice:'silver'}[this.theme.id]||'gold';}
    foil(ctx,x1,y1,x2,y2){const g=ctx.createLinearGradient(x1,y1,x2,y2);METALS[this.material()].forEach((c,i,a)=>g.addColorStop(i/(a.length-1),c));return g;}
    resize() {
      this.width = this.canvas.clientWidth || innerWidth; this.height = this.canvas.clientHeight || innerHeight;
      const max = this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : P.CONFIG.maxDpr;
      this.dpr = Math.min(devicePixelRatio || 1, max); this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
      this.buildBackground();
    }
    setTheme(id) { const next = P.THEMES[id] || P.THEMES.cosmic; if (this.theme === next) return; this.theme = next; this.sprites.clear(); this.nameSprites.clear(); this.buildBackground(); }
    setQuality(quality) { if (this.quality === quality) return; this.quality = quality; this.resize(); }
    setReducedMotion(value) { this.reducedMotion = value; }
    buildBackground() {
      if(!this.width||!this.theme)return;const w=this.width,h=this.height,t=this.theme;this.background=makeCanvas(Math.round(w),Math.round(h));const ctx=this.background.getContext('2d');
      let g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,t.background[0]);g.addColorStop(.52,t.background[1]);g.addColorStop(1,t.background[2]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.fillStyle=ctx.createPattern(this.noise,'repeat');ctx.fillRect(0,0,w,h);
      ctx.strokeStyle=t.id==='gold'?'rgba(217,184,114,.045)':'rgba(144,111,63,.06)';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1;ctx.save();ctx.globalAlpha=.06;this.brandMark(ctx,w*.72,h*.46,Math.min(w,h)*.22);ctx.restore();sun(ctx,w*.3,h*.25,Math.min(w,h)*.22,28);for(let i=0;i<7;i++)wave(ctx,0,w,h*.75+i*15,13,180,i*20);fish(ctx,w*.87,h*.74,48,-1);fish(ctx,w*.17,h*.85,36,1);
      this.vignette=makeCanvas(Math.round(w),Math.round(h));const v=this.vignette.getContext('2d');g=v.createRadialGradient(w*.58,h*.48,Math.min(w,h)*.23,w*.58,h*.48,Math.max(w,h)*.78);g.addColorStop(0,'rgba(120,83,35,0)');g.addColorStop(.6,'rgba(120,83,35,.015)');g.addColorStop(1,'rgba(120,83,35,.1)');v.fillStyle=g;v.fillRect(0,0,w,h);
    }
    glow(color){const key='g:'+color;if(this.sprites.has(key))return this.sprites.get(key);const c=makeCanvas(128,128),ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(.3,color);g.addColorStop(1,'rgba(244,237,224,0)');ctx.globalAlpha=.18;ctx.fillStyle=g;ctx.fillRect(0,0,128,128);this.sprites.set(key,c);return c;}
    marbleSprite(color) {
      const key='m:'+color;if(this.sprites.has(key))return this.sprites.get(key);const c=makeCanvas(128,128),ctx=c.getContext('2d'),r=25;
      let g=ctx.createRadialGradient(64,72,17,64,72,37);g.addColorStop(0,'rgba(81,55,24,.2)');g.addColorStop(1,'rgba(81,55,24,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(64,75,37,30,0,0,TAU);ctx.fill();
      g=ctx.createRadialGradient(54,51,0,70,72,37);g.addColorStop(0,'#fffefa');g.addColorStop(.27,PAPER_HI);g.addColorStop(.54,color);g.addColorStop(.83,'#baaa92');g.addColorStop(1,'#7d6849');ctx.fillStyle=g;ctx.beginPath();ctx.arc(64,64,r,0,TAU);ctx.fill();if(this.theme.id==='gold'){ctx.strokeStyle='#684921';ctx.lineWidth=4;ctx.stroke();}ctx.strokeStyle=this.foil(ctx,41,39,87,91);ctx.lineWidth=2.3;ctx.stroke();ctx.strokeStyle='rgba(255,253,246,.88)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(64,64,r-3,3.5,5.5);ctx.stroke();
      ctx.save();ctx.beginPath();ctx.arc(64,64,r-3,0,TAU);ctx.clip();ctx.strokeStyle='rgba(255,251,240,.3)';ctx.lineWidth=2;wave(ctx,39,89,69,5,28,0);wave(ctx,39,89,73,4,28,9);ctx.restore();
      if(this.material()==='gold'){ctx.strokeStyle='rgba(255,238,184,.45)';ctx.lineWidth=1;sun(ctx,66,65,15,12);}if(this.material()==='rainbow'){ctx.save();ctx.globalAlpha=.28;ctx.fillStyle=this.foil(ctx,35,37,91,85);ctx.beginPath();ctx.arc(64,64,21,0,TAU);ctx.fill();ctx.restore();}this.sprites.set(key,c);return c;
    }
    pinSprite(color,kind) {
      const key='p:'+color+':'+kind;if(this.sprites.has(key))return this.sprites.get(key);const c=makeCanvas(128,128),ctx=c.getContext('2d'),r=20;let g=ctx.createRadialGradient(64,72,13,64,72,33);g.addColorStop(0,'rgba(82,53,17,.19)');g.addColorStop(1,'rgba(82,53,17,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(64,70,33,0,TAU);ctx.fill();
      ctx.fillStyle=this.foil(ctx,44,44,84,90);ctx.beginPath();ctx.arc(64,64,r,0,TAU);ctx.fill();ctx.strokeStyle='rgba(98,65,23,.45)';ctx.lineWidth=1;ctx.stroke();ctx.strokeStyle='rgba(255,250,231,.92)';ctx.beginPath();ctx.arc(64,63,r-3,3.5,5.5);ctx.stroke();
      if(kind==='bumper'){ctx.fillStyle=PAPER_HI;ctx.beginPath();ctx.arc(64,64,15,0,TAU);ctx.fill();ctx.strokeStyle=this.foil(ctx,48,46,80,82);ctx.lineWidth=1.1;this.brandMark(ctx,64,65,10);}else{g=ctx.createRadialGradient(60,58,0,66,67,16);g.addColorStop(0,'#fffdf7');g.addColorStop(.45,'#f1e4ca');g.addColorStop(1,color);ctx.fillStyle=g;ctx.beginPath();ctx.arc(64,64,12,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,255,255,.72)';ctx.beginPath();ctx.ellipse(60,59,3.4,2.1,-.5,0,TAU);ctx.fill();}this.sprites.set(key,c);return c;
    }
    drawBackground(camera,time){const ctx=this.ctx;ctx.drawImage(this.background,0,0,this.width,this.height);if(this.material()==='rainbow'&&this.quality!=='low'){ctx.save();const drift=this.reducedMotion?0:Math.sin(time*.18)*24;ctx.globalAlpha=.07;ctx.fillStyle=this.foil(ctx,0,drift,this.width,this.height+drift);ctx.fillRect(0,0,this.width,this.height);ctx.restore();}}
    boardTile(width) {
      const key='board:'+width;if(this.sprites.has(key))return this.sprites.get(key);
      const c=makeCanvas(width,520),ctx=c.getContext('2d');ctx.fillStyle=ctx.createPattern(this.noise,'repeat');ctx.fillRect(0,0,width,520);ctx.strokeStyle='rgba(184,157,111,.065)';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1.5;
      ctx.save();ctx.globalAlpha=.12;this.brandMark(ctx,width/2,240,95);ctx.restore();fish(ctx,145,370,28,1);fish(ctx,width-145,385,28,-1);for(let i=0;i<3;i++)wave(ctx,55,width-55,420+i*9,6,98,i*24);this.sprites.set(key,c);return c;
    }
    drawBoard(map,time,visible) {
      const ctx=this.ctx,t=this.theme,w=map.width,h=map.height,top=Math.max(0,visible.top),bottom=Math.min(h,visible.bottom);ctx.save();ctx.fillStyle='rgba(91,67,35,.035)';pill(ctx,10,8,w-20,h,28);ctx.fill();ctx.fillStyle=t.id==='gold'?'#EAD9B9':PAPER_HI;pill(ctx,23,0,w-46,h-18,24);ctx.fill();ctx.beginPath();pill(ctx,23,0,w-46,h-18,24);ctx.clip();
      let g=ctx.createLinearGradient(25,0,w-25,0);g.addColorStop(0,'rgba(171,139,86,.07)');g.addColorStop(.2,'rgba(248,239,221,.04)');g.addColorStop(.8,'rgba(248,239,221,.04)');g.addColorStop(1,'rgba(171,139,86,.07)');ctx.fillStyle=g;ctx.fillRect(23,top,w-46,bottom-top);for(let y=Math.floor(top/520)*520;y<bottom;y+=520)ctx.drawImage(this.boardTile(w),0,y);ctx.restore();ctx.strokeStyle=this.foil(ctx,0,0,w,240);ctx.lineWidth=3;pill(ctx,24,2,w-48,h-22,23);ctx.stroke();ctx.strokeStyle='rgba(116,85,42,.24)';ctx.lineWidth=.8;const bounds=P.boardBounds(map);pill(ctx,bounds.left,bounds.top,bounds.right-bounds.left,bounds.bottom-bounds.top,bounds.radius);ctx.stroke();
      ctx.strokeStyle='rgba(255,252,242,.85)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(27,Math.max(24,top));ctx.lineTo(27,Math.min(h-46,bottom));ctx.stroke();for(let y=Math.max(110,Math.floor(top/300)*300);y<bottom;y+=300){ctx.strokeStyle=this.foil(ctx,34,y,72,y+35);ctx.lineWidth=1.1;this.brandMark(ctx,55,y,13);this.brandMark(ctx,w-55,y,13);}
      if(top<170){ctx.save();ctx.textAlign='center';ctx.fillStyle=INK;ctx.font='600 10px Pretendard Variable,sans-serif';ctx.fillStyle='#8a7760';ctx.font='500 10px Pretendard Variable,sans-serif';if(this.logo){ctx.globalAlpha=.2;ctx.drawImage(this.logo,w/2-70,84,140,122);}ctx.restore();}
    }
    segment(pose,color,ghost){const ctx=this.ctx,thickness=Math.max(3,pose.thickness||9);ctx.save();ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pose.x1,pose.y1+(ghost?0:3));ctx.lineTo(pose.x2,pose.y2+(ghost?0:3));ctx.strokeStyle='rgba(94,66,27,.13)';ctx.lineWidth=thickness*2+4;ctx.stroke();ctx.beginPath();ctx.moveTo(pose.x1,pose.y1);ctx.lineTo(pose.x2,pose.y2);ctx.strokeStyle=ghost?rgba(color,.13):this.foil(ctx,pose.x1,pose.y1-9,pose.x2,pose.y2+12);ctx.lineWidth=thickness*2;ctx.stroke();if(!ghost){ctx.strokeStyle='rgba(255,250,231,.78)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(pose.x1,pose.y1-thickness*.6);ctx.lineTo(pose.x2,pose.y2-thickness*.6);ctx.stroke();}ctx.restore();}
    drawObstacle(o,physics,effects,time,visible) {
      const ctx=this.ctx,t=this.theme,type=o.type,pose=physics.getObstaclePose?physics.getObstaclePose(o):o;
      const y=type==='polygon'?o.points.reduce((sum,p)=>sum+p.y,0)/o.points.length:pose.y===undefined?(pose.y1+pose.y2)/2:pose.y,span=o.length||o.height||o.r||(type==='polygon'?260:70);if(y+span<visible.top-80||y-span>visible.bottom+80)return;const hit=effects&&effects.hits&&effects.hits.get(o.id||o),power=hit?clamp(hit.life/.3,0,1):0;
      if(type==='pin'||type==='bumper'){const color=type==='bumper'?t.secondary:t.primary,r=(o.r||10)*(1+power*(type==='bumper'?.14:.04));if(type==='bumper'){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(this.reducedMotion?0:time*.18);ctx.strokeStyle=this.foil(ctx,-r*2,-r,r*2,r);ctx.lineWidth=1.5;sun(ctx,0,0,r*1.6,16);ctx.restore();}ctx.drawImage(this.pinSprite(color,type),o.x-r*3.2,o.y-r*3.2,r*6.4,r*6.4);if(power&&!this.reducedMotion){ctx.save();ctx.globalAlpha=power*.75;ctx.fillStyle='#fffaf0';sparkle(ctx,o.x-r*.4,o.y-r*.6,r*.6);ctx.restore();}}
      else if(type==='segment'||type==='rotor'||type==='moving'){const color=t.primary;if(type==='rotor'&&!this.reducedMotion&&this.quality==='high'){const angle=pose.angle||0,len=o.length/2;for(let i=2;i>0;i--){const a=angle-(o.speed||1)*i*.075;this.segment({x1:o.x-Math.cos(a)*len,y1:o.y-Math.sin(a)*len,x2:o.x+Math.cos(a)*len,y2:o.y+Math.sin(a)*len,thickness:o.thickness},color,true);}}
        if(type==='moving'){ctx.strokeStyle='rgba(119,93,58,.14)';ctx.lineWidth=1;ctx.setLineDash([2,7]);ctx.beginPath();if(o.axis==='y'){ctx.moveTo(o.x,o.y-o.amplitude);ctx.lineTo(o.x,o.y+o.amplitude);}else{ctx.moveTo(o.x-o.amplitude,o.y);ctx.lineTo(o.x+o.amplitude,o.y);}ctx.stroke();ctx.setLineDash([]);if(!this.reducedMotion&&this.quality==='high')for(let i=2;i>0;i--){const dx=(pose.vx||0)*.065*i,dy=(pose.vy||0)*.065*i;this.segment({x1:pose.x1-dx,y1:pose.y1-dy,x2:pose.x2-dx,y2:pose.y2-dy,thickness:pose.thickness},color,true);}}
        this.segment(pose,color,false);if(type==='rotor')ctx.drawImage(this.pinSprite(t.secondary,'bumper'),o.x-30,o.y-30,60,60);
      }else if(type==='polygon'){ctx.save();ctx.beginPath();o.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=this.foil(ctx,o.points[0].x,o.points[0].y,o.points[1].x,o.points[1].y);ctx.fill();ctx.strokeStyle='rgba(112,77,30,.28)';ctx.lineWidth=2;ctx.stroke();ctx.clip();ctx.strokeStyle='rgba(255,248,225,.3)';ctx.lineWidth=1;for(let i=0;i<4;i++)wave(ctx,0,1000,y-30+i*20,9,130,i*12);ctx.restore();}
      else if(type==='boost'){const shape=P.boostShape(o),w=shape.width,h=shape.height;ctx.save();ctx.translate(o.x,o.y);ctx.rotate(shape.angle);ctx.fillStyle='rgba(232,219,191,.48)';pill(ctx,-w/2,-h/2,w,h,shape.radius);ctx.fill();ctx.strokeStyle=this.foil(ctx,-w/2,0,w/2,h);ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<4;i++){const py=((i*h/3+(this.reducedMotion?0:time*40))%h)-h/2;ctx.globalAlpha=.35+(1-Math.abs(py)/(h/2))*.6;ctx.strokeStyle=t.primary;ctx.lineWidth=2;wave(ctx,-w*.35,w*.35,py,4,w*.6,0);}ctx.restore();}
      else if(type==='portal'){const r=o.r||35;ctx.save();ctx.translate(o.x,o.y);ctx.rotate(this.reducedMotion?0:-time*.45);ctx.fillStyle=this.foil(ctx,-r,-r,r,r);ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.strokeStyle='rgba(108,78,39,.35)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=PAPER_HI;ctx.beginPath();ctx.arc(0,0,r*.74,0,TAU);ctx.fill();ctx.strokeStyle=this.foil(ctx,-r,-r,r,r);ctx.lineWidth=1.3;this.brandMark(ctx,0,3,r*.55);for(let i=0;i<12;i++){const a=i/12*TAU;ctx.fillStyle=i%2?t.primary:'#b79e73';ctx.beginPath();ctx.arc(Math.cos(a)*r*1.25,Math.sin(a)*r*1.25,i%2?1.5:2.3,0,TAU);ctx.fill();}ctx.restore();ctx.save();ctx.textAlign='center';ctx.font='700 13px Pretendard Variable,sans-serif';ctx.fillStyle='#674B27';ctx.fillText((o.pair||'').charAt(0).toUpperCase()+(o.exit?' 도착':' 진입'),o.x,o.y-r-19);ctx.restore();}
    }
    portalPairs(map) {
      return (map.obstacles || []).filter(o => o.type === 'portal' && !o.exit && Number.isFinite(o.targetX) && Number.isFinite(o.targetY))
        .map(o => ({ x: o.x, y: o.y, targetX: o.targetX, targetY: o.targetY, pair: o.pair }));
    }
    drawPortalGuides(map, visible) {
      const ctx = this.ctx;
      for (const route of this.portalPairs(map)) {
        if (route.y > visible.bottom + 60 || route.targetY < visible.top - 60) continue;
        ctx.save(); ctx.strokeStyle='rgba(119,85,39,.42)';ctx.lineWidth=2.5;ctx.setLineDash([4,12]);ctx.beginPath();
        ctx.moveTo(route.x,route.y);ctx.bezierCurveTo(route.x,route.y+230,route.targetX,route.targetY-230,route.targetX,route.targetY);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#795831';ctx.beginPath();ctx.moveTo(route.targetX,route.targetY-49);ctx.lineTo(route.targetX-8,route.targetY-63);ctx.lineTo(route.targetX+8,route.targetY-63);ctx.closePath();ctx.fill();ctx.restore();
      }
    }
    drawFinish(map,time,visible){const y=map.finish&&map.finish.y||map.height-120;if(y<visible.top-180||y>visible.bottom+180)return;const ctx=this.ctx,x=80,w=map.width-160;ctx.save();ctx.fillStyle=PAPER_HI;pill(ctx,x,y-82,w,100,9);ctx.fill();ctx.strokeStyle=this.foil(ctx,x,y-90,x+w,y+25);ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='rgba(120,87,39,.28)';ctx.lineWidth=.8;pill(ctx,x+9,y-73,w-18,81,4);ctx.stroke();ctx.textAlign='center';ctx.fillStyle=INK;ctx.font='700 25px Pretendard Variable,sans-serif';ctx.fillText('결승',map.width/2,y-38);ctx.font='500 11px Pretendard Variable,sans-serif';ctx.fillStyle='#8a7760';ctx.fillText('어른뭉방구  ·  당첨을 확인하는 곳',map.width/2,y-12);ctx.strokeStyle=this.foil(ctx,x,y-75,x+w,y);ctx.fillStyle=this.theme.primary;ctx.lineWidth=1.3;this.brandMark(ctx,x+50,y-30,22);this.brandMark(ctx,x+w-50,y-30,22);ctx.strokeStyle='rgba(170,137,82,.55)';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(x+24,y+32);ctx.lineTo(x+w-24,y+32);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
    drawMarble(m, total, leader, visible, time, dt, idle) {
      const ctx = this.ctx, color = marbleColor(m.colorIndex === undefined ? m.id : m.colorIndex, total, this.theme), r = m.r || 16;
      const sourceTrail = m.trail || [];
      const trail = sourceTrail.slice(-(this.quality === 'high' ? 14 : this.quality === 'medium' ? 7 : 3));
      if (m.y + r * 6 < visible.top || m.y - r * 6 > visible.bottom) return;
      const speed = Math.hypot(m.vx || 0, m.vy || 0);
      if (!m.finished && !this.reducedMotion && speed > 80 && trail.length > 2 && this.quality !== 'low' && (total < 80 || leader && leader.id === m.id)) {
        // One thin, rounded curve reads as motion without stacking square strokes over nearby collisions.
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .17 * Math.min(1, speed / 480);
        ctx.strokeStyle = color; ctx.lineWidth = r * .65; ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length - 1; i++) ctx.quadraticCurveTo(trail[i].x, trail[i].y, (trail[i].x + trail[i + 1].x) / 2, (trail[i].y + trail[i + 1].y) / 2);
        ctx.lineTo(m.x, m.y); ctx.stroke(); ctx.restore();
      }
      ctx.drawImage(this.marbleSprite(color), m.x - r * 2.56, m.y - r * 2.56, r * 5.12, r * 5.12);
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate((m.angle || 0) * .35); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-r * .29, -r * .38, r * .3, r * .16, -.6, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.17)'; ctx.beginPath(); ctx.ellipse(r * .29, r * .35, r * .17, r * .06, -.5, 0, TAU); ctx.fill(); ctx.restore();
      const isLeader = leader && leader.id === m.id;
      if (isLeader) { ctx.strokeStyle = this.foil(ctx,m.x-r*2,m.y-r*2,m.x+r*2,m.y+r*2); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, r * 1.7, 0, TAU); ctx.stroke(); }
    }
    nameSprite(m, leader) {
      const ctx = this.ctx, font = leader ? 12 : 10;
      let name = m.name || 'PLAYER'; if (name.length > 14) name = name.slice(0, 13) + '…';
      const key = `${leader ? 'leader' : 'name'}:${name}`; let label = this.nameSprites.get(key);
      if (!label) {
        ctx.save(); ctx.font = `${leader ? 700 : 500} ${font}px Pretendard Variable,sans-serif`; const width = Math.ceil(ctx.measureText(name).width + (leader ? 34 : 16)), height = leader ? 25 : 20; ctx.restore();
        const sprite = makeCanvas(width * 2 + 4, height * 2 + 4), c = sprite.getContext('2d'); c.scale(2, 2); c.translate(1, 1);
        c.fillStyle = leader ? '#fbf3dc' : 'rgba(251,247,239,.93)'; pill(c, 0, 0, width, height, height / 2); c.fill(); c.strokeStyle = leader ? '#be9d60' : 'rgba(133,108,69,.34)'; c.lineWidth = .8; c.stroke();
        c.font = `${leader ? 700 : 500} ${font}px Pretendard Variable,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText(name, width / 2 + (leader ? 8 : 0), height / 2 + .5);
        if (leader) { c.strokeStyle='#a87d37';c.lineWidth=1;sun(c,15,height/2,7,10); }
        label = { sprite, width: width + 2, height: height + 2 }; if (this.nameSprites.size >= 550) this.nameSprites.delete(this.nameSprites.keys().next().value); this.nameSprites.set(key, label);
      }
      return label;
    }
    planLabels(marbles, leader, camera, area) {
      const active = marbles.filter(m => !m.finished);
      const limit = marbles.length <= 12 ? 12 : marbles.length <= 50 ? 7 : marbles.length <= 200 ? 3 : 1;
      const visible = active.map(m => ({ marble: m, point: camera.worldToScreen(m.x, m.y), radius: (m.r || 12) * camera.zoom }))
        .filter(item => item.point.x >= area.x && item.point.x <= area.x + area.w && item.point.y >= area.y && item.point.y <= area.y + area.h);
      const candidates = visible.slice().sort((a, b) => (b.marble.id === (leader && leader.id)) - (a.marble.id === (leader && leader.id)) || b.marble.y - a.marble.y).slice(0, limit);
      const placements = [];
      for (const item of candidates) {
        const isLeader = !!leader && item.marble.id === leader.id, label = this.nameSprite(item.marble, isLeader);
        const w = label.width, h = label.height, x = item.point.x, y = item.point.y, r = item.radius;
        const positions = [
          { x: x - w / 2, y: y - r - h - 6 }, { x: x + r + 6, y: y - h / 2 },
          { x: x - r - w - 6, y: y - h / 2 }, { x: x - w / 2, y: y + r + 6 }
        ];
        let best = null, score = Infinity;
        for (const box of positions) {
          if (box.x < area.x + 3 || box.y < area.y + 3 || box.x + w > area.x + area.w - 3 || box.y + h > area.y + area.h - 3) continue;
          let overlap = 0;
          for (const other of visible) {
            if (other === item) continue;
            const px = clamp(other.point.x, box.x, box.x + w), py = clamp(other.point.y, box.y, box.y + h);
            if (Math.hypot(other.point.x - px, other.point.y - py) < other.radius + 2) overlap++;
          }
          for (const placed of placements) if (box.x < placed.x + placed.label.width + 4 && box.x + w + 4 > placed.x && box.y < placed.y + placed.label.height + 4 && box.y + h + 4 > placed.y) overlap += 3;
          if (overlap < score) { best = box; score = overlap; }
          if (score === 0) break;
        }
        if (best && (score === 0 || isLeader)) placements.push({ marble: item.marble, label, x: best.x, y: best.y });
      }
      return placements;
    }
    drawLabels(marbles, leader, camera, area) {
      const ctx = this.ctx, placements = this.planLabels(marbles, leader, camera, area);
      ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.w, area.h); ctx.clip();
      for (const item of (this.quality === 'low' && marbles.length > 12 ? placements.slice(0, 1) : placements)) ctx.drawImage(item.label.sprite, item.x, item.y, item.label.width, item.label.height);
      ctx.restore();
    }
    finishDisplay(finished, map) {
      const recent = finished.slice(-12), start = finished.length - recent.length;
      return recent.map((marble, index) => ({ marble, rank: start + index + 1,
        x: 145 + ((start + index) % 6) * 142,
        y: map.finish.y + 65 + (Math.floor(((start + index) % 12) / 6) * 72) }));
    }
    drawFinishers(physics, map, visible) {
      const finished = physics.finished || [], y = map.finish.y;
      if (!finished.length || y > visible.bottom + 20 || y + 190 < visible.top) return;
      const ctx = this.ctx;
      for (const entry of this.finishDisplay(finished, map)) {
        const color = marbleColor(entry.marble.colorIndex, physics.marbles.length, this.theme), r = 10;
        ctx.drawImage(this.marbleSprite(color), entry.x - r * 2.56, entry.y - r * 2.56, r * 5.12, r * 5.12);
      }
      ctx.save(); ctx.textAlign = 'center'; ctx.font = '600 12px Pretendard Variable,sans-serif'; ctx.fillStyle = '#765633';
      ctx.fillText('완주 ' + finished.length + ' / ' + physics.marbles.length, map.width / 2, y + 185); ctx.restore();
    }
    drawEffects(effects,visible){if(!effects)return;const ctx=this.ctx;ctx.save();if(effects.lead&&Number.isFinite(effects.lead.x)&&!this.reducedMotion){const lead=effects.lead;ctx.globalAlpha=Math.min(.55,lead.life*.4);ctx.drawImage(this.glow(lead.color||this.theme.primary),lead.x-110,lead.y-110,220,220);}
      for(const ring of effects.rings){if(ring.y<visible.top-ring.radius||ring.y>visible.bottom+ring.radius)continue;ctx.strokeStyle=ring.color;ctx.globalAlpha=ring.life/ring.duration*.6;ctx.lineWidth=1+ring.life/ring.duration;ctx.beginPath();ctx.arc(ring.x,ring.y,ring.radius,0,TAU);ctx.stroke();}
      for(const p of effects.particles){if(p.y<visible.top-20||p.y>visible.bottom+20)continue;ctx.globalAlpha=Math.min(1,p.life/Math.min(.4,p.duration))*.85;ctx.fillStyle=p.color;ctx.strokeStyle=p.color;
        if(p.type==='ice'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#b4bcc1';ctx.beginPath();ctx.moveTo(0,-p.r);ctx.lineTo(p.r*.55,0);ctx.lineTo(0,p.r);ctx.lineTo(-p.r*.55,0);ctx.closePath();ctx.fill();ctx.restore();}
        else if(p.type==='confetti'||p.type==='gold'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillRect(-p.r,-p.r/3,p.r*2,p.r*.7);ctx.fillStyle='rgba(255,250,225,.65)';ctx.fillRect(-p.r,-p.r/3,p.r*2,p.r*.18);ctx.restore();}else sparkle(ctx,p.x,p.y,p.r*1.4);
      }ctx.restore();}
    drawWinner(winner,total,camera,dt,time){if(this.lastWinner!==winner.id){this.winProgress=0;this.lastWinner=winner.id;}this.winProgress=Math.min(1,this.winProgress+dt*1.15);const ease=1-Math.pow(1-this.winProgress,3),pos=camera.worldToScreen(winner.x,winner.y),area=camera.viewport||{x:0,y:0,w:this.width,h:this.height},cx=area.x+area.w/2,cy=area.y+area.h*.4;
      const ctx=this.ctx,color=marbleColor(winner.colorIndex||0,total,this.theme),x=pos.x+(cx-pos.x)*ease,y=pos.y+(cy-pos.y)*ease,r=(winner.r||16)*camera.zoom+52*ease;ctx.save();ctx.globalAlpha=ease*.9;const g=ctx.createRadialGradient(cx,cy,50,cx,cy,Math.max(area.w,area.h)*.7);g.addColorStop(0,PAPER_HI);g.addColorStop(.6,'rgba(251,247,239,.95)');g.addColorStop(1,'rgba(244,237,224,0)');ctx.fillStyle=g;ctx.fillRect(area.x,area.y,area.w,area.h);ctx.globalAlpha=ease;
      ctx.strokeStyle=this.foil(ctx,cx-140,cy-170,cx+140,cy+170);ctx.lineWidth=1.4;sun(ctx,cx,cy,r*2.2,32);ctx.beginPath();ctx.arc(cx,cy,r*1.66,0,TAU);ctx.stroke();ctx.strokeStyle='rgba(172,135,75,.24)';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(cx,cy,r*1.85,0,TAU);ctx.stroke();ctx.globalAlpha=1;ctx.drawImage(this.marbleSprite(color),x-r*2.56,y-r*2.56,r*5.12,r*5.12);ctx.globalAlpha=ease;ctx.fillStyle='#9a7434';ctx.textAlign='center';ctx.font='600 11px Pretendard Variable,sans-serif';ctx.fillStyle=INK;ctx.font='700 19px Pretendard Variable,sans-serif';
      ctx.font='700 34px Pretendard Variable,sans-serif';ctx.fillText((winner.name||'당첨자').slice(0,22),cx,cy+157);ctx.font='500 12px Pretendard Variable,sans-serif';ctx.fillStyle='#8a7760';ctx.fillText('축하드립니다!',cx,cy+186);ctx.strokeStyle=this.foil(ctx,cx-90,cy+211,cx+90,cy+211);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-110,cy+212);ctx.lineTo(cx-18,cy+212);ctx.moveTo(cx+18,cy+212);ctx.lineTo(cx+110,cy+212);ctx.stroke();ctx.fillStyle=this.theme.primary;sparkle(ctx,cx,cy+212,6);ctx.restore();}
    render(state) {
      const { physics, map, camera, effects, time = 0, dt = 1 / 60, status, leader, winner, photoFinish } = state; if (!map || !physics || !camera) return;
      const ctx = this.ctx, marbles = physics.marbles || [];
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.drawBackground(camera, time);
      const area = camera.viewport || { x: 0, y: 0, w: this.width, h: this.height }, scale = camera.zoom || 1; this.currentZoom = scale;
      const shake = !this.reducedMotion && effects ? effects.shake : 0, sx = Math.sin(time * 93) * shake * 2, sy = Math.cos(time * 107) * shake * 1.4;
      ctx.save(); ctx.translate(area.x + area.w / 2 + sx, area.y + area.h / 2 + sy); ctx.scale(scale, scale); ctx.translate(-camera.x, -camera.y);
      const visible = { top: camera.y - this.height / (2 * scale) - 100, bottom: camera.y + this.height / (2 * scale) + 100 };
      this.drawBoard(map, time, visible); this.drawPortalGuides(map, visible); for (const o of map.obstacles || []) this.drawObstacle(o, physics, effects, time, visible); this.drawFinish(map, time, visible);
      this.drawEffects(effects, visible);
      if (leader && effects && effects.lead && !this.reducedMotion) { const remaining = effects.lead.life || effects.lead.time || 0; ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(.45, remaining * .4); ctx.drawImage(this.glow(this.theme.primary), leader.x - 110, leader.y - 110, 220, 220); ctx.restore(); }
      if (!state.hideMarbles) {
        for (const m of marbles) if (!m.finished) this.drawMarble(m, marbles.length, leader, visible, time, dt, status === 'idle');
        this.drawFinishers(physics, map, visible);
      }
      ctx.restore(); ctx.drawImage(this.vignette, 0, 0, this.width, this.height);
      if (this.quality === 'high') { ctx.save(); ctx.globalAlpha = .26; ctx.fillStyle = ctx.createPattern(this.noise, 'repeat'); ctx.fillRect(0, 0, this.width, this.height); ctx.restore(); }
      if(photoFinish){ctx.save();ctx.textAlign='center';ctx.font='600 10px Pretendard Variable,sans-serif';ctx.fillStyle='#8f6834';ctx.fillText('아주 가까운 승부  ·  마지막 순간을 천천히',area.x+area.w/2,area.y+35);ctx.restore();}
      if(!this.reducedMotion&&effects&&effects.flash>.01){ctx.save();ctx.globalAlpha=effects.flash*.06;ctx.fillStyle='#fff6dc';ctx.fillRect(0,0,this.width,this.height);ctx.restore();}
      if (!state.hideMarbles && status !== 'finished') this.drawLabels(marbles, leader, camera, area);
      if (status === 'finished' && winner) this.drawWinner(winner, marbles.length, camera, dt, time); else { this.winProgress = 0; this.lastWinner = null; }
    }
    cinemaBoard(physics, bottom) {
      const map = physics.map, image = makeCanvas(map.width, Math.ceil(bottom)), ctx = image.getContext('2d'), original = this.ctx;
      try {
        this.ctx = ctx; const visible = { top: 0, bottom };
        this.drawBoard(map, 0, visible);
        this.drawPortalGuides(map, visible);
        for (const obstacle of map.obstacles || []) this.drawObstacle(obstacle, physics, null, 0, visible);
        this.drawFinish(map, 0, visible);
      } finally { this.ctx = original; }
      return image;
    }
    drawMinimap(canvas, physics, camera) {
      if (!canvas || !physics || !physics.map) return; const map = physics.map, ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, pad = 8, sx = (w - pad * 2) / map.width, sy = (h - pad * 2) / map.height, t = this.theme;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = PAPER_HI; pill(ctx, 0, 0, w, h, 12); ctx.fill(); ctx.save(); ctx.translate(pad, pad); ctx.scale(sx, sy);
      for (const route of this.portalPairs(map)) { ctx.strokeStyle='rgba(124,86,37,.6)';ctx.lineWidth=14;ctx.setLineDash([16,30]);ctx.beginPath();ctx.moveTo(route.x,route.y);ctx.lineTo(route.targetX,route.targetY);ctx.stroke();ctx.setLineDash([]); }
      ctx.fillStyle = 'rgba(164,132,78,.4)'; for (const o of map.obstacles || []) { if (o.type === 'pin' || o.type === 'bumper') { ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(o.r || 10, 15), 0, TAU); ctx.fill(); } else if (o.type === 'segment' || o.type === 'rotor' || o.type === 'moving') { const p = physics.getObstaclePose(o); ctx.strokeStyle = 'rgba(139,109,64,.45)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke(); } }
      const active = (physics.marbles || []).filter(m => !m.finished), leader = active.reduce((best,m) => !best || m.y > best.y ? m : best, null);
      ctx.fillStyle = 'rgba(103,75,43,.48)'; for (const m of active) { ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(m.r || 16, 22), 0, TAU); ctx.fill(); }
      if (leader) { ctx.fillStyle='#A65436';ctx.beginPath();ctx.arc(leader.x,leader.y,52,0,TAU);ctx.fill(); }
      ctx.strokeStyle = '#b98e49'; ctx.lineWidth = 12; const fy = map.finish && map.finish.y || map.height - 100; ctx.beginPath(); ctx.moveTo(60, fy); ctx.lineTo(map.width - 60, fy); ctx.stroke(); ctx.restore();
      const area = camera.viewport || { w: this.width, h: this.height }, vw = Math.min(w - 2 * pad, area.w / camera.zoom * sx), vh = Math.min(h - 2 * pad, area.h / camera.zoom * sy), x = clamp(pad + camera.x * sx - vw / 2, pad, w - pad - vw), y = clamp(pad + camera.y * sy - vh / 2, pad, h - pad - vh);
      ctx.fillStyle = 'rgba(182,140,71,.13)'; ctx.fillRect(x, y, vw, vh); ctx.strokeStyle = '#b68c47'; ctx.lineWidth = 1; ctx.strokeRect(x, y, vw, vh);
    }
  }
  Renderer.marbleColor = marbleColor; P.marbleColor = marbleColor; P.Renderer = Renderer;
})(window.CosmicPinball = window.CosmicPinball || {});
