(function(P){
  'use strict';
  var map={id:'cascade',version:1,name:'빗살 낙하',width:1000,height:11200,spawn:{x:36,y:50,width:928,height:700},finish:{y:11000},obstacles:[]};
  function rail(id,x1,y1,x2,y2,role){map.obstacles.push({type:'segment',id:'cascade-'+id,x1:x1,y1:y1,x2:x2,y2:y2,thickness:8,role:role||'guide'});}
  rail('entry-left',100,950,240,1060);rail('entry-right',900,950,760,1060);
  for(var row=0;row<6;row++){
    var y=1600+row*1100,angle=(row%2?-1:1)*Math.PI/6,dx=Math.cos(angle)*90,dy=Math.sin(angle)*90;
    [220,500,780].forEach(function(x,col){rail('shelf-'+row+'-'+col,x-dx,y-dy,x+dx,y+dy,'shelf');});
    var left=row%2===0;
    rail('return-'+row,left?150:850,y+320,left?225:775,y+500);
    var x=row%2?640:360;
    map.obstacles.push({type:'polygon',id:'cascade-wedge-'+row,points:[{x:x-8,y:y+510},{x:x+38,y:y+570},{x:x+24,y:y+600},{x:x-36,y:y+590},{x:x-42,y:y+560}]});
  }
  rail('exit-left-a',140,8070,220,8250);rail('exit-right-a',860,8070,780,8250);
  rail('exit-left-b',300,8440,350,8610);rail('exit-right-b',700,8440,650,8610);
  P.registerMap(map,{name:map.name,description:'경사진 선반을 한 단씩 내려가요',accent:'#A76546'});
})(window.CosmicPinball);
