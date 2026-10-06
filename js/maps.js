(function (global) {
  'use strict';
  var P = global.CosmicPinball = global.CosmicPinball || {};
  // The inner rail is the playable boundary, shared by drawing and collisions.
  P.boardBounds = function (map) {
    return { left: 36, right: map.width - 36, top: 14, bottom: map.height - 32, radius: 16 };
  };
  P.boostShape = function (field) {
    var width = field.width || 90, height = field.height || 120;
    return { width: width, height: height, radius: Math.min(14, width / 2, height / 2),
      angle: Math.atan2(field.dy == null ? 1 : field.dy, field.dx || 0) - Math.PI / 2 };
  };
  P.MAPS = {
    classic: {
      id: 'classic', name: '자개 핀 보드', subtitle: 'CLASSIC PEARL BOARD',
      width: 1000, height: 7160,
      spawn: { x: 12, y: 50, width: 976, height: 680 },
      finish: { y: 6960 }, obstacles: []
    }
  };

  // Maps are ordinary data: renderer, collision solver and minimap share these shapes.
  var classic = P.MAPS.classic.obstacles;
  for (var row = 0; row < 10; row++) {
    for (var col = 0; col < 9; col++) {
      var x = 80 + col * 105 + (row % 2 ? 48 : 0);
      if (x > 950) continue;
      classic.push({ type: 'pin', id: 'star-pin-' + row + '-' + col, x: x, y: 790 + row * 218, r: row % 3 === 0 ? 11 : 9 });
    }
  }
  [
    { x: 290, y: 1120 }, { x: 710, y: 1340 }, { x: 500, y: 1560 },
    { x: 245, y: 1990 }, { x: 755, y: 2210 }, { x: 500, y: 2650 }
  ].forEach(function (point, index) {
    classic.push({ type: 'bumper', id: 'star-bumper-' + index, x: point.x, y: point.y, r: 38, power: 110 });
  });
  classic.push(
    { type: 'segment', id: 'star-ramp-l', x1: 0, y1: 1790, x2: 150, y2: 1880, thickness: 7 },
    { type: 'segment', id: 'star-ramp-r', x1: 1000, y1: 2410, x2: 850, y2: 2500, thickness: 7 }
  );

  // Repeat the classic board in three sections without changing its geometry.
  (function () {
    var map = P.MAPS.classic;
    var bounds = P.boardBounds(map);
    map.spawn.x = bounds.left;
    map.spawn.width = bounds.right - bounds.left;
    // 500 of the largest marbles still fit above the first obstacle after insetting the walls.
    map.spawn.height = 700;
    var firstSection = map.obstacles.slice();
    for (var section = 1; section < 3; section++) {
      firstSection.forEach(function (obstacle) {
        var copy = JSON.parse(JSON.stringify(obstacle));
        copy.id += '-section-' + (section + 1);
        var offset = section * 2000;
        ['y', 'y1', 'y2', 'targetY'].forEach(function (field) {
          if (typeof copy[field] === 'number') copy[field] += offset;
        });
        if (copy.points) copy.points.forEach(function (point) { point.y += offset; });
        map.obstacles.push(copy);
      });
    }
  })();
})(window);
