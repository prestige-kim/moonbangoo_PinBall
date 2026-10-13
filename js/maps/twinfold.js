(function (P) {
  'use strict';
  var map = { id: 'twinfold', version: 4, name: '갈래 서가', width: 1000, height: 11200,
    spawn: { x: 36, y: 50, width: 928, height: 700 }, finish: { y: 11000 }, obstacles: [] };
  function polygon(id, points) { map.obstacles.push({ type: 'polygon', id: 'twinfold-'+id, points: points.map(function (p) { return { x:p[0], y:p[1] }; }) }); }
  function rail(id,x1,y1,x2,y2) { map.obstacles.push({type:'segment',id:'twinfold-'+id,x1:x1,y1:y1,x2:x2,y2:y2,thickness:8}); }
  // Central islands physically block a bypass through either split.
  var center = [[500,1500],[610,1750],[610,2100],[450,2700],[590,3300],[570,3850],[500,4150],[390,3850],[390,1750]];
  var outer = [[1000,1800],[910,2000],[760,2650],[910,3300],[1000,3500]];
  polygon('first-island',center); polygon('first-side-island',outer);
  // Mirror the entire second split so the short route changes sides.
  polygon('second-island',center.map(function(p){return [1000-p[0],p[1]+3400];}));
  polygon('second-side-island',outer.map(function(p){return [1000-p[0],p[1]+3400];}));
  // Two open rows disperse the captured cluster before choosing a branch.
  [920,1220].forEach(function(y,row){[220,500,780].forEach(function(x,col){var d=(row+col)%2?-1:1;rail('entry-'+row+'-'+col,x-70,y-d*45,x+70,y+d*45);});});
  rail('first-bend-a',725,1800,820,1910); rail('first-bend-b',850,3550,740,3700);
  rail('second-bend-a',275,5200,180,5310); rail('second-bend-b',150,6950,260,7100);
  // Open, descending merge guides end well before the quiet final 20%.
  rail('merge-a-left',150,4250,270,4460); rail('merge-a-right',850,4250,730,4460);
  rail('merge-b-left',150,7750,270,7960); rail('merge-b-right',850,7750,730,7960);
  // Passive collision studs: no boost, identity logic or recovery force.
  [[165,1540],[335,1540],[835,1540],[165,2100],[165,2380],[165,2660],[665,2940],[165,3500],[165,3780],[165,4060],[665,4060],[500,4340],[165,4620],[500,4620],[835,4620],[335,4900],[665,4900],[835,5180],[835,5740],[335,6300],[835,6300],[835,6860],[165,7420],[835,7420],[335,7700],[665,7700],[165,8260],[500,8260],[665,8260],[165,8540],[500,8540],[835,8540]].forEach(function(p,i){map.obstacles.push({type:'pin',id:'twinfold-detail-'+i,x:p[0],y:p[1],r:12});});
  P.registerMap(map,{name:map.name,description:'두 갈래가 만나고 다시 갈라져요',accent:'#3E716B'});
})(window.CosmicPinball);
