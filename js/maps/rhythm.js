(function(P){
  'use strict';
  var map={id:'rhythm',version:1,name:'박자 분배기',width:1000,height:11200,spawn:{x:36,y:50,width:928,height:700},finish:{y:11000},obstacles:[]};
  function rail(id,x1,y1,x2,y2){map.obstacles.push({type:'segment',id:'rhythm-'+id,x1:x1,y1:y1,x2:x2,y2:y2,thickness:8});}
  [2400,4800,7000].forEach(function(y,module){
    [330,670].forEach(function(x,side){map.obstacles.push({type:'moving',id:'rhythm-throat-'+module+'-'+side,x:x,y:y,axis:'x',length:160,thickness:8,angle:(side?-1:1)*Math.PI/4,amplitude:55,speed:.8,phase:module*Math.PI*2/3+(side?Math.PI:0)});});
    map.obstacles.push({type:'polygon',id:'rhythm-entry-'+module,points:[{x:492,y:y-350},{x:540,y:y-280},{x:530,y:y-250},{x:470,y:y-250},{x:460,y:y-290}]});
    rail('inlet-left-'+module,150,y-510,240,y-330);rail('inlet-right-'+module,850,y-510,760,y-330);
    rail('outlet-left-'+module,150,y+300,310,y+430);rail('outlet-right-'+module,850,y+300,690,y+430);
  });
  P.registerMap(map,{name:map.name,description:'천천히 움직이는 통로를 지나가요',accent:'#5B6C91'});
})(window.CosmicPinball);
