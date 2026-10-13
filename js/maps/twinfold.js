(function (P) {
  'use strict';
  var map = { id: 'twinfold', version: 1, name: '갈래 서가', width: 1000, height: 11200,
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
  rail('entry-left',80,950,275,1080); rail('entry-right',920,950,725,1080);
  rail('first-bend-a',665,1800,860,1940); rail('first-bend-b',900,3520,710,3660);
  rail('second-bend-a',335,5200,140,5340); rail('second-bend-b',100,6920,290,7060);
  // Open, descending merge guides end well before the quiet final 20%.
  rail('merge-a-left',85,4250,255,4460); rail('merge-a-right',915,4250,745,4460);
  rail('merge-b-left',85,7750,255,7960); rail('merge-b-right',915,7750,745,7960);
  P.registerMap(map,{name:map.name,description:'두 갈래가 만나고 다시 갈라져요',accent:'#3E716B'});
})(window.CosmicPinball);
