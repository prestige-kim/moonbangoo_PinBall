(function(P){
  'use strict';
  var map={id:'cascade',version:3,name:'빗살 낙하',width:1000,height:11200,spawn:{x:36,y:50,width:928,height:700},finish:{y:11000},obstacles:[]};
  function rail(id,x1,y1,x2,y2,role){map.obstacles.push({type:'segment',id:'cascade-'+id,x1:x1,y1:y1,x2:x2,y2:y2,thickness:8,role:role||'guide'});}
  rail('entry-left',140,950,280,1060);rail('entry-right',860,950,720,1060);
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
  // Passive collision studs: no boost, identity logic or recovery force.
  [[500,980],[335,1260],[665,1260],[335,1820],[665,1820],[500,2100],[835,2100],[335,2380],[665,2380],[335,2940],[665,2940],[335,3220],[335,3500],[665,3500],[335,4060],[665,4060],[665,4340],[165,4620],[665,4620],[165,5180],[500,5180],[165,5460],[165,5740],[500,5740],[835,5740],[500,6300],[835,6300],[165,6860],[500,6860],[835,6860],[335,7420],[665,7420],[335,7700],[500,7980],[500,8260],[835,8540]].forEach(function(p,i){map.obstacles.push({type:'pin',id:'cascade-detail-'+i,x:p[0],y:p[1],r:12});});
  P.registerMap(map,{name:map.name,description:'경사진 선반을 한 단씩 내려가요',accent:'#A76546'});
})(window.CosmicPinball);
