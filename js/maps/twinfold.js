(function (P) {
  'use strict';
  var map = { id: 'twinfold', version: 7, name: '갈래 서가', width: 1000, height: 11200,
    spawn: { x: 36, y: 50, width: 928, height: 700 }, finish: { y: 11000 }, obstacles: [] };
  // Twenty reading bays alternate a central sliding shelf (two side aisles)
  // with paired book carts (one central aisle). No uninterrupted vertical bypass.
  // Carts extend through the side walls, preventing a straight outer-wall bypass.
  // Shelf edges slope toward their exits; horizontal motion never closes a lane.
  for (var row = 0; row < 20; row++) {
    var y = 1050 + row * (7400 / 19), paired = row % 2 === 0;
    (paired ? [140, 860] : [500]).forEach(function (x, col) {
      map.obstacles.push({ type: 'moving', id: 'twinfold-shelf-' + row + '-' + col,
        role: paired ? 'book-cart' : 'split-shelf', bay: row,
        x: x, y: y, axis: 'x', length: paired ? 400 : 560, thickness: 8,
        angle: (row + col) % 2 ? -0.34 : 0.34,
        amplitude: 28, speed: 0.8, phase: row * 1.7 + col * Math.PI });
    });
    // Bookend studs interrupt the open aisle between successive shelves.
    (paired ? [500] : [170, 830]).forEach(function (x) {
      map.obstacles.push({ type: 'pin', id: 'twinfold-detail-' + row + '-' + x,
        role: 'bookend', x: x, y: y + 210, r: 12 });
    });
  }
  // Visible air vents release a short gust every two simulation seconds.
  // They are fields, not solid barriers; lateral spread leaves the fall lanes open.
  [9020, 10760].forEach(function (y, row) {
    map.obstacles.push({ type: 'wind', id: 'twinfold-finale-wind-' + row,
      role: 'finale', x: 500, y: y, width: 600, height: 300,
      period: 2, duration: 0.4, liftHeight: 180, spread: 300, cooldown: 3 });
  });
  [140, 860].forEach(function (x, col) {
    map.obstacles.push({ type: 'moving', id: 'twinfold-finale-cart-' + col,
      role: 'finale', x: x, y: 9600, axis: 'x', length: 400, thickness: 8,
      angle: col ? -0.50 : 0.50, amplitude: 28, speed: 1.6, phase: col * Math.PI });
  });
  map.obstacles.push({ type: 'moving', id: 'twinfold-finale-return', role: 'finale',
    x: 500, y: 10160, axis: 'x', length: 360, thickness: 8,
    angle: -0.55, amplitude: 60, speed: 1.6, phase: Math.PI / 2 });
  P.registerMap(map, { name: map.name, description: '움직이는 서가 사이로 갈라지고 다시 만나요', accent: '#3E716B' });
})(window.CosmicPinball);
