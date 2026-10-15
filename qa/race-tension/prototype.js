/* Isolated library finale prototype. Never imported by the production index. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.RaceTensionPrototype=factory;})(typeof window==='undefined'?globalThis:window,function(P){
 'use strict';
 const original=P.MAPS.twinfold,map=JSON.parse(JSON.stringify(original));
 if(map.version!==9)throw Error('Expected untouched library v9');
 map.version=10;map.reviewVariant='two-bookmark-finale-a';
 map.obstacles=map.obstacles.filter(o=>o.id!=='twinfold-finale-return');
 map.obstacles.push({type:'moving',id:'twinfold-review-bookmark-left',role:'review-bookmark',x:350,y:10080,axis:'x',length:250,thickness:8,angle:.38,amplitude:55,speed:1.25,phase:0});
 map.obstacles.push({type:'moving',id:'twinfold-review-bookmark-right',role:'review-bookmark',x:650,y:10320,axis:'x',length:250,thickness:8,angle:-.38,amplitude:55,speed:.9,phase:Math.PI/2});
 P.MAPS.twinfold=map;return {map,original};
});
