(function(P){
  'use strict';
  var map={id:'rhythm',version:2,name:'박자 분배기',width:1000,height:11200,spawn:{x:36,y:50,width:928,height:700},finish:{y:11000},obstacles:[]};
  function rail(id,x1,y1,x2,y2){map.obstacles.push({type:'segment',id:'rhythm-'+id,x1:x1,y1:y1,x2:x2,y2:y2,thickness:8});}
  [2400,4800,7000].forEach(function(y,module){
    [330,670].forEach(function(x,side){map.obstacles.push({type:'moving',id:'rhythm-throat-'+module+'-'+side,x:x,y:y,axis:'x',length:160,thickness:8,angle:(side?-1:1)*Math.PI/4,amplitude:55,speed:.8,phase:module*Math.PI*2/3+(side?Math.PI:0)});});
    map.obstacles.push({type:'polygon',id:'rhythm-entry-'+module,points:[{x:492,y:y-350},{x:540,y:y-280},{x:530,y:y-250},{x:470,y:y-250},{x:460,y:y-290}]});
    rail('inlet-left-'+module,150,y-510,240,y-330);rail('inlet-right-'+module,850,y-510,760,y-330);
    rail('outlet-left-'+module,150,y+300,310,y+430);rail('outlet-right-'+module,850,y+300,690,y+430);
  });
  // Interleaved pairs make the timing mechanism recur across the entire active course.
  [1400,3500,5800,8200].forEach(function(y,module){[330,670].forEach(function(x,side){map.obstacles.push({type:'moving',id:'rhythm-echo-'+module+'-'+side,x:x,y:y,axis:'x',length:160,thickness:8,angle:(side?-1:1)*Math.PI/4,amplitude:55,speed:.8,phase:module*Math.PI*2/3+(side?Math.PI:0)});});});
  // Passive collision studs: no boost, identity logic or recovery force.
  [[165,980],[500,980],[500,1260],[335,1820],[335,2660],[165,2940],[835,2940],[500,3220],[165,3780],[665,3780],[335,4060],[665,4060],[665,4340],[665,4620],[835,4900],[335,5460],[835,5460],[165,6020],[665,6020],[335,6300],[835,6300],[165,7140],[500,7420],[500,7700],[165,7980],[665,7980],[335,8540],[835,8540]].forEach(function(p,i){map.obstacles.push({type:'pin',id:'rhythm-detail-'+i,x:p[0],y:p[1],r:12});});
  P.registerMap(map,{name:map.name,description:'천천히 움직이는 통로를 지나가요',accent:'#5B6C91'});
})(window.CosmicPinball);
