(function(P){
  'use strict';
  var map={id:'rhythm',version:3,name:'박자 분배기',width:1000,height:11200,spawn:{x:36,y:50,width:928,height:700},finish:{y:11000},obstacles:[]};
  function rail(id,x1,y1,x2,y2){map.obstacles.push({type:'segment',id:'rhythm-'+id,x1:x1,y1:y1,x2:x2,y2:y2,thickness:8,role:'beat-guide'});}
  // Staggered full-width projections intercept every vertical ray. Their slope
  // sends arrivals into the next timed mechanism rather than a side-wall shaft.
  [880,3300,4500,5650,6900,10100].forEach(function(y,row){
    rail('guide-'+row+'-left',-40,y,620,y+210);
    rail('guide-'+row+'-right',380,y+570,1040,y+360);
    [420,580].forEach(function(x,col){map.obstacles.push({type:'pin',id:'rhythm-detail-'+row+'-'+col,x:x,y:y+360,r:12});});
  });
  [165,500,835].forEach(function(x,i){map.obstacles.push({type:'pin',id:'rhythm-detail-final-'+i,x:x,y:10840,r:12});});
  function gate(id,role,y,side,phase,period,length,amplitude,base,angle,step,steps){
    map.obstacles.push({type:'moving',id:'rhythm-'+id,role:role,assembly:'rhythm-'+id,side:side,
      x:side===-1?base:1000-base,y:y,axis:'x',length:length,thickness:12,angle:side===-1?angle:-angle,
      amplitude:amplitude,speed:Math.PI*2/period,phase:phase,beat:{period:period,step:step,steps:steps}});
  }
  // The same translation phase makes left and right shutters alternate: left
  // advances at +sin, right advances at -sin. Every tip retains a wide escape.
  [1780,2220,2660,3100].forEach(function(y,i){gate('shutter-'+i,'beat-shutter',y,i%2?1:-1,Math.floor(i/2)*Math.PI/2,4.8,820,420,-120,.14,i%2,2);});
  // Offbeat pairs rotate in opposite directions with a quarter-turn offset.
  // Their swept discs leave >=106 clearance; the disc markings are not walls.
  [4250,5400,6550].forEach(function(y,row){[310,690].forEach(function(x,side){map.obstacles.push({type:'rotor',id:'rhythm-echo-paddle-'+row+'-'+side,
    role:'beat-paddle',x:x,y:y,length:250,thickness:12,angle:row*Math.PI/3+side*Math.PI/2,
    speed:(side?-1:1)*Math.PI*2/3.2,beat:{period:3.2,step:side,steps:4}});});});
  // Four sequential shutters reach maximum extension 0.8 seconds apart. The
  // alternating wall slots are fully open once per cycle, with no squeeze pair.
  [7900,8500,9100,9700].forEach(function(y,i){var side=i%2?1:-1;gate('chain-'+i,'beat-chain',y,side,-i*Math.PI/2+(side===1?Math.PI:0),3.2,720,330,-50,.12,i,4);});
  P.registerMap(map,{name:map.name,description:'교대 셔터와 엇박 패들이 흐름을 나누는 코스',accent:'#405D82'});
})(window.CosmicPinball);
